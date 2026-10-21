### Was ist neu in v1.12.2:

- **Perfekte Zentrierung & Kein Abschneiden mehr**: Behebung eines WebKit-Rendering-Problems bei TextArt, bei dem lange Schriftzüge nach rechts verschoben und abgeschnitten wurden. Schriften bleiben nun bei jeder Schriftgröße (selbst bei 180+ px) exakt zentriert und zu 100 % sichtbar.
- **Vollständige Buchstaben bei Mehrzeilern**: Dynamische Berechnung der Gesamthöhe und vertikalen Ränder, sodass die oberen Balken von Großbuchstaben (z. B. bei `T`, `O`, `N`, `A`) in mehrzeiligen Schriftzügen niemals mehr oben beschnitten werden.
- **Proportionale Skalierung im PDF-Dokument**: Beim Vergrößern der TextArt-Box über die Ziehpunkte auf der PDF-Seite skaliert der Text nun direkt proportional mit, füllt den gesamten verfügbaren Bereich optimal aus und verhindert leere weiße Rahmen.
- **Sauberer 3D-Extrusionsschatten**: Umstellung der Schattenverschiebung auf echte Koordinaten-Transformationen für gestochen scharfe Kanten ohne Zeichen-Überlappung.

### Installation

- **macOS**: DMG-Datei herunterladen, öffnen und „PDF Tool ForAll“ in den Ordner „Programme“ ziehen.
- **Windows**: ZIP-Datei entpacken und `PDF_Tool_Windows.bat` per Doppelklick starten.
