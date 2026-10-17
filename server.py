#!/usr/bin/env python3
"""
PDF Tool ForAll — Lokaler Produktions-Server
Startet die Anwendung ohne externe Abhängigkeiten auf macOS und Windows.
"""

import os
import sys
import json
import shutil
import socket
import zipfile
import tempfile
import webbrowser
import urllib.request
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = Path(__file__).resolve().parent
DIST_DIR = BASE_DIR / "dist"
GITHUB_RELEASE_API = "https://api.github.com/repos/pebe1965/PDF_Tool_ForAll/releases/latest"

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

    def _send_json(self, status_code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path == "/api/self-update":
            try:
                req = urllib.request.Request(
                    GITHUB_RELEASE_API,
                    headers={"Accept": "application/vnd.github.v3+json", "User-Agent": "PDF-Tool-ForAll-Updater"}
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    release_data = json.loads(resp.read().decode("utf-8"))

                tag_name = release_data.get("tag_name", "").lstrip("vV")
                assets = release_data.get("assets", [])
                zip_url = None
                for asset in assets:
                    name = asset.get("name", "").lower()
                    if name.endswith(".zip"):
                        zip_url = asset.get("browser_download_url")
                        break

                if not zip_url:
                    self._send_json(400, {"ok": False, "error": "Kein Update-Archiv (.zip) im GitHub Release gefunden."})
                    return

                with tempfile.TemporaryDirectory() as tmpdir:
                    tmp_path = Path(tmpdir)
                    zip_file_path = tmp_path / "update.zip"
                    dl_req = urllib.request.Request(zip_url, headers={"User-Agent": "PDF-Tool-ForAll-Updater"})
                    with urllib.request.urlopen(dl_req, timeout=60) as dl_resp, open(zip_file_path, "wb") as out_f:
                        shutil.copyfileobj(dl_resp, out_f)

                    extract_dir = tmp_path / "extracted"
                    with zipfile.ZipFile(zip_file_path, "r") as zf:
                        zf.extractall(extract_dir)

                    new_dist = extract_dir / "dist"
                    if not new_dist.exists() or not (new_dist / "index.html").exists():
                        self._send_json(400, {"ok": False, "error": "Ungültiges Update-Paket (dist/index.html fehlt)."})
                        return

                    # Replace dist/ directory atomically via backup
                    backup_dist = BASE_DIR / "dist_backup"
                    if backup_dist.exists():
                        shutil.rmtree(backup_dist, ignore_errors=True)
                    if DIST_DIR.exists():
                        shutil.move(str(DIST_DIR), str(backup_dist))
                    shutil.copytree(str(new_dist), str(DIST_DIR))
                    shutil.rmtree(backup_dist, ignore_errors=True)

                    # Also update server.py if included
                    new_server = extract_dir / "server.py"
                    if new_server.exists():
                        shutil.copy2(str(new_server), str(BASE_DIR / "server.py"))

                self._send_json(200, {"ok": True, "version": tag_name})
            except Exception as exc:
                self._send_json(500, {"ok": False, "error": str(exc)})
            return

        self._send_json(404, {"ok": False, "error": "Not found"})

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
