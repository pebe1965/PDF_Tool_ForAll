import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Search, ShieldAlert, X } from 'lucide-react';
import { pdfHasText, searchPdfText, SEARCH_PRESETS, type SearchPreset, type TextMatch } from '../lib/pdfTextSearch';

interface TextSearchRedactModalProps {
  isOpen: boolean;
  pdfDoc: any | null;
  onClose: () => void;
  /** Gibt zurück, wie viele Stellen neu markiert wurden (0 = alle schon markiert). */
  onApply: (matches: TextMatch[]) => number;
}

/**
 * „Text suchen und schwärzen“: Begriff oder Muster (IBAN, E-Mail, …) im ganzen PDF suchen
 * und die Fundstellen als Schwärzungen anlegen. Gleiche Suche wie in der Smartphone-Version.
 */
export const TextSearchRedactModal: React.FC<TextSearchRedactModalProps> = ({ isOpen, pdfDoc, onClose, onApply }) => {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<TextMatch[] | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [hasText, setHasText] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const runId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setResults(null);
    setChecked(new Set());
    setNotice(null);
    setHasText(null);
    if (pdfDoc) pdfHasText(pdfDoc).then(setHasText).catch(() => setHasText(true));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, pdfDoc]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const run = async (q: string | SearchPreset) => {
    if (!pdfDoc) return;
    const id = ++runId.current;
    setBusy('Suche …');
    setResults(null);
    setNotice(null);
    try {
      const found = await searchPdfText(pdfDoc, q, (p, total) => id === runId.current && total > 3 && setBusy(`Suche … Seite ${p} von ${total}`));
      if (id !== runId.current) return;
      setResults(found);
      setChecked(new Set(found.map((m) => m.id)));
    } catch (err) {
      console.error(err);
      if (id === runId.current) setNotice('Die Suche hat nicht geklappt.');
    } finally {
      if (id === runId.current) setBusy(null);
    }
  };

  const chosen = results?.filter((m) => checked.has(m.id)) || [];

  const apply = () => {
    const added = onApply(chosen);
    if (added === 0) setNotice('Diese Stellen sind schon markiert.');
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-red-600" />
            <h2 className="text-base font-bold text-[#1D1D1F]">Text suchen und schwärzen</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[#86868B] hover:bg-[#F5F5F7]" title="Schließen">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-snug text-[#6E6E73]">
            Sucht im ganzen PDF. Groß-/Kleinschreibung und Leerzeichen sind egal – „DE893704“ findet auch „DE89 3704“. Die Fundstellen werden als
            Schwärzung angelegt und beim Speichern unwiderruflich eingebrannt.
          </p>

          {hasText === false && (
            <p className="rounded-xl bg-[#FFF4E5] px-3 py-2.5 text-xs leading-snug text-[#8A5300]">
              Dieses PDF enthält keinen auswählbaren Text (z. B. ein eingescanntes Dokument). Die Suche findet hier nichts – bitte die Stellen mit
              „Schwärzen“ von Hand markieren.
            </p>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) run(query);
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, Nummer, Begriff …"
                className="w-full rounded-xl bg-[#F5F5F7] py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#0071E3]"
              />
            </div>
            <button type="submit" disabled={!query.trim() || !!busy} className="rounded-xl bg-[#0071E3] px-4 text-sm font-semibold text-white disabled:opacity-40">
              Suchen
            </button>
          </form>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">Oder automatisch finden</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(SEARCH_PRESETS) as SearchPreset[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!!busy}
                  title={SEARCH_PRESETS[k].hint}
                  onClick={() => {
                    setQuery('');
                    run(k);
                  }}
                  className="rounded-full bg-[#F5F5F7] px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#E8E8ED] disabled:opacity-40"
                >
                  {SEARCH_PRESETS[k].label}
                </button>
              ))}
            </div>
          </div>

          {busy && (
            <div className="flex items-center gap-2 py-1 text-sm text-[#6E6E73]">
              <Loader2 size={16} className="animate-spin text-[#0071E3]" />
              {busy}
            </div>
          )}

          {results && results.length === 0 && <p className="py-1 text-sm text-[#6E6E73]">Nichts gefunden.</p>}

          {results && results.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#1D1D1F]">
                  {results.length} {results.length === 1 ? 'Fundstelle' : 'Fundstellen'}
                </span>
                <button
                  type="button"
                  onClick={() => setChecked(chosen.length === results.length ? new Set() : new Set(results.map((m) => m.id)))}
                  className="text-xs font-semibold text-[#0071E3] hover:underline"
                >
                  {chosen.length === results.length ? 'Keine' : 'Alle'} auswählen
                </button>
              </div>
              <ul className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/5">
                {results.map((m) => {
                  const on = checked.has(m.id);
                  const [pre, rest] = m.context.split('[[');
                  const [hit, post] = (rest || '').split(']]');
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(checked);
                          if (on) next.delete(m.id);
                          else next.add(m.id);
                          setChecked(next);
                        }}
                        className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[#F5F5F7]"
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-[#0071E3] bg-[#0071E3]' : 'border-[#C7C7CC]'}`}
                        >
                          {on && <Check size={12} className="text-white" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold text-[#86868B]">Seite {m.pageNumber}</span>
                          <span className="block break-words text-xs leading-snug text-[#3A3A3C]">
                            {pre}
                            <mark className="rounded bg-[#FFE58F] px-0.5 font-semibold text-[#1D1D1F]">{hit}</mark>
                            {post}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {notice && <p className="text-xs font-semibold text-[#B25000]">{notice}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-black/5 px-5 py-3">
          <button onClick={onClose} className="rounded-xl bg-[#F5F5F7] px-4 py-2 text-sm font-semibold text-[#1D1D1F] hover:bg-[#E8E8ED]">
            Abbrechen
          </button>
          <button
            onClick={apply}
            disabled={chosen.length === 0}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {chosen.length} {chosen.length === 1 ? 'Stelle' : 'Stellen'} schwärzen
          </button>
        </div>
      </div>
    </div>
  );
};
