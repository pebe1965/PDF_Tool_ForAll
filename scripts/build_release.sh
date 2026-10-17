#!/usr/bin/env bash
set -e

# Change to project root directory
cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"

echo "=================================================="
echo "🔨 Erstelle Release-Pakete fuer PDF Tool ForAll"
echo "=================================================="

# Use local node if available
if ! command -v node &> /dev/null; then
    export PATH="$PROJECT_DIR/.tools/bin:$PATH"
fi

# 1. Frontend kompilieren
echo "📦 1. Kompiliere Web-Assets (npm run build)..."
npm run build

# 2. macOS .app Bundle erstellen
echo "🍏 2. Erstelle macOS PDF_Tool_ForAll.app..."
APP_BUNDLE="$PROJECT_DIR/PDF_Tool_ForAll.app"
rm -rf "$APP_BUNDLE"

mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources/app"

# Info.plist schreiben
cat << 'EOF' > "$APP_BUNDLE/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.pebe.pdftoolforall</string>
    <key>CFBundleName</key>
    <string>PDF Tool ForAll</string>
    <key>CFBundleDisplayName</key>
    <string>PDF Tool ForAll</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.3.0</string>
    <key>CFBundleVersion</key>
    <string>1.3.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# MacOS Launcher schreiben
cat << 'EOF' > "$APP_BUNDLE/Contents/MacOS/launcher"
#!/bin/bash
DIR="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
cd "$DIR"

PY_CMD=""
for p in /usr/bin/python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 $(which python3 2>/dev/null); do
    if [ -x "$p" ]; then
        PY_CMD="$p"
        break
    fi
done

if [ -z "$PY_CMD" ]; then
    osascript -e 'display dialog "Python 3 wurde auf diesem Mac nicht gefunden." buttons {"OK"} default button "OK" with icon stop'
    exit 1
fi

exec "$PY_CMD" server.py
EOF

chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

# Icon kopieren
if [ -f "$PROJECT_DIR/resources/AppIcon.icns" ]; then
    cp "$PROJECT_DIR/resources/AppIcon.icns" "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
fi

# App-Dateien kopieren
cp -r "$PROJECT_DIR/dist" "$APP_BUNDLE/Contents/Resources/app/"
cp "$PROJECT_DIR/server.py" "$APP_BUNDLE/Contents/Resources/app/"

# 3. macOS .dmg erstellen
echo "💿 3. Erstelle macOS Disk Image (PDF_Tool_ForAll.dmg)..."
DMG_STAGING="/tmp/dmg_staging_pdftool_$$"
rm -rf "$DMG_STAGING" "$PROJECT_DIR/PDF_Tool_ForAll.dmg"
mkdir -p "$DMG_STAGING"

cp -R "$APP_BUNDLE" "$DMG_STAGING/"
ln -s /Applications "$DMG_STAGING/Applications"

hdiutil create -volname "PDF Tool ForAll" -srcfolder "$DMG_STAGING" -ov -format UDZO "$PROJECT_DIR/PDF_Tool_ForAll.dmg"
rm -rf "$DMG_STAGING"

# 4. Windows .zip Release-Paket erstellen
echo "🪟 4. Erstelle Windows Release-Paket (PDF_Tool_ForAll_Windows.zip)..."
WIN_STAGING="/tmp/win_staging_pdftool_$$"
rm -rf "$WIN_STAGING" "$PROJECT_DIR/PDF_Tool_ForAll_Windows.zip"
mkdir -p "$WIN_STAGING"

cp -r "$PROJECT_DIR/dist" "$WIN_STAGING/"
cp "$PROJECT_DIR/server.py" "$WIN_STAGING/"
cp "$PROJECT_DIR/PDF_Tool_Windows.bat" "$WIN_STAGING/"

# Info-Datei fuer Windows Nutzer
cat << 'EOF' > "$WIN_STAGING/README.txt"
PDF Tool ForAll — Kostenlos, Lokal & Sicher
===========================================

ANLEITUNG FUER WINDOWS:
1. Doppelklicke auf "PDF_Tool_Windows.bat"
2. Das Tool oeffnet sich automatisch in deinem Standard-Browser (z. B. Edge / Chrome)
3. Viel Spass beim Bearbeiten, Signieren und Zusammenfuehren von PDFs!

TIPP: Du kannst in Microsoft Edge oder Chrome oben in der Adressleiste auf "App installieren" klicken, um das Tool wie ein eigenstaendiges Desktop-Programm im Startmenue und der Taskleiste zu nutzen.
EOF

(cd "$WIN_STAGING" && zip -rq "$PROJECT_DIR/PDF_Tool_ForAll_Windows.zip" .)
rm -rf "$WIN_STAGING"

echo "=================================================="
echo "✅ Fertig! Folgende Release-Dateien wurden erstellt:"
echo "   🍏 macOS App:     PDF_Tool_ForAll.app"
echo "   💿 macOS DMG:     PDF_Tool_ForAll.dmg"
echo "   🪟 Windows ZIP:   PDF_Tool_ForAll_Windows.zip"
echo "=================================================="
