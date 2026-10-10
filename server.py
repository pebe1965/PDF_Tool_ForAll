#!/usr/bin/env python3
"""
PDF Tool ForAll — Lokaler Produktions-Server
Startet die Anwendung ohne externe Abhängigkeiten auf macOS und Windows.
"""

import os
import sys
import socket
import webbrowser
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"

def find_free_port(preferred_ports=(5173, 8080, 8000)):
    for port in preferred_ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('127.0.0.1', port))
                return port
            except OSError:
                continue
    # Let OS assign random free port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class SinglePageAppHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST_DIR), **kwargs)

    def log_message(self, format, *args):
        # Quiet terminal logging
        pass

    def end_headers(self):
        # Enable CORS and caching headers
        self.send_header('Cache-Control', 'no-cache, must-revalidate')
        super().end_headers()

    def do_GET(self):
        # SPA routing: if path doesn't point to an existing file, serve index.html
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = "/index.html"
        return super().do_GET()

def main():
    if not DIST_DIR.exists() or not (DIST_DIR / "index.html").exists():
        print("❌ Das 'dist'-Verzeichnis wurde nicht gefunden.")
        print("Bitte führe zuerst './start.sh' oder 'npm run build' aus.")
        sys.exit(1)

    port = find_free_port()
    url = f"http://localhost:{port}"

    server = ThreadingHTTPServer(('127.0.0.1', port), SinglePageAppHandler)
    print("=" * 60)
    print("🚀 PDF Tool ForAll — Lokale Desktop-Engine läuft!")
    print(f"🌐 Geöffnet auf: {url}")
    print("🔒 100 % lokal, ohne Cloud & ohne Datenübertragung.")
    print("Drücke [Ctrl + C] im Terminal, um das Tool zu beenden.")
    print("=" * 60)

    # Automatically open browser
    try:
        webbrowser.open(url)
    except Exception:
        pass

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 PDF Tool ForAll beendet. Auf Wiedersehen!")
        server.server_close()

if __name__ == "__main__":
    main()
