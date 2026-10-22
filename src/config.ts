// App configuration for versions and GitHub update checks
export const APP_VERSION = '1.13.5';
export const GITHUB_REPO = 'pebe1965/PDF_Tool_ForAll';

export const DEFAULT_GEMINI_MODEL: string = 'gemini-3.7-flash';

// KI über NotionaryAtlas: Das Tool enthält bewusst KEINEN Gemini-Schlüssel.
// Ein Schlüssel im ausgelieferten Code ist öffentlich — auch Base64-kodiert,
// das lässt sich in einer Sekunde zurückrechnen. Stattdessen erstellt man im
// Marketplace der App einen persönlichen Zugangscode; die App reicht die
// Anfrage mit ihrem Schlüssel an Gemini weiter und rechnet über die
// KI-Credits des Kontos ab.
export const APP_KI_URL = 'https://app.pberthold.com/api/ai/desktop-tool';
export const APP_MARKETPLACE_URL = 'https://app.pberthold.com/marketplace';

const ZUGANGSCODE_KEY = 'notionary_zugangscode';
const EIGENER_SCHLUESSEL_KEY = 'gemini_custom_api_key';

/** Größter PDF-Anhang über die App: Vercel nimmt höchstens 4,5 MB je Anfrage an (Base64 +33 %). */
export const MAX_PDF_BYTES_UEBER_APP = 2.8 * 1024 * 1024;

export type KiVerbindung =
  | { art: 'eigener-schluessel'; schluessel: string }
  | { art: 'app'; zugangscode: string };

function lies(key: string): string {
  try {
    return (localStorage.getItem(key) || '').trim();
  } catch (_) {
    return '';
  }
}

function schreib(key: string, wert: string) {
  try {
    if (wert.trim()) localStorage.setItem(key, wert.trim());
    else localStorage.removeItem(key);
  } catch (_) {
    // privater Modus: dann eben nur für diese Sitzung nicht gespeichert
  }
}

export function getZugangscode(): string {
  return lies(ZUGANGSCODE_KEY);
}

export function setZugangscode(code: string) {
  schreib(ZUGANGSCODE_KEY, code);
}

/** Optional: eigener Gemini-Schlüssel des Nutzers (z. B. ohne App-Konto). */
export function getActiveGeminiApiKey(): string {
  return lies(EIGENER_SCHLUESSEL_KEY);
}

export function setEigenerSchluessel(schluessel: string) {
  schreib(EIGENER_SCHLUESSEL_KEY, schluessel);
}

export function istZugangscode(code: string): boolean {
  return /^na_[A-Za-z0-9_-]{32}$/.test(code.trim());
}

/**
 * Welche Verbindung gilt: Ein ausdrücklich hinterlegter eigener Schlüssel hat
 * Vorrang, sonst der Zugangscode der App.
 */
export function getKiVerbindung(): KiVerbindung | null {
  const schluessel = getActiveGeminiApiKey();
  if (schluessel) return { art: 'eigener-schluessel', schluessel };
  const code = getZugangscode();
  if (istZugangscode(code)) return { art: 'app', zugangscode: code };
  return null;
}

export function hasKiZugang(): boolean {
  return getKiVerbindung() !== null;
}

export interface VerbindungsStatus {
  verbunden: boolean;
  programm?: string;
  konto?: string | null;
  credits?: number | null;
  fehler?: string;
}

/** Fragt die App, ob der Zugangscode gilt — verbraucht keine Credits. */
export async function pruefeZugangscode(code: string): Promise<VerbindungsStatus> {
  try {
    const res = await fetch(APP_KI_URL, { headers: { Authorization: `Bearer ${code.trim()}` } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { verbunden: false, fehler: data?.error?.message || `HTTP ${res.status}` };
    return data as VerbindungsStatus;
  } catch (_) {
    return { verbunden: false, fehler: 'Die App ist nicht erreichbar. Besteht eine Internetverbindung?' };
  }
}
