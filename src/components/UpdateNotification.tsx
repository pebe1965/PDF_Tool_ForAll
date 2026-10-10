import React, { useState, useEffect } from 'react';
import { Sparkles, Download, ExternalLink, X, ArrowUpCircle } from 'lucide-react';
import { APP_VERSION, GITHUB_REPO } from '../config';

interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  dmgUrl: string;
  zipUrl: string;
  htmlUrl: string;
}

export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Check GitHub releases for updates
    const checkForUpdates = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
          headers: {
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!response.ok) return;

        const rel = await response.json();
        const tag = (rel.tag_name || '').replace(/^v/, '');

        // Compare version strings: e.g. "1.1.0" > "1.0.0"
        const vparts = (vStr: string) => {
          const parts = vStr.match(/\d+/g);
          return parts ? parts.map(Number) : [0];
        };

        const latestParts = vparts(tag);
        const currentParts = vparts(APP_VERSION);

        let isNewer = false;
        for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
          const l = latestParts[i] || 0;
          const c = currentParts[i] || 0;
          if (l > c) {
            isNewer = true;
            break;
          }
          if (l < c) {
            break;
          }
        }

        let dmgUrl = '';
        let zipUrl = '';

        if (Array.isArray(rel.assets)) {
          for (const asset of rel.assets) {
            const name = (asset.name || '').toLowerCase();
            if (name.endsWith('.dmg')) dmgUrl = asset.browser_download_url;
            if (name.endsWith('.zip')) zipUrl = asset.browser_download_url;
          }
        }

        if (isNewer) {
          setUpdateInfo({
            updateAvailable: true,
            latestVersion: tag,
            releaseName: rel.name || `Version ${tag}`,
            releaseNotes: rel.body || '',
            dmgUrl,
            zipUrl,
            htmlUrl: rel.html_url || `https://github.com/${GITHUB_REPO}/releases`,
          });
        }
      } catch (err) {
        // Silently ignore network failures (e.g. offline mode)
      }
    };

    checkForUpdates();
  }, []);

  if (!updateInfo || !updateInfo.updateAvailable) {
    return null;
  }

  return (
    <>
      {/* Pulsing Header Badge */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer transition flex items-center gap-1.5 shadow-sm animate-pulse"
        title="Ein neues Update ist auf GitHub verfügbar!"
      >
        <Sparkles size={13} />
        <span>Update v{updateInfo.latestVersion}</span>
      </button>

      {/* Update Info Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-[#D2D2D7]/60 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8ED] bg-[#F5F5F7]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <ArrowUpCircle size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1D1D1F]">
                    Neues Update verfügbar!
                  </h2>
                  <p className="text-xs text-[#86868B]">
                    Aktuell: <span className="font-mono font-medium">v{APP_VERSION}</span> ➔ Neu: <span className="font-mono font-bold text-emerald-600">v{updateInfo.latestVersion}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#1D1D1F] mb-1">
                  {updateInfo.releaseName}
                </h3>
                {updateInfo.releaseNotes ? (
                  <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto border border-gray-200/60">
                    {updateInfo.releaseNotes}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    Es gibt neue Verbesserungen und Optimierungen auf GitHub.
                  </p>
                )}
              </div>

              {/* Download Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                {updateInfo.dmgUrl && (
                  <a
                    href={updateInfo.dmgUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl transition shadow-sm"
                  >
                    <Download size={14} />
                    <span>Laden für macOS (.dmg)</span>
                  </a>
                )}

                {updateInfo.zipUrl && (
                  <a
                    href={updateInfo.zipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                  >
                    <Download size={14} />
                    <span>Laden für Windows (.zip)</span>
                  </a>
                )}
              </div>

              <div className="text-center pt-1">
                <a
                  href={updateInfo.htmlUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#0071E3] transition"
                >
                  <span>Release auf GitHub öffnen</span>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-3 bg-[#F5F5F7] border-t border-[#E8E8ED]">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
