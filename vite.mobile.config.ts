import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * Smartphone-Version der Toolbox (Web-App für den Homescreen).
 *   Entwickeln: npm run dev:mobile   → http://localhost:5174
 *   Bauen:      npm run build:mobile → dist-mobile/
 *   Veröffentlicht wird sie mit der Browser-Version auf GitHub Pages unter /mobil/
 *   (Workflow .github/workflows/pages.yml).
 * Alle Dateien bleiben auf dem Gerät – die Seite liefert nur das Programm aus.
 */

const ROOT = __dirname;
const PUBLIC_DIR = resolve(ROOT, 'public');

const manifest = {
  name: 'Toolbox – PDF, Bilder & mehr',
  short_name: 'Toolbox',
  description: 'Bilder und PDFs unkenntlich machen – direkt auf dem Smartphone, ohne Upload.',
  lang: 'de',
  start_url: './',
  scope: './',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#F5F5F7',
  theme_color: '#F5F5F7',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: './apple-touch-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

const SW_TEMPLATE = `// Toolbox Smartphone – Offline-Speicher (automatisch erzeugt)
const CACHE = 'toolbox-mobile-__VERSION__';
const FILES = __FILES__;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Seite zuerst aus dem Netz (für Updates), ohne Netz aus dem Speicher
    e.respondWith(fetch(req).catch(() => caches.match('./', { ignoreVary: true, ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreVary: true }).then((hit) => hit || fetch(req)));
});
`;

/** Erzeugt Manifest und Service Worker (offline) passend zum Build. */
function mobilePwa(): Plugin {
  return {
    name: 'toolbox-mobile-pwa',
    apply: 'build',
    generateBundle(_opts, bundle) {
      // Nur was die Smartphone-Version braucht (die Mac-Datei manifest.json gehört nicht dazu)
      const publicFiles = readdirSync(PUBLIC_DIR).filter((f) => /\.(png|js)$/.test(f));
      const files = ['./', ...Object.keys(bundle).map((f) => `./${f}`), ...publicFiles.map((f) => `./${f}`), './manifest.webmanifest'];
      const hash = createHash('sha256');
      for (const [name, chunk] of Object.entries(bundle)) {
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      for (const f of publicFiles) hash.update(readFileSync(resolve(PUBLIC_DIR, f)));
      // Die Vorlage selbst gehört zur Version – sonst greift eine Änderung am Offline-Speicher nicht
      hash.update(SW_TEMPLATE);
      const version = hash.digest('hex').slice(0, 12);

      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest, null, 2) });
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: SW_TEMPLATE.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)),
      });
    },
  };
}

export default defineConfig({
  root: resolve(ROOT, 'mobile'),
  base: './',
  publicDir: PUBLIC_DIR,
  plugins: [react(), mobilePwa()],
  css: { postcss: ROOT },
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: resolve(ROOT, 'dist-mobile'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib'],
  },
});
