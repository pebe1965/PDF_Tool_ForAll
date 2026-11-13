import type { ReactNode } from 'react';
import { LoaderCircle, Redo2, Undo2, X } from 'lucide-react';

/** Kopfzeile eines geöffneten Dokuments */
export function EditorHeader({
  title,
  onClose,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  action,
}: {
  title: string;
  onClose: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  action: ReactNode;
}) {
  return (
    <header className="safe-top safe-x shrink-0 border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="flex h-12 items-center gap-1 px-2">
        <button type="button" onClick={onClose} aria-label="Schließen" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5">
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 truncate px-1 text-sm font-semibold">{title}</div>
        <button type="button" onClick={onUndo} disabled={!canUndo} aria-label="Rückgängig" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30">
          <Undo2 className="h-5 w-5" />
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo} aria-label="Wiederholen" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-black/5 disabled:opacity-30">
          <Redo2 className="h-5 w-5" />
        </button>
        {action}
      </div>
    </header>
  );
}

/** Blatt, das von unten hereinfährt */
export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="sheet-up safe-bottom safe-x relative max-h-[88dvh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 pb-3 pt-3">{children}</div>
      </div>
    </div>
  );
}

export function PrimaryButton({ children, onClick, disabled, busy }: { children: ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0071E3] px-4 py-3.5 text-[15px] font-semibold text-white active:bg-[#0062C4] disabled:opacity-50"
    >
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5F5F7] px-4 py-3.5 text-[15px] font-semibold text-[#0071E3] active:bg-[#E8E8ED] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Werkzeug-Knopf in der unteren Leiste */
export function ToolButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold ${active ? 'bg-[#0071E3]/10 text-[#0071E3]' : 'text-[#6E6E73] active:bg-black/5'}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Kurze Meldung über der unteren Leiste */
export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-6">
      <div className="rounded-full bg-black/80 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">{text}</div>
    </div>
  );
}
