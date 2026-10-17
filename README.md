# PDF Tool ForAll — Business Suite 📄✍️🏢

Ein 100% kostenloses, privates und lokales PDF-Werkzeug für **macOS**, **Windows** und **iPadOS**.

Keine Abonnements, kein Cloud-Upload für lokale PDF-Bearbeitung, keine Limits.

---

## 📥 Download & Installation

Die fertigen Pakete findest du immer unter **[GitHub Releases](https://github.com/pebe1965/PDF_Tool_ForAll/releases)**.

### 🍏 Für macOS
1. Lade die Datei **`PDF_Tool_ForAll.dmg`** herunter.
2. Öffne das Disk Image und ziehe **`PDF_Tool_ForAll.app`** in deinen **Programme**-Ordner (`/Applications`).
3. Starte die App wie jedes normale Mac-Programm!

### 🪟 Für Windows
1. Lade das Archiv **`PDF_Tool_ForAll_Windows.zip`** herunter.
2. Entpacke die ZIP-Datei in einen beliebigen Ordner.
3. Starte das Tool mit einem Doppelklick auf **`PDF_Tool_Windows.bat`**.
4. Es öffnet sich automatisch in deinem Standardbrowser (z. B. Edge oder Chrome).
   - *Tipp:* Klicke in Edge/Chrome in der Adressleiste auf **„App installieren“**, um das Tool mit eigenem Icon im Startmenü und der Taskleiste wie ein natives Programm zu verankern.

### 📱 Für iPad & Tablets
1. Starte das Tool auf deinem Mac oder Windows-Rechner im selben WLAN.
2. Öffne die lokale URL in Safari auf dem iPad.
3. *Tipp:* Tippe auf das Teilen-Symbol und wähle **„Zum Home-Bildschirm“** — das Tool lässt sich dann im Vollbildmodus inklusive Apple-Pencil-Unterstützung für Unterschriften und Freihand-Zeichnungen nutzen!

---

## 🌟 Funktionen im Überblick (Business Suite v1.2.0)

### 1. ✍️ Bearbeiten, Stempeln, Schwärzen & Signieren
- **Freie Textfelder & Typografie-Engine**:
  - Text an beliebiger Stelle einfügen, verschieben und über Ecken-Anfasser in der Breite anpassen.
  - Automatischer Zeilenumbruch mit mitwachsender Höhe und Erkennung von Überschriften (`H1`, `H2`, Aufzählungen).
  - Schriftarten (`Sans`, `Serif`, `Mono`) in Normal, Fett oder Kursiv, Farben und Hintergrundoptionen (**Deckweiß** zum Überdecken alter Inhalte oder **Gelb** für Notizen).
- **Firmen- & Büro-Stempelkasten**:
  - Vorgefertigte & eigene Stempel (`FREIGEGEBEN`, `BEZAHLT`, `GEPRÜFT`, `EINGEGANGEN`, `VERTRAULICH`, `ABGELEHNT`, `ENTWURF`, `KOPIE`) mit **automatischem Tagesdatum** und eigenem **Namens-/Abteilungskürzel**.
- **Textmarker, Symbole & Formen**:
  - Halbtransparenter **Textmarker** (Gelb, Grün, Pink, Blau).
  - 1-Klick-Prüfsymbole (**Häkchen ✓**, **Kreuzchen ✗**, Rahmen, Kreis, Pfeil) sowie **Freihand-Stift**.
- **Echte DSGVO-Schwärzung (Redaction)**:
  - Sensible Daten (IBAN, Namen, Gehälter) mit Schwärzungsbalken abdecken — beim PDF-Export wird die betroffene Seite hochauflösend gerastert, sodass darunterliegender Text **unwiderruflich aus dem PDF-Code entfernt** ist.
- **Ausfüllbare PDF-Formulare (AcroForms)**:
  - Erkennt interaktive Formularfelder (Textfelder, Checkboxen, Dropdowns) automatisch, lässt sie direkt ausfüllen und auf Wunsch **schreibgeschützt einbrennen (Flatten)**.
- **Seitenzahlen, Bates-Nummerierung, Kopf-/Fußzeile & Wasserzeichen**:
  - Automatische Seitennummerierung (`Seite 1 von N`, `Bates #000001`), Kopf-/Fußzeilen und diagonale **Wasserzeichen** (`VERTRAULICH`, `ENTWURF`, `MUSTER`) über alle Seiten.
- **Unterschriften (Signatur)** & **Bilder / Screenshots (`Cmd+V` / `Strg+V`)**.
- **Undo / Redo (`Cmd+Z` / `Cmd+Shift+Z`)**, **Volltextsuche (`Cmd+F`)** sowie **Auto-Save (IndexedDB)** und Export/Import als bearbeitbare **`.pdftool`-Projektdatei**.

### 2. 📑 Zusammenführen & Sortieren (PDFs & Bilder)
- **PDFs & Bilder (`.png`, `.jpg`, `.webp`) vereinen**: Auch abfotografierte Belege oder Screenshots werden automatisch in DIN-A4-Seiten umgewandelt.
- **Drag & Drop Sortierung**: Seitenkacheln direkt mit der Maus umsortieren.
- **Stapel-Aktionen (Mehrfachauswahl)**: Mehrere Seiten gleichzeitig auswählen, drehen oder löschen.

### 3. 🛠️ Werkzeuge & Business
- **PDF Teilen & Stapel-Trennung (Split & Burst)**:
  - Nach Seitenbereichen (`1-3, 4-6, 7-Ende`) oder automatisch alle $N$ Seiten (z. B. Sammel-Scans/Rechnungen) in Einzel-PDFs aufteilen.
- **PDF Komprimieren (Dateigröße reduzieren)**:
  - Große Scans in 3 Qualitätsstufen (`Kompakt < 2,8 MB`, `Standard Büro 150 DPI`, `Hohe Qualität 220 DPI`) verkleinern.
- **E-Rechnung Prüfer (ZUGFeRD / Factur-X / XRechnung)**:
  - Erkennt und liest eingebettete XML-Rechnungsdaten (`CrossIndustryInvoice` & `UBL`) aus PDF-Rechnungen aus, zeigt alle Rechnungspositionen tabellarisch an und exportiert sie nach **Excel (`.csv`)** oder `.xml`.
- **Vertrags- & Dokumentenvergleich (PDF-Diff)**:
  - Vergleicht zwei PDF-Versionen (`Alt` vs. `Neu`) zeilenweise (Rot/Grün) sowie optional per **Gemini KI-Vertragsvergleich**.
- **PDF ➔ Bilder Export (`PNG`/`JPEG`) & Metadaten-Bereinigung (Sanitizer)**:
  - Versteckte Metadaten (Autor, Programm, Stichwörter) einsehen oder mit 1 Klick vor dem Versand restlos löschen.

### 4. ✨ Gemini KI-Assistent (über NotionaryAtlas)
- **Zusammenfassung**, **Rechtschreib-/Grammatikprüfung**, **Fachübersetzung**, **Text & Vertragsklauseln generieren** und **PDF-Chat**.
- **Neu: Rechnungs- & Tabellen-Extraktor (➔ Excel / CSV)** sowie **DSGVO- & Vertragsrisiko-Audit**.

---

## 🛠️ Für Entwickler / Releases bauen

```bash
# Release-Build starten:
./scripts/build_release.sh
```

Dies erzeugt:
- `PDF_Tool_ForAll.app` (macOS App Bundle)
- `PDF_Tool_ForAll.dmg` (macOS Installations-Image)
- `PDF_Tool_ForAll_Windows.zip` (Windows Komplettpaket)
