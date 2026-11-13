# Toolbox – PDF, Bilder & mehr 🧰

Eine 100% kostenlose, private und lokale Werkzeugkiste für PDFs, Bilder und E-Mail-Signaturen – für **macOS**, **Windows** und **iPadOS**. (Früherer Name: PDF Tool ForAll.)

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

### 🖼️ Bilder bearbeiten & unkenntlich machen
- Bild öffnen per Auswahl, Drag & Drop oder **Bildschirmfoto mit `Cmd+V` / `Strg+V` einfügen** (JPG, PNG, WebP, GIF, BMP, HEIC auf dem Mac).
- Bereiche mit **Rechteck, Ellipse oder Pinsel** markieren, verschieben und in der Größe ändern.
- Methoden: **Farbbalken**, **Verpixeln**, **Weichzeichnen** und **Milchglas** – mit Stärkeregler und Hinweis, ob die Einstellung sicher ist. **Umkehren** macht alles außerhalb des Bereichs unkenntlich.
- Zuschneiden, drehen, spiegeln, Größe ändern, Rückgängig/Wiederholen.
- Speichern **immer als Kopie** (PNG, JPEG, WebP) – ohne GPS-Position, Kameradaten und eingebettete Vorschau. Außerdem: in die Zwischenablage kopieren, als PDF speichern oder im PDF-Editor weiterbearbeiten.

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

## E-Mail-Signaturen

Öffne **E-Mail-Signaturen** im Hauptmenü. Wähle **Privat** oder **Geschäftlich** und gestalte die Signatur mit Text, Links, Logo und einem eigenen TextArt-Block. Unter **Layout bearbeiten** kannst du Blöcke ziehen oder mit den Pfeiltasten der Oberfläche verschieben und Texte pro Block formatieren. Entwürfe liegen in diesem Browser. Über **Projekt sichern** erhältst du eine bearbeitbare `.signatur.json` inklusive Grafiken und Formatierung. Diese Datei lässt sich über **Projekt oder Signatur öffnen** auch in einem anderen Browser laden. HTML- und Textdateien lassen sich als Ausgangspunkt importieren.

Unter **Im Mailprogramm einrichten** findest du den HTML- und Klartext-Export sowie Anleitungen für die einzelnen Programme. Prüfe Grafiken und Umbrüche mit einer Testmail.

**Apple Mail auf dem Mac:** Lade die `.eml` über **Für Apple Mail laden** herunter und öffne sie in Mail. Klicke in den Nachrichteninhalt, markiere ihn mit **⌘A** und kopiere ihn mit **⌘C**. Füge ihn unter **Mail → Einstellungen → Signaturen** mit **⌘V** ein. Deaktiviere dort die Anpassung an die Standardschrift, damit Mail die Schriftgestaltung übernimmt. Der Export bettet ein hochgeladenes Logo und TextArt in der jeweils eingestellten Größe ein. Auch der separate Grafikdownload verwendet die eingestellte Logogröße.

### Browser-App auf GitHub Pages

Wähle im Repository unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions**. Starte danach unter **Actions** den Workflow **Browser-App veröffentlichen** auf dem gewünschten Branch. Der Workflow baut die App für den Pages-Pfad. Ein lokaler Produktions-Build ist mit `npm run build -- --mode pages --base /PDF_Tool_ForAll/` möglich.
