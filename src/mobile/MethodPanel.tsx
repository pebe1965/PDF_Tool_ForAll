import { Droplets, EyeOff, Grid3x3, RotateCcw, ShieldAlert, Snowflake, Trash2 } from 'lucide-react';
import { isMethodSecure, METHOD_LABELS, type RedactMethod } from '../lib/imageEngine';

export interface MethodSettings {
  method: RedactMethod;
  strength: number;
  color: string;
}

const METHODS: { id: RedactMethod; icon: typeof EyeOff }[] = [
  { id: 'fill', icon: EyeOff },
  { id: 'pixelate', icon: Grid3x3 },
  { id: 'blur', icon: Droplets },
  { id: 'frosted', icon: Snowflake },
];

const COLORS = [
  { value: '#000000', label: 'Schwarz' },
  { value: '#FFFFFF', label: 'Weiß' },
  { value: '#8E8E93', label: 'Grau' },
];

interface MethodPanelProps {
  settings: MethodSettings;
  onChange: (patch: Partial<MethodSettings>) => void;
  /** Wird ein vorhandener Bereich bearbeitet (sonst: Einstellung für neue Bereiche) */
  editing: boolean;
  rotation?: number;
  onRotation?: (deg: number, final: boolean) => void;
  onDelete?: () => void;
}

export default function MethodPanel({ settings, onChange, editing, rotation, onRotation, onDelete }: MethodPanelProps) {
  const secure = isMethodSecure(settings.method, settings.strength);
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#86868B]">
          {editing ? 'Ausgewählter Bereich' : 'Für neue Bereiche'}
        </span>
        {editing && onDelete && (
          <button type="button" onClick={onDelete} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[#FF3B30] active:bg-[#FF3B30]/10">
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {METHODS.map(({ id, icon: Icon }) => {
          const active = settings.method === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ method: id })}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${
                active ? 'bg-[#0071E3] text-white' : 'bg-[#F5F5F7] text-[#1D1D1F] active:bg-[#E8E8ED]'
              }`}
            >
              <Icon className="h-5 w-5" />
              {METHOD_LABELS[id]}
            </button>
          );
        })}
      </div>
      {settings.method === 'fill' ? (
        <div className="flex items-center gap-3 px-0.5">
          <span className="w-14 text-xs font-medium text-[#86868B]">Farbe</span>
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.label}
              onClick={() => onChange({ color: c.value })}
              className={`h-8 w-8 rounded-full border ${settings.color.toUpperCase() === c.value ? 'ring-2 ring-[#0071E3] ring-offset-2' : ''}`}
              style={{ background: c.value, borderColor: 'rgba(0,0,0,0.15)' }}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 px-0.5">
          <span className="w-14 text-xs font-medium text-[#86868B]">Stärke</span>
          <input
            type="range"
            min={1}
            max={100}
            value={settings.strength}
            onChange={(e) => onChange({ strength: Number(e.target.value) })}
            className="mobile-range flex-1"
          />
          <span className="w-8 text-right text-xs tabular-nums text-[#86868B]">{settings.strength}</span>
        </div>
      )}
      {!secure && (
        <div className="flex items-start gap-1.5 rounded-lg bg-[#FFF4E5] px-2.5 py-1.5 text-[11px] leading-snug text-[#8A5300]">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          Schwach eingestellt – Text oder Gesichter könnten noch erkennbar sein.
        </div>
      )}
      {editing && onRotation && rotation !== undefined && (
        <div className="flex items-center gap-3 px-0.5">
          <span className="w-14 text-xs font-medium text-[#86868B]">Drehung</span>
          <input
            type="range"
            min={-180}
            max={180}
            value={Math.round(rotation)}
            onChange={(e) => onRotation(Number(e.target.value), false)}
            onPointerUp={(e) => onRotation(Number((e.target as HTMLInputElement).value), true)}
            onTouchEnd={(e) => onRotation(Number((e.target as HTMLInputElement).value), true)}
            className="mobile-range flex-1"
          />
          <button
            type="button"
            onClick={() => onRotation(0, true)}
            className="flex w-12 items-center justify-end gap-0.5 text-xs tabular-nums text-[#86868B]"
            aria-label="Drehung zurücksetzen"
          >
            {Math.round(rotation)}°
            {rotation !== 0 && <RotateCcw className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  );
}
