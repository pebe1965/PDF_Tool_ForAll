import { APP_VERSION, GITHUB_REPO } from '../config';

export interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseName: string;
  releaseNotes: string;
  dmgUrl: string;
  zipUrl: string;
  htmlUrl: string;
  checkedAt: string;
  error?: string;
}

/**
 * Compare semantic versions: returns true if latest is strictly newer than current
 */
export function isVersionNewer(latestStr: string, currentStr: string): boolean {
  const parse = (v: string) => {
    const parts = v.replace(/^v/, '').match(/\d+/g);
    return parts ? parts.map(Number) : [0];
  };

  const latest = parse(latestStr);
  const current = parse(currentStr);

  for (let i = 0; i < Math.max(latest.length, current.length); i++) {
    const l = latest[i] || 0;
    const c = current[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

/**
 * Checks GitHub Releases API for the latest release of the repository
 */
export async function checkForGitHubUpdate(): Promise<UpdateInfo> {
  const currentVersion = APP_VERSION;
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          updateAvailable: false,
          latestVersion: currentVersion,
          currentVersion,
          releaseName: 'Aktuelle Version',
          releaseNotes: '',
          dmgUrl: '',
          zipUrl: '',
          htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
          checkedAt: nowStr,
        };
      }
      throw new Error(`GitHub API Fehler (${response.status})`);
    }

    const rel = await response.json();
    const tag = (rel.tag_name || '').replace(/^v/, '');
    const isNewer = isVersionNewer(tag, currentVersion);

    let dmgUrl = '';
    let zipUrl = '';

    if (Array.isArray(rel.assets)) {
      for (const asset of rel.assets) {
        const name = (asset.name || '').toLowerCase();
        if (name.endsWith('.dmg')) dmgUrl = asset.browser_download_url;
        if (name.endsWith('.zip')) zipUrl = asset.browser_download_url;
      }
    }

    return {
      updateAvailable: isNewer,
      latestVersion: tag || currentVersion,
      currentVersion,
      releaseName: rel.name || `Version ${tag}`,
      releaseNotes: rel.body || '',
      dmgUrl,
      zipUrl,
      htmlUrl: rel.html_url || `https://github.com/${GITHUB_REPO}/releases`,
      checkedAt: nowStr,
    };
  } catch (err: any) {
    return {
      updateAvailable: false,
      latestVersion: currentVersion,
      currentVersion,
      releaseName: '',
      releaseNotes: '',
      dmgUrl: '',
      zipUrl: '',
      htmlUrl: `https://github.com/${GITHUB_REPO}/releases`,
      checkedAt: nowStr,
      error: err?.message || 'Keine Internetverbindung oder GitHub nicht erreichbar.',
    };
  }
}
