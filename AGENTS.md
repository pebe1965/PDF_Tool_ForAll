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

## 3. Vor jedem Release

1. `APP_VERSION` in `src/config.ts` und die Versionen in
   `scripts/build_release.sh` (Info.plist) auf die neue Version setzen —
   die Update-Prüfung vergleicht sie mit dem GitHub-Tag.
2. `./scripts/build_release.sh`
3. Prüfen, dass kein Schlüssel im Paket steckt:
   `grep -rE "AIza[0-9A-Za-z_-]{30,}|QUl6YVN5" dist/ && echo "SCHLÜSSEL GEFUNDEN – NICHT VERÖFFENTLICHEN"`
4. Release auf GitHub mit Tag `vX.Y.Z` und den Dateien `PDF_Tool_ForAll.dmg`
   und `PDF_Tool_ForAll_Windows.zip`. Der Marketplace zeigt es automatisch an
   (Dateinamen beibehalten: `.dmg` = macOS, `…Windows….zip` = Windows).
