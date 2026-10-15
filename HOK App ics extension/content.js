(function() {
  'use strict';

  // --- KONFIGURATION & MAPS ---
  const MONTH_MAP = {
    'januar': '01', 'jänner': '01', 'februar': '02', 'märz': '03', 
    'april': '04', 'mai': '05', 'juni': '06', 'juli': '07', 
    'august': '08', 'september': '09', 'oktober': '10', 
    'november': '11', 'dezember': '12'
  };

  const EMOJI_MAP = {
    'PRESENCE': '🔵',
    'VIRTUAL': '⚪',
    'EXAM': '🔴',
    'POSTPONED': '🟠',
    'EXCURSION': '🟣',
    'DEADLINE': '🟢',
    'DEFAULT': '⚫'
  };

  const STORAGE_KEYS = {
    SUBJECTS: 'hok_subject_selection',
    INCLUDE_MODE: 'hok_include_mode_in_title',
    GH_TOKEN: 'hok_gh_token',
    GH_REPO: 'hok_gh_repo',
    GH_BRANCH: 'hok_gh_branch',
    GH_PATH: 'hok_gh_path',
    GH_LAST_SYNC: 'hok_gh_last_sync',
    GH_LAST_STATUS: 'hok_gh_last_status',
    THEME: 'hok_theme'
  };

  // --- HILFSFUNKTIONEN ---
  function parseDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/);
    if (!match) return null;
    return `${match[3]}${MONTH_MAP[match[2].toLowerCase()] || '01'}${match[1].padStart(2, '0')}`;
  }

  function parseTime(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return `${match[1].padStart(2, '0')}${match[2]}00`;
  }

  function escapeICal(str) {
    if (!str) return '';
    return str.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cleanSubjectName(rawTitle) {
    if (!rawTitle) return '';
    return rawTitle
      // Emojis am Anfang/Ende entfernen falls vorhanden
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      // Modus in eckigen Klammern z.B. [ILV], [VO], [KLAUSUR], [EXKURSION] entfernen
      .replace(/\[[^\]]*\]/g, '')
      // Modus in runden Klammern entfernen falls vorhanden (z. B. (ILV), (VO), (Klausur))
      .replace(/\s*\((?:ILV|VO|Klausur|Prüfung|Exkursion|Online|Präsenz)\)/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function getEmoji(element, modeStr) {
    const indicator = element?.querySelector('.border-r-2') || element;
    const classes = indicator?.className || '';
    const modeText = (modeStr || '').toLowerCase();

    if (classes.includes('exam') || modeText.includes('klausur') || modeText.includes('prüfung')) return EMOJI_MAP['EXAM'];
    if (classes.includes('postponed') || modeText.includes('verschoben')) return EMOJI_MAP['POSTPONED'];
    if (classes.includes('excursion') || modeText.includes('exkursion')) return EMOJI_MAP['EXCURSION'];
    if (classes.includes('green') || modeText.includes('moodle') || modeText.includes('deadline')) return EMOJI_MAP['DEADLINE'];
    if (classes.includes('white') || modeText.includes('online') || modeText.includes('virtuell')) return EMOJI_MAP['VIRTUAL'];

    return EMOJI_MAP['PRESENCE'];
  }

  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binString = '';
    const chunkSize = 1024;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binString += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binString);
  }

  // --- EVENT EXTRAKTION AUS DEM DOM ---
  function extractEventsFromDOM() {
    const dateHeaders = Array.from(document.querySelectorAll('.text-green, [class*="text-green"]'));
    const cards = Array.from(document.querySelectorAll('.flex'));

    const allNodes = [...dateHeaders, ...cards].filter((node) => {
      // Ignoriere Elemente innerhalb unseres eigenen Modals
      return !node.closest('#hok-modal-overlay');
    }).sort((a, b) => {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

    let currentDateText = '';
    let exportedEvents = [];
    const courseCounters = {};

    allNodes.forEach((node) => {
      const text = node.innerText.trim();
      if (parseDate(text)) {
        currentDateText = text;
        return;
      }

      if (!node.classList.contains('flex')) return;

      const h2 = node.querySelector('h2.text-maintitle-course') || node.querySelector('h2');
      if (!h2) return;

      const rawTitle = h2.innerText.trim();
      if (!rawTitle || 
          rawTitle.toLowerCase().includes('anstehende vorlesungen') || 
          rawTitle.toLowerCase().includes('vergangene vorlesungen') ||
          rawTitle.toLowerCase().includes('vorlesungsplan')) {
        return;
      }

      const timeSpans = node.querySelectorAll('.text-time-span');
      if (timeSpans.length < 2) return;

      const startTimeRaw = timeSpans[0]?.innerText.trim();
      const endTimeRaw = timeSpans[timeSpans.length - 1]?.innerText.trim();

      const parsedStartTime = parseTime(startTimeRaw);
      const parsedEndTime = parseTime(endTimeRaw);
      const formattedDate = parseDate(currentDateText);

      if (!parsedStartTime || !parsedEndTime || !formattedDate) return;

      const modeElement = node.querySelector('.rotate-180') || timeSpans[1];
      const mode = modeElement?.innerText.trim() || '';

      const group = node.querySelector('.opacity-40')?.innerText.trim() || '';
      const locationElement = node.querySelector('[data-testid="navigateToRoom"]');
      const location = locationElement ? locationElement.innerText.trim() : 'Ort TBA';
      const lecturer = node.querySelector('.inline.p-1')?.innerText.trim() || '';

      const cleanSubject = cleanSubjectName(rawTitle) || rawTitle;

      // Deterministische UID bilden (unabhängig vom Datum)
      const titleSlug = cleanSubject.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20);
      const groupSlug = group.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) || 'all';
      const courseKey = `${groupSlug}-${titleSlug}`;

      courseCounters[courseKey] = (courseCounters[courseKey] || 0) + 1;
      const sessionIndex = courseCounters[courseKey];
      const uid = `hok-${courseKey}-session${sessionIndex}@app.hok.ac.at`;

      const emoji = getEmoji(node, mode);

      exportedEvents.push({
        uid,
        dtStart: `${formattedDate}T${parsedStartTime}`,
        dtEnd: `${formattedDate}T${parsedEndTime}`,
        rawTitle,
        subject: cleanSubject,
        emoji,
        location,
        mode,
        group,
        lecturer
      });
    });

    return exportedEvents;
  }

  // --- ICAL BUILDER ---
  function buildICalContent(events, includeModeInTitle) {
    const nowFormatted = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HOK App iCal Exporter//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:HOK Vorlesungsplan',
      'X-WR-TIMEZONE:Europe/Vienna',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Vienna',
      'X-LIC-LOCATION:Europe/Vienna',
      'BEGIN:DAYLIGHT',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'TZNAME:CEST',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'TZNAME:CET',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
      'END:STANDARD',
      'END:VTIMEZONE'
    ];

    events.forEach((evt) => {
      // Wenn includeModeInTitle aktiv ist, Modus anzeigen - sonst ignorieren!
      const summary = (includeModeInTitle && evt.mode) 
        ? `${evt.emoji} [${evt.mode}] ${evt.subject}` 
        : `${evt.emoji} ${evt.subject}`;

      let descriptionParts = [];
      if (evt.mode) descriptionParts.push(`Modus: ${evt.mode}`);
      if (evt.group) descriptionParts.push(`Gruppe: ${evt.group}`);
      if (evt.lecturer) descriptionParts.push(`Dozent: ${evt.lecturer}`);
      if (evt.location) descriptionParts.push(`Raum: ${evt.location}`);

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${evt.uid}`,
        `DTSTAMP:${nowFormatted}`,
        `DTSTART;TZID=Europe/Vienna:${evt.dtStart}`,
        `DTEND;TZID=Europe/Vienna:${evt.dtEnd}`,
        `SUMMARY:${escapeICal(summary)}`,
        `LOCATION:${escapeICal(evt.location)}`,
        `CATEGORIES:${escapeICal(evt.mode || 'Vorlesung')}`,
        `DESCRIPTION:${escapeICal(descriptionParts.join(' | '))}`,
        'END:VEVENT'
      );
    });

    icsLines.push('END:VCALENDAR');
    return icsLines.join('\r\n');
  }

  // --- GITHUB API SYNCHRONISATION ---
  async function syncToGitHub(token, repoInput, branchInput, pathInput, icsContent) {
    const cleanRepo = repoInput.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
    const repoParts = cleanRepo.split('/');
    if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) {
      throw new Error('Ungültiges Repository-Format. Bitte im Format "owner/repo" angeben (z. B. "maxmustermann/hok-kalender").');
    }
    const owner = repoParts[0];
    const repo = repoParts[1];
    const branch = (branchInput || 'main').trim();
    const path = (pathInput || 'hok_vorlesungsplan.ics').replace(/^\/+/, '').trim();

    if (!token || !token.trim()) {
      throw new Error('Bitte gib dein GitHub Personal Access Token (PAT) an.');
    }
    const cleanToken = token.trim();

    const apiHeaders = {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${cleanToken}`,
      'X-GitHub-Api-Version': '2022-11-28'
    };

    // 1. Prüfen ob die Datei bereits existiert (um SHA zu erhalten)
    let sha = null;
    const encodedPath = encodeURIComponent(path).replace(/%2F/g, '/');
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

    try {
      const getRes = await fetch(getUrl, {
        method: 'GET',
        headers: apiHeaders
      });

      if (getRes.status === 200) {
        const data = await getRes.json();
        sha = data.sha;
      } else if (getRes.status === 404) {
        sha = null; // Datei existiert noch nicht
      } else if (getRes.status === 401) {
        throw new Error('GitHub Authentifizierung fehlgeschlagen (401). Bitte prüfe dein Personal Access Token.');
      } else if (getRes.status === 403) {
        const errData = await getRes.json().catch(() => ({}));
        throw new Error(`Zugriff verweigert (403): ${errData.message || 'Token besitzt keine Schreibrechte für dieses Repository.'}`);
      } else {
        const errData = await getRes.json().catch(() => ({}));
        throw new Error(`GitHub API Fehler (${getRes.status}): ${errData.message || getRes.statusText}`);
      }
    } catch (err) {
      if (err.message && err.message.includes('GitHub')) throw err;
      throw new Error(`Netzwerkfehler beim Abrufen des Repositories: ${err.message}`);
    }

    // 2. PUT Request zum Erstellen oder Aktualisieren der Datei
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
    const base64Content = utf8ToBase64(icsContent);

    const bodyData = {
      message: `Update HOK Vorlesungsplan (${new Date().toLocaleDateString('de-DE')} ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`,
      content: base64Content,
      branch: branch
    };
    if (sha) {
      bodyData.sha = sha;
    }

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        ...apiHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      throw new Error(`Fehler beim Hochladen zu GitHub (${putRes.status}): ${errData.message || putRes.statusText}`);
    }

    const result = await putRes.json();
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    return {
      success: true,
      rawUrl,
      owner,
      repo,
      branch,
      path,
      commitSha: result.commit?.sha?.slice(0, 7) || 'ok'
    };
  }

  // --- LOKALE DATEI HERUNTERLADEN ---
  function triggerDownload(icsContent, filename = 'hok_vorlesungsplan.ics') {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- CSS STYLES FÜR MODAL & BUTTONS (HOK DESIGN) ---
  function injectStyles() {
    if (document.getElementById('hok-extension-styles')) return;

    const style = document.createElement('style');
    style.id = 'hok-extension-styles';
    style.textContent = `
      #hok-ical-btn {
        margin-left: 14px;
        padding: 7px 14px;
        background-color: #008E4D;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
        font-family: Oswald, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
      }
      #hok-ical-btn:hover {
        background-color: #007740;
        box-shadow: 0 2px 6px rgba(0, 142, 77, 0.35);
      }
      #hok-ical-btn:active {
        transform: scale(0.98);
      }

      /* Modal Overlay */
      #hok-modal-overlay {
        position: fixed;
        inset: 0;
        background-color: rgba(18, 18, 18, 0.65);
        backdrop-filter: blur(3px);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;
        padding: 16px;
        box-sizing: border-box;
      }
      #hok-modal-overlay.hok-visible {
        opacity: 1;
      }

      /* Modal Card */
      .hok-modal-card {
        background: #ffffff;
        color: #1e1e1e;
        width: 100%;
        max-width: 580px;
        max-height: 90vh;
        border-radius: 10px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: Oswald, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        transform: scale(0.96);
        transition: transform 0.2s ease;
        box-sizing: border-box;
      }
      #hok-modal-overlay.hok-visible .hok-modal-card {
        transform: scale(1);
      }

      /* Modal Header */
      .hok-modal-header {
        padding: 14px 20px;
        background: #008E4D;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .hok-modal-title {
        font-size: 1.15rem;
        font-weight: 700;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: 0.02em;
      }
      .hok-modal-close {
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 1.3rem;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
        opacity: 0.85;
        transition: opacity 0.15s, background-color 0.15s;
      }
      .hok-modal-close:hover {
        opacity: 1;
        background-color: rgba(255, 255, 255, 0.15);
      }

      /* Modal Body */
      .hok-modal-body {
        padding: 18px 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
        font-size: 0.88rem;
      }

      /* Section Containers */
      .hok-section {
        background: #fbfcfc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
      }
      .hok-section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .hok-section-title {
        font-weight: 700;
        font-size: 0.95rem;
        color: #1e1e1e;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Quick Actions */
      .hok-quick-actions {
        display: flex;
        gap: 6px;
      }
      .hok-btn-xs {
        padding: 3px 8px;
        font-size: 0.72rem;
        font-weight: 600;
        border-radius: 4px;
        border: 1px solid #d2d2d2;
        background: #ffffff;
        color: #333333;
        cursor: pointer;
        transition: all 0.12s;
        font-family: inherit;
      }
      .hok-btn-xs:hover {
        background: #008E4D;
        color: #ffffff;
        border-color: #008E4D;
      }

      /* Subject Search */
      .hok-search-input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #d2d2d2;
        border-radius: 5px;
        font-size: 0.82rem;
        margin-bottom: 8px;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.15s;
        font-family: inherit;
      }
      .hok-search-input:focus {
        border-color: #008E4D;
      }

      /* Subject List */
      .hok-subject-list {
        max-height: 190px;
        overflow-y: auto;
        border: 1px solid #edf2f7;
        border-radius: 6px;
        background: #ffffff;
      }
      .hok-subject-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.83rem;
        cursor: pointer;
        transition: background 0.1s;
      }
      .hok-subject-item:last-child {
        border-bottom: none;
      }
      .hok-subject-item:hover {
        background: #f7faf8;
      }
      .hok-subject-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hok-subject-name {
        font-weight: 600;
        color: #222222;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hok-subject-badge {
        font-size: 0.7rem;
        background: #eaf5ee;
        color: #008E4D;
        border: 1px solid #cce8d7;
        padding: 2px 6px;
        border-radius: 10px;
        font-weight: 600;
        flex-shrink: 0;
        margin-left: 8px;
      }
      .hok-checkbox {
        accent-color: #008E4D;
        width: 15px;
        height: 15px;
        cursor: pointer;
      }

      /* Setting toggle */
      .hok-toggle-row {
        margin-top: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        color: #555555;
        cursor: pointer;
      }

      /* Form inputs */
      .hok-form-group {
        margin-bottom: 8px;
      }
      .hok-form-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: #444444;
        margin-bottom: 3px;
      }
      .hok-input {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #d2d2d2;
        border-radius: 5px;
        font-size: 0.82rem;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
        font-family: inherit;
      }
      .hok-input:focus {
        border-color: #008E4D;
        box-shadow: 0 0 0 2px rgba(0, 142, 77, 0.15);
      }
      .hok-input-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      .hok-help-text {
        font-size: 0.72rem;
        color: #666666;
        margin-top: 2px;
      }

      /* Buttons */
      .hok-btn-primary {
        width: 100%;
        padding: 9px 16px;
        background-color: #008E4D;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-weight: 700;
        font-size: 0.9rem;
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background-color 0.15s, box-shadow 0.15s;
      }
      .hok-btn-primary:hover {
        background-color: #007740;
        box-shadow: 0 2px 8px rgba(0, 142, 77, 0.35);
      }
      .hok-btn-primary:disabled {
        background-color: #a0aec0;
        cursor: not-allowed;
      }

      .hok-btn-secondary {
        width: 100%;
        padding: 7px 14px;
        background-color: #ffffff;
        color: #008E4D;
        border: 1.5px solid #008E4D;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.85rem;
        font-family: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background-color 0.15s;
      }
      .hok-btn-secondary:hover {
        background-color: #eaf5ee;
      }
      .hok-btn-secondary:disabled {
        border-color: #cbd5e1;
        color: #94a3b8;
        cursor: not-allowed;
      }

      /* Status Alert Box */
      .hok-status-box {
        padding: 9px 12px;
        border-radius: 6px;
        font-size: 0.8rem;
        display: none;
        line-height: 1.4;
      }
      .hok-status-box.hok-info {
        display: block;
        background: #eaf5ee;
        border: 1px solid #b7e0c8;
        color: #006637;
      }
      .hok-status-box.hok-error {
        display: block;
        background: #fee2e2;
        border: 1px solid #fca5a5;
        color: #991b1b;
      }
      .hok-status-box.hok-loading {
        display: block;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #334155;
      }

      /* Google Calendar Box */
      .hok-gcal-box {
        margin-top: 10px;
        background: #ffffff;
        border: 1px dashed #008E4D;
        border-radius: 6px;
        padding: 10px 12px;
      }
      .hok-gcal-url-row {
        display: flex;
        gap: 6px;
        margin: 6px 0 8px 0;
      }
      .hok-gcal-input {
        flex: 1;
        padding: 4px 8px;
        font-size: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        background: #f8fafc;
        color: #334155;
      }
      .hok-gcal-actions {
        display: flex;
        gap: 6px;
      }
      .hok-gcal-actions a, .hok-gcal-actions button {
        flex: 1;
        text-align: center;
        text-decoration: none;
      }

      /* Theme Toggle Button */
      .hok-theme-toggle {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 4px;
        color: #ffffff;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 3px 8px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s;
        font-family: inherit;
      }
      .hok-theme-toggle:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      /* Modal Footer */
      .hok-modal-footer {
        padding: 10px 20px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.75rem;
        color: #64748b;
      }

      /* ==========================================================================
         DARK MODE STYLES
         ========================================================================= */
      .hok-modal-card.hok-dark {
        background: #181818;
        color: #e0e0e0;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.75), 0 0 0 1px #333333;
      }
      .hok-modal-card.hok-dark .hok-modal-body {
        background: #181818;
        color: #e0e0e0;
      }
      .hok-modal-card.hok-dark .hok-section {
        background: #222222;
        border-color: #333333;
      }
      .hok-modal-card.hok-dark .hok-section-title {
        color: #f1f5f9;
      }
      .hok-modal-card.hok-dark .hok-btn-xs {
        background: #2a2a2a;
        border-color: #444444;
        color: #e2e8f0;
      }
      .hok-modal-card.hok-dark .hok-btn-xs:hover {
        background: #008E4D;
        border-color: #008E4D;
        color: #ffffff;
      }
      .hok-modal-card.hok-dark .hok-search-input,
      .hok-modal-card.hok-dark .hok-input {
        background: #141414;
        border-color: #3d3d3d;
        color: #f8fafc;
      }
      .hok-modal-card.hok-dark .hok-search-input:focus,
      .hok-modal-card.hok-dark .hok-input:focus {
        border-color: #008E4D;
        box-shadow: 0 0 0 2px rgba(0, 142, 77, 0.35);
      }
      .hok-modal-card.hok-dark .hok-subject-list {
        background: #1a1a1a;
        border-color: #333333;
      }
      .hok-modal-card.hok-dark .hok-subject-item {
        border-bottom-color: #262626;
      }
      .hok-modal-card.hok-dark .hok-subject-item:hover {
        background: #262626;
      }
      .hok-modal-card.hok-dark .hok-subject-name {
        color: #f1f5f9;
      }
      .hok-modal-card.hok-dark .hok-subject-badge {
        background: #0f2e1e;
        color: #4ade80;
        border-color: #1c5236;
      }
      .hok-modal-card.hok-dark .hok-toggle-row {
        color: #94a3b8;
      }
      .hok-modal-card.hok-dark .hok-form-label {
        color: #cbd5e1;
      }
      .hok-modal-card.hok-dark .hok-help-text {
        color: #94a3b8;
      }
      .hok-modal-card.hok-dark .hok-btn-secondary {
        background: #222222;
        color: #4ade80;
        border-color: #008E4D;
      }
      .hok-modal-card.hok-dark .hok-btn-secondary:hover {
        background: #163322;
      }
      .hok-modal-card.hok-dark .hok-gcal-box {
        background: #15221a;
        border-color: #008E4D;
      }
      .hok-modal-card.hok-dark .hok-gcal-input {
        background: #121212;
        border-color: #2b4535;
        color: #e2e8f0;
      }
      .hok-modal-card.hok-dark .hok-status-box.hok-loading {
        background: #1e293b;
        border-color: #334155;
        color: #94a3b8;
      }
      .hok-modal-card.hok-dark .hok-status-box.hok-info {
        background: #0f2e1e;
        border-color: #1c5236;
        color: #4ade80;
      }
      .hok-modal-card.hok-dark .hok-status-box.hok-error {
        background: #3b1515;
        border-color: #7f1d1d;
        color: #fca5a5;
      }
      .hok-modal-card.hok-dark .hok-modal-footer {
        background: #141414;
        border-top-color: #262626;
        color: #888888;
      }
      .hok-modal-card.hok-dark #hok-private-repo-warning {
        background: #3b1515 !important;
        border-color: #ef4444 !important;
        color: #fca5a5 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // --- MODAL DIALOG ÖFFNEN / RENDERN ---
  function openHokModal() {
    injectStyles();

    // Existierendes Modal entfernen falls vorhanden
    const existing = document.getElementById('hok-modal-overlay');
    if (existing) existing.remove();

    // 1. Events frisch aus dem DOM laden
    const allEvents = extractEventsFromDOM();

    // 2. Fächer extrahieren und alphabetisch sortieren
    const subjectCounts = {};
    allEvents.forEach((evt) => {
      subjectCounts[evt.subject] = (subjectCounts[evt.subject] || 0) + 1;
    });

    const distinctSubjects = Object.keys(subjectCounts).sort((a, b) => {
      return a.localeCompare('de', { sensitivity: 'base' });
    });

    // 3. Gespeicherte Auswahl aus LocalStorage laden
    let savedSelection = {};
    try {
      savedSelection = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBJECTS) || '{}');
    } catch (e) {
      savedSelection = {};
    }

    // Wenn keine gespeicherte Auswahl existiert, alle vorauswählen
    const hasPriorSelection = Object.keys(savedSelection).length > 0;
    const currentSelection = {};
    distinctSubjects.forEach((subj) => {
      if (hasPriorSelection && savedSelection[subj] !== undefined) {
        currentSelection[subj] = Boolean(savedSelection[subj]);
      } else {
        currentSelection[subj] = true;
      }
    });

    // Einstellung: Modus im Titel anzeigen (Standard: false -> Modus ignoriert)
    const includeMode = localStorage.getItem(STORAGE_KEYS.INCLUDE_MODE) === 'true';

    // GitHub Settings aus LocalStorage
    const ghToken = localStorage.getItem(STORAGE_KEYS.GH_TOKEN) || '';
    const ghRepo = localStorage.getItem(STORAGE_KEYS.GH_REPO) || '';
    const ghBranch = localStorage.getItem(STORAGE_KEYS.GH_BRANCH) || 'main';
    const ghPath = localStorage.getItem(STORAGE_KEYS.GH_PATH) || 'hok_vorlesungsplan.ics';
    const ghLastSync = localStorage.getItem(STORAGE_KEYS.GH_LAST_SYNC) || '';
    const currentTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';

    // Modal DOM aufbauen
    const overlay = document.createElement('div');
    overlay.id = 'hok-modal-overlay';

    overlay.innerHTML = `
      <div class="hok-modal-card ${currentTheme === 'dark' ? 'hok-dark' : ''}">
        <div class="hok-modal-header">
          <div class="hok-modal-title">📅 HOK Vorlesungsplan Sync & Export</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button type="button" class="hok-theme-toggle" id="hok-theme-toggle" title="Design wechseln">
              ${currentTheme === 'dark' ? '☀️ Hell' : '🌙 Dunkel'}
            </button>
            <button class="hok-modal-close" title="Schließen">&times;</button>
          </div>
        </div>

        <div class="hok-modal-body">
          <!-- SEKTION 1: FÄCHER AUSWAHL -->
          <div class="hok-section">
            <div class="hok-section-header">
              <div class="hok-section-title">
                📚 Fächer auswählen 
                <span id="hok-selected-count" style="font-size:0.75rem; font-weight:normal; color:#666;"></span>
              </div>
              <div class="hok-quick-actions">
                <button type="button" class="hok-btn-xs" id="hok-select-all">Alle</button>
                <button type="button" class="hok-btn-xs" id="hok-select-none">Keine</button>
              </div>
            </div>

            <input type="text" class="hok-search-input" id="hok-subject-search" placeholder="🔍 Fach suchen..." autocomplete="off" />

            <div class="hok-subject-list" id="hok-subject-list">
              <!-- Dynamisch befüllt -->
            </div>

            <label class="hok-toggle-row">
              <input type="checkbox" id="hok-include-mode" class="hok-checkbox" ${includeMode ? 'checked' : ''} />
              <span>Modus im Kalender-Titel anzeigen (z. B. <code>[ILV]</code> / <code>[VO]</code>) — standardmäßig deaktiviert</span>
            </label>
          </div>

          <!-- SEKTION 2: GOOGLE CALENDAR / GITHUB SYNC -->
          <div class="hok-section">
            <div class="hok-section-header">
              <div class="hok-section-title">
                🔄 Google Kalender via GitHub Sync
              </div>
              <button type="button" class="hok-btn-xs" id="hok-toggle-gh-settings">⚙️ Einstellungen</button>
            </div>

            <!-- GitHub Einstellungen Panel -->
            <div id="hok-gh-settings-panel" style="${(ghToken && ghRepo) ? 'display:none;' : 'display:block;'}">
              <div class="hok-form-group">
                <label class="hok-form-label">GitHub Fine-Grained Token (PAT):</label>
                <input type="password" class="hok-input" id="hok-gh-token" placeholder="github_pat_..." value="${escapeHtml(ghToken)}" />
                <div class="hok-help-text">Benötigt ein GitHub Token mit <strong>Repository: Contents (Read and write)</strong> Rechten.</div>
              </div>

              <div class="hok-form-group">
                <label class="hok-form-label">Repository (owner/repo):</label>
                <input type="text" class="hok-input" id="hok-gh-repo" placeholder="z. B. maxmustermann/hok-kalender" value="${escapeHtml(ghRepo)}" />
                <div class="hok-help-text">⚠️ <strong>Wichtig für Google:</strong> Das Repository muss auf GitHub <strong>Public</strong> sein, sonst meldet Google <em>"Unable to add calendar"</em>.</div>
              </div>

              <div class="hok-input-row">
                <div class="hok-form-group">
                  <label class="hok-form-label">Branch:</label>
                  <input type="text" class="hok-input" id="hok-gh-branch" value="${escapeHtml(ghBranch)}" />
                </div>
                <div class="hok-form-group">
                  <label class="hok-form-label">Dateipfad:</label>
                  <input type="text" class="hok-input" id="hok-gh-path" value="${escapeHtml(ghPath)}" />
                </div>
              </div>
            </div>

            <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="hok-btn-primary" id="hok-sync-btn">
                🔄 Mit GitHub synchronisieren
              </button>
              <button type="button" class="hok-btn-secondary" id="hok-download-btn">
                💾 Als .ics Datei herunterladen
              </button>
            </div>

            <!-- Status Box -->
            <div id="hok-status-box" class="hok-status-box" style="margin-top: 10px;"></div>

            <!-- Warnung falls Repo Private ist -->
            <div id="hok-private-repo-warning" style="display: none; margin-top: 10px; background: #fee2e2; border: 1.5px solid #ef4444; color: #991b1b; padding: 10px 12px; border-radius: 6px; font-size: 0.78rem; line-height: 1.45;">
              <strong>🚨 Google meldet "Unable to add calendar"?</strong><br>
              Dein GitHub-Repository ist aktuell <strong>Private (nicht öffentlich)</strong>! Google Kalender kann nicht auf private Repos zugreifen.<br>
              👉 <strong>Lösung in 20 Sekunden:</strong><br>
              1. Öffne dein Repo auf GitHub &rarr; Tab <strong>Settings</strong>.<br>
              2. Scrolle ganz nach unten zu <strong>"Danger Zone"</strong>.<br>
              3. Klicke auf <strong>"Change repository visibility"</strong> &rarr; auf <strong>"Public"</strong> stellen.<br>
              Danach klappt das Hinzufügen sofort!
            </div>

            <!-- Google Calendar Box nach erfolgreichem Sync -->
            <div id="hok-gcal-box" class="hok-gcal-box" style="display: none;">
              <div style="font-weight: 700; color: #008E4D; font-size: 0.84rem;">📅 Google Kalender Abonnieren:</div>
              <div style="font-size: 0.75rem; opacity: 0.85; margin-top: 2px;">
                Füge diesen Link in Google Kalender unter <em>"Weitere Kalender" (+) &rarr; "Per URL"</em> ein:
              </div>
              <div class="hok-gcal-url-row">
                <input type="text" readonly id="hok-gcal-url-input" class="hok-gcal-input" />
                <button type="button" class="hok-btn-xs" id="hok-copy-url-btn">📋 Kopieren</button>
              </div>
              <div class="hok-gcal-actions" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                <button type="button" id="hok-open-gcal-btn" class="hok-btn-primary" style="padding: 7px 12px; font-size: 0.82rem;">
                  🌐 URL kopieren & Google Kalender öffnen
                </button>
                <a href="#" id="hok-webcal-link" class="hok-btn-secondary" style="padding: 5px 10px; font-size: 0.78rem; text-decoration: none; text-align: center;">
                  📅 Direktes Webcal-Abo (System-Kalender)
                </a>
              </div>
              <div style="font-size: 0.72rem; opacity: 0.85; margin-top: 8px; line-height: 1.35; padding: 7px 9px; border-radius: 5px; border: 1px dashed rgba(0, 142, 77, 0.4);">
                💡 <strong>Wichtig für Google Kalender:</strong><br>
                • <strong>Unable to add calendar?</strong> Prüfe, ob dein GitHub-Repo auf <strong>Public</strong> steht!<br>
                • <strong>"(GMT+00:00)" Anzeige:</strong> Das ist ein reiner Google-UI-Anzeigebug bei Web-Abos. Die Termine selbst sind fest in <strong>Europe/Vienna</strong> kodiert und landen zur exakten Wiener Zeit im Kalender.
              </div>
            </div>
          </div>
        </div>

        <div class="hok-modal-footer">
          <span id="hok-footer-status">
            ${ghLastSync ? 'Zuletzt synchronisiert: ' + new Date(ghLastSync).toLocaleString('de-DE') : 'Auswahl wird automatisch im Browser gemerkt'}
          </span>
          <button type="button" class="hok-btn-xs" id="hok-footer-close">Fertig</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Fade-In
    requestAnimationFrame(() => {
      overlay.classList.add('hok-visible');
    });

    // --- ELEMENT REFERENZEN ---
    const listContainer = overlay.querySelector('#hok-subject-list');
    const searchInput = overlay.querySelector('#hok-subject-search');
    const selectAllBtn = overlay.querySelector('#hok-select-all');
    const selectNoneBtn = overlay.querySelector('#hok-select-none');
    const selectedCountSpan = overlay.querySelector('#hok-selected-count');
    const includeModeCheckbox = overlay.querySelector('#hok-include-mode');

    const toggleGhSettingsBtn = overlay.querySelector('#hok-toggle-gh-settings');
    const ghSettingsPanel = overlay.querySelector('#hok-gh-settings-panel');
    const ghTokenInput = overlay.querySelector('#hok-gh-token');
    const ghRepoInput = overlay.querySelector('#hok-gh-repo');
    const ghBranchInput = overlay.querySelector('#hok-gh-branch');
    const ghPathInput = overlay.querySelector('#hok-gh-path');

    const syncBtn = overlay.querySelector('#hok-sync-btn');
    const downloadBtn = overlay.querySelector('#hok-download-btn');
    const statusBox = overlay.querySelector('#hok-status-box');
    const gcalBox = overlay.querySelector('#hok-gcal-box');
    const gcalUrlInput = overlay.querySelector('#hok-gcal-url-input');
    const copyUrlBtn = overlay.querySelector('#hok-copy-url-btn');
    const openGcalLink = overlay.querySelector('#hok-open-gcal-link');
    const footerStatus = overlay.querySelector('#hok-footer-status');

    // --- HILFSFUNKTIONEN FÜR MODAL INTERAKTION ---
    function savePreferences() {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(currentSelection));
      localStorage.setItem(STORAGE_KEYS.INCLUDE_MODE, includeModeCheckbox.checked ? 'true' : 'false');
      localStorage.setItem(STORAGE_KEYS.GH_TOKEN, ghTokenInput.value.trim());
      localStorage.setItem(STORAGE_KEYS.GH_REPO, ghRepoInput.value.trim());
      localStorage.setItem(STORAGE_KEYS.GH_BRANCH, ghBranchInput.value.trim() || 'main');
      localStorage.setItem(STORAGE_KEYS.GH_PATH, ghPathInput.value.trim() || 'hok_vorlesungsplan.ics');
    }

    function renderSubjectList(filterText = '') {
      listContainer.innerHTML = '';

      if (distinctSubjects.length === 0) {
        listContainer.innerHTML = `
          <div style="padding: 16px; text-align: center; color: #777; font-size: 0.8rem;">
            ⚠️ Keine Vorlesungstermine auf der aktuellen Ansicht gefunden.<br>
            Bitte öffne die Wochen-/Monatsansicht deines Vorlesungsplans.
          </div>`;
        updateCounts();
        return;
      }

      const filter = filterText.toLowerCase().trim();
      let visibleCount = 0;
      let totalSelected = 0;

      distinctSubjects.forEach((subj) => {
        const count = subjectCounts[subj] || 0;
        const isChecked = Boolean(currentSelection[subj]);
        if (isChecked) totalSelected++;

        if (filter && !subj.toLowerCase().includes(filter)) {
          return;
        }
        visibleCount++;

        const item = document.createElement('div');
        item.className = 'hok-subject-item';
        item.innerHTML = `
          <label class="hok-subject-label" title="${escapeHtml(subj)}">
            <input type="checkbox" class="hok-checkbox hok-subj-checkbox" ${isChecked ? 'checked' : ''} data-subject="${escapeHtml(subj)}" />
            <span class="hok-subject-name">${escapeHtml(subj)}</span>
          </label>
          <span class="hok-subject-badge">${count} Termin${count > 1 ? 'e' : ''}</span>
        `;

        const chk = item.querySelector('.hok-subj-checkbox');
        chk.addEventListener('change', (e) => {
          currentSelection[subj] = e.target.checked;
          savePreferences();
          updateCounts();
        });

        listContainer.appendChild(item);
      });

      if (visibleCount === 0) {
        listContainer.innerHTML = `<div style="padding: 12px; text-align: center; color: #888; font-size: 0.8rem;">Kein Fach für "${escapeHtml(filterText)}" gefunden.</div>`;
      }

      updateCounts();
    }

    function updateCounts() {
      let selectedSubjectsCount = 0;
      let selectedEventsCount = 0;

      allEvents.forEach((evt) => {
        if (currentSelection[evt.subject]) {
          selectedEventsCount++;
        }
      });

      distinctSubjects.forEach((subj) => {
        if (currentSelection[subj]) selectedSubjectsCount++;
      });

      if (distinctSubjects.length === 0) {
        selectedCountSpan.textContent = `(0 Termine gefunden)`;
        syncBtn.textContent = `🔄 Mit GitHub synchronisieren (0 Termine)`;
        downloadBtn.textContent = `💾 Als .ics herunterladen (0 Termine)`;
        syncBtn.disabled = true;
        downloadBtn.disabled = true;
        return;
      }

      selectedCountSpan.textContent = `(${selectedSubjectsCount} von ${distinctSubjects.length} gewählt • ${selectedEventsCount} Termine)`;
      syncBtn.textContent = `🔄 Mit GitHub synchronisieren (${selectedEventsCount} Termine)`;
      downloadBtn.textContent = `💾 Als .ics herunterladen (${selectedEventsCount} Termine)`;

      syncBtn.disabled = selectedEventsCount === 0;
      downloadBtn.disabled = selectedEventsCount === 0;
    }

    function closeModal() {
      overlay.classList.remove('hok-visible');
      setTimeout(() => overlay.remove(), 200);
    }

    const themeToggleBtn = overlay.querySelector('#hok-theme-toggle');
    const modalCard = overlay.querySelector('.hok-modal-card');
    const openGcalBtn = overlay.querySelector('#hok-open-gcal-btn');
    const webcalLink = overlay.querySelector('#hok-webcal-link');
    const privateWarning = overlay.querySelector('#hok-private-repo-warning');

    // Theme Toggle Handler
    themeToggleBtn.addEventListener('click', () => {
      const isDark = modalCard.classList.toggle('hok-dark');
      localStorage.setItem(STORAGE_KEYS.THEME, isDark ? 'dark' : 'light');
      themeToggleBtn.textContent = isDark ? '☀️ Hell' : '🌙 Dunkel';
    });

    // Hilfsfunktion: Google Kalender Links aktualisieren & Repository-Sichtbarkeit prüfen
    async function updateGcalLinks(rawUrl) {
      gcalUrlInput.value = rawUrl;
      const webcalUrl = rawUrl.replace(/^https?:\/\//i, 'webcal://');
      webcalLink.href = webcalUrl;
      gcalBox.style.display = 'block';

      // Prüfen ob das Repository öffentlich erreichbar ist
      try {
        const testRes = await fetch(rawUrl, { method: 'HEAD', cache: 'no-store' });
        if (testRes.status === 404 || testRes.status === 403) {
          privateWarning.style.display = 'block';
        } else {
          privateWarning.style.display = 'none';
        }
      } catch (e) {
        // Bei Netzwerkproblemen nicht blockieren
      }
    }

    // Wenn bereits ein gespeichertes GitHub Repo vorhanden ist, Link vorbereiten
    if (ghRepo && ghToken) {
      const cleanRepo = ghRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').trim();
      const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${ghBranch}/${ghPath}`;
      updateGcalLinks(rawUrl);
    }

    // --- EVENT LISTENERS ---
    renderSubjectList();

    searchInput.addEventListener('input', (e) => {
      renderSubjectList(e.target.value);
    });

    selectAllBtn.addEventListener('click', () => {
      distinctSubjects.forEach((s) => currentSelection[s] = true);
      savePreferences();
      renderSubjectList(searchInput.value);
    });

    selectNoneBtn.addEventListener('click', () => {
      distinctSubjects.forEach((s) => currentSelection[s] = false);
      savePreferences();
      renderSubjectList(searchInput.value);
    });

    includeModeCheckbox.addEventListener('change', () => {
      savePreferences();
    });

    [ghTokenInput, ghRepoInput, ghBranchInput, ghPathInput].forEach((input) => {
      input.addEventListener('input', savePreferences);
    });

    toggleGhSettingsBtn.addEventListener('click', () => {
      const isHidden = ghSettingsPanel.style.display === 'none';
      ghSettingsPanel.style.display = isHidden ? 'block' : 'none';
      toggleGhSettingsBtn.textContent = isHidden ? '▲ Zuklappen' : '⚙️ Einstellungen';
    });

    // Close Button & Escape & Backdrop Click
    overlay.querySelector('.hok-modal-close').addEventListener('click', closeModal);
    overlay.querySelector('#hok-footer-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);

    // Kopieren Button
    copyUrlBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(gcalUrlInput.value);
        copyUrlBtn.textContent = '✅ Kopiert!';
        setTimeout(() => copyUrlBtn.textContent = '📋 Kopieren', 2000);
      } catch (err) {
        gcalUrlInput.select();
        document.execCommand('copy');
        copyUrlBtn.textContent = '✅ Kopiert!';
        setTimeout(() => copyUrlBtn.textContent = '📋 Kopieren', 2000);
      }
    });

    // "URL kopieren & Google Kalender öffnen" Button
    openGcalBtn.addEventListener('click', async () => {
      const url = gcalUrlInput.value;
      try {
        await navigator.clipboard.writeText(url);
      } catch (err) {
        gcalUrlInput.select();
        document.execCommand('copy');
      }

      openGcalBtn.textContent = '✅ URL kopiert! Google Kalender öffnet...';
      setTimeout(() => {
        window.open('https://calendar.google.com/calendar/r/settings/addbyurl', '_blank');
        openGcalBtn.textContent = '🌐 URL kopieren & Google Kalender öffnen';
      }, 400);
    });

    // Download Button
    downloadBtn.addEventListener('click', () => {
      savePreferences();
      const filteredEvents = allEvents.filter((e) => currentSelection[e.subject]);
      if (filteredEvents.length === 0) {
        alert('Bitte wähle mindestens ein Fach aus.');
        return;
      }
      const ics = buildICalContent(filteredEvents, includeModeCheckbox.checked);
      triggerDownload(ics, ghPathInput.value.trim() || 'hok_vorlesungsplan.ics');
    });

    // GitHub Sync Button
    syncBtn.addEventListener('click', async () => {
      savePreferences();

      const filteredEvents = allEvents.filter((e) => currentSelection[e.subject]);
      if (filteredEvents.length === 0) {
        alert('Bitte wähle mindestens ein Fach aus.');
        return;
      }

      const token = ghTokenInput.value.trim();
      const repo = ghRepoInput.value.trim();
      const branch = ghBranchInput.value.trim() || 'main';
      const path = ghPathInput.value.trim() || 'hok_vorlesungsplan.ics';

      if (!token || !repo) {
        ghSettingsPanel.style.display = 'block';
        toggleGhSettingsBtn.textContent = '▲ Zuklappen';
        statusBox.className = 'hok-status-box hok-error';
        statusBox.innerHTML = '❌ Bitte trage dein <strong>GitHub Token</strong> und das <strong>Repository</strong> in den Einstellungen ein.';
        if (!token) ghTokenInput.focus();
        else ghRepoInput.focus();
        return;
      }

      // Ladezustand anzeigen
      syncBtn.disabled = true;
      downloadBtn.disabled = true;
      statusBox.className = 'hok-status-box hok-loading';
      statusBox.innerHTML = '⏳ Synchronisiere mit GitHub Repository...';

      try {
        const icsContent = buildICalContent(filteredEvents, includeModeCheckbox.checked);
        const result = await syncToGitHub(token, repo, branch, path, icsContent);

        const now = new Date();
        localStorage.setItem(STORAGE_KEYS.GH_LAST_SYNC, now.toISOString());
        footerStatus.textContent = 'Zuletzt synchronisiert: ' + now.toLocaleString('de-DE');

        statusBox.className = 'hok-status-box hok-info';
        statusBox.innerHTML = `✅ <strong>Erfolgreich mit GitHub synchronisiert!</strong> (${filteredEvents.length} Termine hochgeladen • Commit: <code>${result.commitSha}</code>)`;

        // Google Calendar Box aktualisieren & Repository-Sichtbarkeit prüfen
        updateGcalLinks(result.rawUrl);

      } catch (err) {
        statusBox.className = 'hok-status-box hok-error';
        statusBox.innerHTML = `❌ <strong>Fehler beim Synchronisieren:</strong> ${escapeHtml(err.message)}`;
      } finally {
        syncBtn.disabled = false;
        downloadBtn.disabled = false;
      }
    });
  }

  // --- BUTTON IN DAS HOK HEADER INTERFACE INJIZIEREN ---
  function injectExportButton() {
    const header = document.querySelector('h1');
    if (header && !document.getElementById('hok-ical-btn')) {
      const btn = document.createElement('button');
      btn.id = 'hok-ical-btn';
      btn.type = 'button';
      btn.innerHTML = '📅 Kalender Sync / Export';

      // Inline-Fallback Styling im HOK-Stil
      btn.style.marginLeft = '14px';
      btn.style.padding = '7px 14px';
      btn.style.backgroundColor = '#008E4D';
      btn.style.color = '#ffffff';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '0.85rem';
      btn.style.fontWeight = '600';
      
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openHokModal();
      });

      header.parentNode.appendChild(btn);
    }
  }

  // DOM Überwachung für dynamische Navigation in SPA
  injectStyles();
  injectExportButton();
  const observer = new MutationObserver(() => injectExportButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();