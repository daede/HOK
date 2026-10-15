(function() {
  'use strict';

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

  function parseDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})/);
    if (!match) return null;
    return `${match[3]}${MONTH_MAP[match[2].toLowerCase()] || '01'}${match[1].padStart(2, '0')}`;
  }

  function parseTime(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return `${match[1].padStart(2, '0')}${match[2]}00`;
  }

  function escapeICal(str) {
    if (!str) return '';
    return str.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
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

  function extractEventsFromDOM() {
    const dateHeaders = Array.from(document.querySelectorAll('.text-green, [class*="text-green"]'));
    const cards = Array.from(document.querySelectorAll('.flex'));

    const allNodes = [...dateHeaders, ...cards].sort((a, b) => {
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });

    let currentDateText = '';
    let exportedEvents = [];
    
    // Zähler für die stabile UID-Generierung pro Fach
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

      // --- DETERMINISTISCHE UID BILDEN (UNABHÄNGIG VOM DATUM) ---
      const titleSlug = rawTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20);
      const groupSlug = group.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10) || 'all';
      const courseKey = `${groupSlug}-${titleSlug}`;

      // Hochzählen, der wievielte Termin dieses Faches es ist
      courseCounters[courseKey] = (courseCounters[courseKey] || 0) + 1;
      const sessionIndex = courseCounters[courseKey];

      // UID ist z. B. hok-vz2024-webdev-session3@app.hok.ac.at
      const uid = `hok-${courseKey}-session${sessionIndex}@app.hok.ac.at`;

      const emoji = getEmoji(node, mode);
      const formattedTitle = mode ? `${emoji} [${mode}] ${rawTitle}` : `${emoji} ${rawTitle}`;

      let descriptionParts = [];
      if (mode) descriptionParts.push(`Modus: ${mode}`);
      if (group) descriptionParts.push(`Gruppe: ${group}`);
      if (lecturer) descriptionParts.push(`Dozent: ${lecturer}`);
      if (location) descriptionParts.push(`Raum: ${location}`);

      exportedEvents.push({
        uid,
        dtStart: `${formattedDate}T${parsedStartTime}`,
        dtEnd: `${formattedDate}T${parsedEndTime}`,
        title: formattedTitle,
        location,
        mode,
        description: descriptionParts.join(' | ')
      });
    });

    return exportedEvents;
  }

  function exportToICal() {
    const events = extractEventsFromDOM();

    if (!events || events.length === 0) {
      alert('Keine gültigen Termine auf der Seite gefunden.');
      return;
    }

    const nowFormatted = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    let icsEvents = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HOK App iCal Exporter//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    events.forEach((evt) => {
      icsEvents.push(
        'BEGIN:VEVENT',
        `UID:${evt.uid}`,
        `DTSTAMP:${nowFormatted}`,
        `DTSTART:${evt.dtStart}`,
        `DTEND:${evt.dtEnd}`,
        `SUMMARY:${escapeICal(evt.title)}`,
        `LOCATION:${escapeICal(evt.location)}`,
        `CATEGORIES:${escapeICal(evt.mode || 'Vorlesung')}`,
        `DESCRIPTION:${escapeICal(evt.description)}`,
        'END:VEVENT'
      );
    });

    icsEvents.push('END:VCALENDAR');

    const blob = new Blob([icsEvents.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hok_vorlesungsplan.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function injectExportButton() {
    const header = document.querySelector('h1');
    if (header && !document.getElementById('hok-ical-btn')) {
      const btn = document.createElement('button');
      btn.id = 'hok-ical-btn';
      btn.innerText = '📅 iCal Export';
      btn.style.marginLeft = '15px';
      btn.style.padding = '6px 12px';
      btn.style.backgroundColor = '#008E4D';
      btn.style.color = '#ffffff';
      btn.style.border = 'none';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.fontSize = '0.85rem';
      btn.style.fontWeight = '600';
      
      btn.addEventListener('click', exportToICal);
      header.parentNode.appendChild(btn);
    }
  }

  const observer = new MutationObserver(() => injectExportButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();