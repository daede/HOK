# HOK Browser Extensions

A collection of lightweight Chrome / Chromium extensions for HOK (FH Kufstein Tirol) students to enhance the student portal and learning platform experience.

Eine Sammlung von schlanken Chrome / Chromium Erweiterungen für Studierende der HOK (FH Kufstein Tirol) zur Verbesserung der Portale und Lernplattformen.

---

**Languages / Sprachen:** [English](#english) • [Deutsch](#deutsch)

---

## English

### Overview

| Extension | Target Platform | Description |
| :--- | :--- | :--- |
| **HOK App iCal & Google Calendar Sync** | `https://app.hok.ac.at/*` | Exports and synchronizes timetable lectures with Google Calendar via GitHub or as an `.ics` file. |
| **HOK WebLearn Dark Mode** | `https://weblearn.fh-kufstein.ac.at/*`<br>`https://weblearn.hok.ac.at/*` | Complete dark mode theme and inverted logo for the Moodle / WebLearn platform. |

### HOK App iCal & Google Calendar Sync

Located in `Extensions/HOK App iCal & Google Calendar Sync Chrome Extension/`

#### Features

- **Automated Lecture Extraction**: Scrapes course dates, times, rooms, lecturers, groups, and course types (`[ILV]`, `[VO]`, `[Klausur]`, etc.) directly from the HOK timetable view.
- **Visual Status Emojis**: Assigns status icons to calendar entries:
  - 🔵 In-person lecture (*Präsenz*)
  - ⚪ Online / Virtual session (*Online*)
  - 🔴 Exam (*Klausur / Prüfung*)
  - 🟠 Postponed session (*Verschoben*)
  - 🟣 Excursion (*Exkursion*)
  - 🟢 Deadline / Submission (*Moodle / Abgabe*)
- **Subject Filtering**: Select or deselect specific courses via an interactive search and checklist. Selections are stored locally in the browser (`localStorage`).
- **Flexible Title Formatting**: Optional toggle to include course modes (e.g. `[ILV]`, `[VO]`) in event titles.
- **GitHub & Google Calendar Sync**:
  - Pushes generated `.ics` files directly to a designated GitHub repository via GitHub REST API (supports custom branches and subfolder paths, e.g., `ICS/hok_vorlesungsplan.ics`).
  - Provides a direct link and one-click button to subscribe to the calendar in Google Calendar (`webcal://` or via public raw GitHub URL).
- **Direct Download**: Export calendar events directly as a `.ics` file for offline use or manual import into Apple Calendar, Outlook, etc.
- **Dark & Light Mode**: Modal dialog includes a theme switch matching user preference.

#### Quick Setup

1. Open `https://app.hok.ac.at/` and navigate to your timetable view.
2. Click the green **📅 Kalender Sync / Export** button in the header.
3. Select which subjects to include.
4. *(Optional for Google Calendar sync)*: In **⚙️ Einstellungen**, provide:
   - A GitHub Personal Access Token (PAT) with `contents: write` permissions.
   - Your public GitHub repository (`owner/repo`), target branch, and optional file path.
5. Click **Mit GitHub synchronisieren** or **Als .ics Datei herunterladen**.

### HOK WebLearn Dark Mode

Located in `Extensions/HOK Moodle Dark Mode Chrome Extension/`

#### Features

- **Custom Dark Theme**: Re-styles the Moodle Boost Union interface with high-contrast, eye-friendly dark colors for courses, sidebars, cards, tables, forms, and popups.
- **Inverted HOK Logo**: Automatically swaps the standard dark logo for an inverted light version (`images/hok-logo-inverted.png`) when dark mode is enabled.
- **Footer Toggle**: Injects a clean toggle button (🌙 / ☀️) into the footer button bar.
- **Flicker-Free Loading**: Loads theme preferences immediately on `document_start` to eliminate white flash (FOUC) during page transitions.

### Installation

1. Clone or download this repository to your local machine.
2. Open Google Chrome (or Brave, Edge, Opera, etc.) and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** (*Entpackte Erweiterung laden*).
5. Browse to the `Extensions/` directory and select either extension folder.
6. The extension is now active and will run automatically on the supported pages.

---

## Deutsch

### Übersicht

| Erweiterung | Zielplattform | Beschreibung |
| :--- | :--- | :--- |
| **HOK App iCal & Google Calendar Sync** | `https://app.hok.ac.at/*` | Exportiert und synchronisiert den Vorlesungsplan via GitHub mit Google Kalender oder als `.ics`-Datei. |
| **HOK WebLearn Dark Mode** | `https://weblearn.fh-kufstein.ac.at/*`<br>`https://weblearn.hok.ac.at/*` | Vollständiges Dark-Mode-Design und invertiertes Logo für die Moodle / WebLearn Plattform. |

### HOK App iCal & Google Calendar Sync

Liegt im Ordner `Extensions/HOK App iCal & Google Calendar Sync Chrome Extension/`

#### Funktionen

- **Automatische Termin-Erkennung**: Liest Termine, Uhrzeiten, Räume, Dozierende, Gruppen und Lehrveranstaltungs-Typen (`[ILV]`, `[VO]`, `[Klausur]` usw.) direkt aus der HOK-Stundenplanansicht aus.
- **Kategorie- & Status-Emojis**: Kennzeichnet Termine übersichtlich im Kalender:
  - 🔵 Präsenz-Vorlesung
  - ⚪ Online / Virtueller Termin
  - 🔴 Klausur / Prüfung
  - 🟠 Verschobener Termin
  - 🟣 Exkursion
  - 🟢 Moodle-Deadline / Abgabefrist
- **Fächer-Filter**: Schnelle Suche und Checkboxen zum Ein- oder Ausschließen einzelner Fächer. Die Auswahl wird lokal im Browser (`localStorage`) gespeichert.
- **Titel-Anpassung**: Optionaler Schalter, um Modus-Kürzel wie `[ILV]` oder `[VO]` im Kalendertitel ein- oder auszublenden.
- **GitHub & Google Kalender Synchronisation**:
  - Lädt die generierte `.ics`-Kalenderdatei über die GitHub REST API automatisch in ein gewähltes GitHub-Repository hoch (inklusive Branch- und Unterordner-Unterstützung wie `ICS/hok_vorlesungsplan.ics`).
  - Stellt den direkten Abo-Link (`webcal://` und Raw-GitHub-URL) sowie eine 1-Klick-Weiterleitung zu Google Kalender bereit.
- **Direkter Download**: Schneller Export als `.ics`-Datei für den Offline-Gebrauch oder Apple Kalender, Outlook usw.
- **Dark- & Light-Mode**: Eigenes Modal-Fenster mit umschaltbarem Theme (Hell / Dunkel).

#### Schnellstart

1. `https://app.hok.ac.at/` öffnen und in die Vorlesungsansicht wechseln.
2. Auf den grünen Button **📅 Kalender Sync / Export** in der Kopfzeile klicken.
3. Gewünschte Fächer auswählen.
4. *(Optional für automatischen Google Kalender Sync)*: Unter **⚙️ Einstellungen** eintragen:
   - GitHub Personal Access Token (PAT) mit Schreibrechten (`contents: write`).
   - Öffentliches GitHub-Repository (`owner/repo`), Ziel-Branch und optionalen Dateipfad.
5. Auf **Mit GitHub synchronisieren** oder **Als .ics Datei herunterladen** klicken.

### HOK WebLearn Dark Mode

Liegt im Ordner `Extensions/HOK Moodle Dark Mode Chrome Extension/`

#### Funktionen

- **Individuelles Dark-Theme**: Passt die Moodle Boost-Union Oberfläche mit augenschonenden, kontrastreichen Farben für Kurse, Seitenleisten, Kacheln, Tabellen und Popups an.
- **Invertiertes HOK-Logo**: Ersetzt das standardmäßige dunkle Logo bei aktivem Dark Mode automatisch durch eine helle, invertierte Variante (`images/hok-logo-inverted.png`).
- **Footer-Umschalter**: Fügt einen diskreten Button (🌙 / ☀️) in die Leiste der Fußzeile ein.
- **Kein weißes Aufblitzen**: Die Design-Einstellung wird unmittelbar bei `document_start` geladen, um weiße Flashes (FOUC) beim Laden neuer Seiten zu verhindern.

### Installation

1. Dieses Repository auf den Computer herunterladen oder klonen.
2. In Google Chrome (oder Brave, Edge, Opera etc.) `chrome://extensions/` in die Adresszeile eingeben.
3. Oben rechts den Schalter **Entwicklermodus** aktivieren.
4. Auf **Entpackte Erweiterung laden** klicken.
5. In das Verzeichnis `Extensions/` navigieren und den jeweiligen Erweiterungs-Ordner auswählen.
6. Die Erweiterung ist sofort einsatzbereit und wird auf den entsprechenden Webseiten automatisch geladen.