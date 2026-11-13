import { Bold, Italic, RotateCcw } from 'lucide-react';
import { signatureFonts, signatureTextStyle } from '../lib/mailSignatures';
import type { SignatureFont, SignatureProject, SignatureTextStyle, SignatureTextTarget } from '../lib/mailSignatures';

const fontSizes = Array.from({ length: 28 }, (_, index) => index + 9);
const controlClass = 'h-9 w-full rounded-lg border border-gray-200 bg-[#F5F5F7] px-2 text-xs font-medium focus:border-[#0071E3] focus:bg-white focus:outline-none';
const toggleClass = 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-[#F5F5F7] text-gray-600 transition hover:bg-gray-200 aria-pressed:border-[#0071E3] aria-pressed:bg-[#0071E3] aria-pressed:text-white';

interface SignatureStylePanelProps {
  project: SignatureProject;
  target: SignatureTextTarget;
  onChangeStyle: (target: SignatureTextTarget, style: Partial<SignatureTextStyle> | null) => void;
}

/** Text formatting for one part of the signature, laid out like a compact inspector. */
export function SignatureStylePanel({ project, target, onChangeStyle }: SignatureStylePanelProps) {
  const style = signatureTextStyle(project, target);
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[1fr_72px] gap-2">
        <label className="space-y-1 text-[11px] font-semibold text-gray-500">
          <span>Schriftart</span>
          <select className={controlClass} value={style.font} style={{ fontFamily: signatureFonts[style.font] }}
            onChange={event => onChangeStyle(target, { font: event.currentTarget.value as SignatureFont })}>
            {Object.keys(signatureFonts).map(font => (
              <option key={font} style={{ fontFamily: signatureFonts[font as SignatureFont] }}>{font}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-semibold text-gray-500">
          <span>Größe</span>
          <select className={controlClass} value={style.size}
            onChange={event => onChangeStyle(target, { size: Number(event.currentTarget.value) })}>
            {fontSizes.map(size => <option key={size} value={size}>{size} px</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-end gap-2">
        <label className="flex-1 space-y-1 text-[11px] font-semibold text-gray-500">
          <span>Schriftfarbe</span>
          <span className="flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-[#F5F5F7] px-1.5">
            <input type="color" className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" value={style.color}
              onChange={event => onChangeStyle(target, { color: event.currentTarget.value })} />
            <span className="font-mono text-[11px] uppercase text-gray-600">{style.color}</span>
          </span>
        </label>
        <button type="button" className={toggleClass} aria-label="Fett" title="Fett" aria-pressed={style.bold}
          onClick={() => onChangeStyle(target, { bold: !style.bold })}><Bold size={16} /></button>
        <button type="button" className={toggleClass} aria-label="Kursiv" title="Kursiv" aria-pressed={style.italic}
          onClick={() => onChangeStyle(target, { italic: !style.italic })}><Italic size={16} /></button>
      </div>
      {project.textStyles?.[target] && (
        <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0071E3] hover:underline"
          onClick={() => onChangeStyle(target, null)}>
          <RotateCcw size={12} /> Formatierung zurücksetzen
        </button>
      )}
    </div>
  );
}
