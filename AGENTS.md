# Regeln für KI-Assistenten (Gemini/Antigravity, Claude, …)

Dieses Tool wird öffentlich auf GitHub veröffentlicht und als DMG/ZIP
heruntergeladen. **Alles, was im Code oder im Paket steht, ist öffentlich.**

## 1. Niemals einen API-Schlüssel einbauen

- Kein Gemini-, Google- oder sonstiger Schlüssel in `src/`, `dist/`, `server.py`,
  Build-Skripten oder Paketen — **auch nicht Base64-kodiert, verschleiert oder
  „nur als Standardwert“**. Base64 ist keine Verschlüsselung.
- Hintergrund: Bis Version 1.0.0 stand hier ein Schlüssel Base64-kodiert in
  `src/config.ts` („damit Google ihn nicht automatisch sperrt“). Es war der
  Produktionsschlüssel von NotionaryAtlas und einer Firmen-App. Er musste am
  11.10.2026 gelöscht und in allen Apps ersetzt werden.

## 2. KI läuft über NotionaryAtlas

- Alle KI-Aufrufe gehen über **eine** Funktion: `callGeminiApi()` in
  `src/lib/geminiService.ts`. Keine zweite Stelle, die Gemini direkt aufruft.
- Standardweg: Der Nutzer erstellt im Marketplace von NotionaryAtlas
  (https://app.pberthold.com/marketplace) einen **Zugangscode** (`na_…`) und
  trägt ihn unter Einstellungen → KI ein. Die Anfrage geht im Format von
  Geminis `generateContent` an `APP_KI_URL` (`src/config.ts`) mit
  `Authorization: Bearer <Zugangscode>`. Die App reicht sie mit ihrem eigenen
  Schlüssel weiter und rechnet über die KI-Credits ab.
- Optional darf der Nutzer **seinen eigenen** Gemini-Schlüssel eintragen
  (bleibt in seinem `localStorage`). Einen Schlüssel *mitliefern* darf das
  Tool nie.
- Was die App annimmt: Text, PDF- und Bild-Anhänge, `systemInstruction`,
  `generationConfig` (max. 8192 Ausgabe-Tokens). **Höchstens 4 MB je Anfrage**
  (PDF-Anhänge über die App daher bis 2,8 MB, Konstante
  `MAX_PDF_BYTES_UEBER_APP`). Modell, Werkzeuge (Websuche) und
  Sicherheitsfilter bestimmt die App — Felder dafür werden ignoriert.
- Fehler kommen als `{ error: { message } }` zurück: 401/403 Code ungültig
  oder widerrufen, 402 keine Credits, 429 zu viele Anfragen (120 je Stunde).

## 3. Release — immer vollständig, in dieser Reihenfolge

Ein Release ist erst fertig, wenn **alle** Schritte erledigt sind —
einschließlich der Texte im Marketplace (Schritt 5 und 8). Nicht nach dem
Hochladen aufhören.

Wie das Programm im Marketplace von NotionaryAtlas erscheint:

| Was | Woher | Wer aktualisiert |
| --- | --- | --- |
| Version, Datum, Versionshinweise, Download-Knöpfe | neuestes GitHub-Release | automatisch (bis zu 10 min Verzögerung) |
| Beschreibung, Funktionsliste, Voraussetzungen | `marketplace.json` in diesem Repo → Datenbank der App | **du**, Schritt 5 und 8 |

Bis 17.10.2026 wurde Schritt 5/8 vergessen: v1.3.2 stand im Marketplace mit
der Funktionsliste von v1.1.0.

1. **Version festlegen** (`X.Y.Z`: Fehlerbehebung → Z+1, neue Funktion →
   Y+1) und **überall gleich** eintragen:
   - `APP_VERSION` in `src/config.ts`
   - `CFBundleShortVersionString` **und** `CFBundleVersion` in
     `scripts/build_release.sh` (dort steht die Info.plist)
   Die Update-Prüfung im Programm vergleicht `APP_VERSION` mit dem
   GitHub-Tag — stimmen sie nicht überein, meldet das Programm ewig ein
   Update oder nie eines. (`version` in `src/lib/projectStorage.ts` ist das
   Format der Projektdatei, nicht die App-Version — nur ändern, wenn sich das
   Format ändert.)
2. **Bauen:** `./scripts/build_release.sh` (enthält `npm run build`). Bricht
   etwas ab, zuerst beheben — nie ein altes Paket hochladen.
3. **Kein Schlüssel im Paket:**
   `grep -rE "AIza[0-9A-Za-z_-]{30,}|QUl6YVN5" dist/ PDF_Tool_ForAll.app && echo "SCHLÜSSEL GEFUNDEN – NICHT VERÖFFENTLICHEN"`
   — darf nichts ausgeben.
4. **Versionshinweise** auf Deutsch, für Nutzer (keine Dateinamen oder
   Code-Begriffe ohne Erklärung), Format:
   `### Was ist neu in vX.Y.Z:` + Stichpunkte; bei neuen Funktionen zusätzlich
   `### Installation` (macOS: DMG öffnen, App in „Programme“ ziehen; Windows:
   ZIP entpacken, `PDF_Tool_Windows.bat` doppelklicken).
5. **`marketplace.json` aktualisieren** — bei jedem Release prüfen, bei jeder
   neuen oder geänderten Funktion anpassen:
   - `description` (40–400 Zeichen): ein bis zwei Sätze, was das Programm
     insgesamt kann. Keine Versionsnummer — die zeigt der Marketplace selbst.
   - `integrations` (1–8 Einträge, je `module` 2–40 Zeichen und
     `description` 10–240 Zeichen): die wichtigsten Funktionsbereiche des
     **gesamten** Programms, nicht nur die Neuerungen. Neues in einen
     passenden Bereich einarbeiten oder einen Bereich ergänzen; bei mehr als
     acht zusammenfassen. Weggefallenes streichen.
   - `requirements` (1–6 Einträge): nur ändern, wenn sich Voraussetzungen
     ändern (Betriebssystem, Python, …).
   - `slug` und `github_repo` **nie** ändern.
   - Deutsch, Nutzersprache, kein Markdown, keine Emojis. Die Datei ist
     öffentlich — nichts Geheimes hinein.
6. **Commit und Push** auf `main` (Code + `marketplace.json` zusammen), dann
   Tag: `git tag vX.Y.Z && git push origin main vX.Y.Z`.
7. **GitHub-Release** — veröffentlicht, kein Entwurf, keine Vorabversion
   (der Marketplace und die Update-Prüfung lesen nur `releases/latest`):
   ```bash
   gh release create vX.Y.Z PDF_Tool_ForAll.dmg PDF_Tool_ForAll_Windows.zip \
     --title "PDF Tool ForAll vX.Y.Z — <kurzer Titel>" --notes-file <hinweise.md>
   ```
   **Genau diese zwei Dateien mit genau diesen Namen.** `.dmg` = macOS,
   `…Windows….zip` = Windows (der Marketplace erkennt die Plattform am
   Namen). Keine weitere `.zip` anhängen: Das 1-Klick-Update in `server.py`
   nimmt die erste `.zip` und erwartet darin `dist/index.html`.
8. **Marketplace-Texte übernehmen** (Probelauf, dann speichern):
   ```bash
   node ~/Developer/pberthold-app/scripts/marketplace-desktop-text.mjs ~/Developer/PDF_Tool_ForAll
   node ~/Developer/pberthold-app/scripts/marketplace-desktop-text.mjs ~/Developer/PDF_Tool_ForAll --schreiben
   ```
   Das Skript prüft die Datei, zeigt die Unterschiede und schreibt in die
   Datenbank der App — sofort sichtbar, **kein Deploy nötig**. Es liest den
   Datenbank-Schlüssel aus `~/Developer/pberthold-app/.env.local`; dafür
   braucht der Befehl Zugriff außerhalb dieses Ordners (Sandbox ggf.
   umgehen). **Diesen Schlüssel nie in dieses Repo kopieren**, nie ausgeben.
   Meldet das Skript einen Fehler, `marketplace.json` korrigieren und
   wiederholen.
9. **Kontrolle:** `gh release view vX.Y.Z --json tagName,isDraft,isPrerelease,assets`
   — Tag stimmt, beide Dateien da, kein Entwurf. Erneuter Probelauf aus
   Schritt 8 meldet „bereits aktuell“.

**Im Repo `pberthold-app` (NotionaryAtlas) sonst nichts ändern und dort nie
committen oder pushen** — jeder Push dort löst einen kostenpflichtigen Build
aus, und für ein Release ist keiner nötig.
