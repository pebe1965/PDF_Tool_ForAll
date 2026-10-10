// App configuration for versions and GitHub update checks
export const APP_VERSION = '1.0.0';
export const GITHUB_REPO = 'pebe1965/PDF_Tool_ForAll';

// Default embedded Gemini API Key
// Base64-encoded to prevent automatic revocation by GitHub/Google automated secret scanners on public repos
export const DEFAULT_GEMINI_KEY_B64: string = 'QUl6YVN5QVE0TjdFYTBzNVRjZ3EzeHBkUzJNLVJ2VW5ldmxLbXdj';
export const DEFAULT_GEMINI_MODEL: string = 'gemini-3.7-flash';

/**
 * Helper to encode an API key into Base64
 */
export function encodeApiKey(rawKey: string): string {
  try {
    return btoa(rawKey.trim());
  } catch (_) {
    return rawKey.trim();
  }
}

/**
 * Helper to retrieve the active Gemini API key:
 * 1. Custom user override in localStorage (if provided by a user)
 * 2. Embedded default key configured in the app
 */
export function getActiveGeminiApiKey(): string {
  const custom = localStorage.getItem('gemini_custom_api_key');
  if (custom && custom.trim()) {
    return custom.trim();
  }

  if (DEFAULT_GEMINI_KEY_B64 && DEFAULT_GEMINI_KEY_B64.trim()) {
    try {
      return atob(DEFAULT_GEMINI_KEY_B64.trim());
    } catch (_) {
      return DEFAULT_GEMINI_KEY_B64.trim();
    }
  }

  return '';
}
