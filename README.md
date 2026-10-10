# PDF Tool ForAll 📄✍️

Ein 100% kostenloses, privates und lokales PDF-Werkzeug für **macOS**, **Windows** und **iPadOS**.

Keine Abonnements, kein Cloud-Upload, keine Limits.

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
2. Das Tool zeigt dir beim Start (und in den Netzwerkinformationen) die IP-Adresse an (z. B. `http://192.168.178.xxx:8000`).
3. Öffne diese URL in Safari auf dem iPad.
4. *Tipp:* Tippe auf das Teilen-Symbol und wähle **„Zum Home-Bildschirm“** — das Tool lässt sich dann im Vollbildmodus inklusive Apple-Pencil-Unterstützung für Unterschriften nutzen!

---

## 🔄 Automatische Update-Erkennung

Das Tool verfügt über eine integrierte GitHub-Update-Erkennung:
- Sobald auf GitHub ein neues Release (`v1.0.1`, `v1.1.0`, etc.) veröffentlicht wird, erscheint im Header ein grüner Hinweis **„Update verfügbar: v...“**.
- Mit einem Klick darauf öffnen sich die Versionshinweise und direkte Download-Links für macOS und Windows.

---

## 🌟 Funktionen im Überblick

### 1. ✍️ Bearbeiten & Signieren
- **Freie Textfelder**:
  - Text an beliebiger Stelle einfügen, verschieben und über Ecken-Anfasser in der Breite anpassen.
  - Automatischer Zeilenumbruch mit mitwachsender Höhe.
  - Schriftarten-Auswahl: Standard (Sans), Serif (Times), Monospace (Courier) in Normal, Fett oder Kursiv.
  - Schriftgröße, Schriftfarbe und Hintergrundoptionen (z. B. Deckweiß zum Überdecken / Korrigieren alter Inhalte oder Gelb für Notizen).
  - Textfeld-Duplizierung mit einem Klick.
- **Unterschriften (Signatur)**:
  - Direktes Zeichnen mit Touchpad, Maus oder Apple Pencil.
  - Unterschriften als Stempel abspeichern und wiederverwenden.
  - Frei skalierbar und verschiebbar.
- **Neues leeres Dokument**: Ein komplett neues leeres PDF (z. B. als Notizblatt oder Formular) erstellen.
- **Neue leere Seiten einfügen**: Über die Seitenleiste können jederzeit neue weiße Seiten an beliebiger Stelle hinzugefügt werden.
- **Eigener Dateiname**: Vor dem Speichern kann ein individueller Dateiname vergeben werden.

### 2. 📑 Zusammenführen & Organisieren
- **Mehrere PDFs vereinen**: Beliebig viele PDFs per Drag & Drop reinziehen.
- **Automatische Synchronisation**: PDFs, die im Editor geöffnet wurden, können direkt in den Zusammenführen-Tab übernommen werden und umgekehrt.
- **Seiten anordnen**: Seiten mit Pfeiltasten nach links oder rechts verschieben.
- **Seiten drehen**: Um 90° im Uhrzeigersinn drehen.
- **Seiten löschen**: Einzelne Seiten entfernen.
- **Benannter Export**: Individueller Dateiname beim Zusammenführen.

---

## 🔒 100 % Datenschutz & DSGVO-konform
Sämtliche PDF-Verarbeitungen finden **ausschließlich im lokalen Arbeitsspeicher deines Geräts** statt. Keine Dateien werden je über ein Netzwerk oder an externe Cloud-Server gesendet.

---

## 🛠️ Für Entwickler / Releases bauen

Um aus dem Quellcode die Distributionspakete neu zu erstellen:

```bash
# Release-Build starten:
./scripts/build_release.sh
```

Dies erzeugt:
- `PDF_Tool_ForAll.app` (macOS App Bundle)
- `PDF_Tool_ForAll.dmg` (macOS Installations-Image)
- `PDF_Tool_ForAll_Windows.zip` (Windows Komplettpaket)
