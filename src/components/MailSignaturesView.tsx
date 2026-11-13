import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import {
  AlignLeft, Check, ChevronDown, Columns2, Copy, CopyPlus, Download, FolderOpen, ImagePlus, Mail, Minus, Monitor,
  MessageSquareQuote, MousePointerClick, Palette, Plus, Redo2, Rows2, Scale, Send, Smartphone, Sparkles, Trash2,
  Undo2, UserRound, ZoomIn, ZoomOut,
} from 'lucide-react';
import { TextArtModal } from './TextArtModal';
import { PALETTE_MIME, SignatureCanvas } from './SignatureCanvas';
import type { CanvasSelection, InlineText, PaletteItem, PreviewMode } from './SignatureCanvas';
import { SignatureStylePanel } from './SignatureStylePanel';
import { renderTextArtToPngBytes } from '../lib/textArtHelper';
import {
  createAppleMailSignature, createSignature, downloadSignature, exportSignatureProject, fields, httpsUrl,
  importSignature, loadSignatureLibrary, readSignatureImage, renderSignature, resizeSignatureImage,
  saveSignatureLibrary, signatureBlockOrder, signatureBlocks, signatureFileName, signatureFonts,
} from '../lib/mailSignatures';
import type {
  ContactLabelStyle, DividerStyle, ImageShape, SignatureBlock, SignatureFields, SignatureImageSlot,
  SignatureLibrary, SignatureProject, SignatureTextStyle, SignatureTextTarget, SpacingStyle, VerticalAlign,
} from '../lib/mailSignatures';
import type { TextArtAnnotation } from '../types/pdf';

const inputClass = 'w-full rounded-lg border border-gray-200 bg-[#F5F5F7] px-2.5 py-2 text-xs font-medium text-gray-900 focus:border-[#0071E3] focus:bg-white focus:outline-none';
const pillClass = 'inline-flex items-center gap-1.5 rounded-xl bg-[#F5F5F7] px-2.5 py-1.5 text-xs font-semibold text-[#1D1D1F] transition hover:bg-gray-200 disabled:opacity-40';
const primaryClass = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0071E3] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0077ED] disabled:opacity-50';
const secondaryClass = 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 disabled:opacity-50';
const sectionTitle = 'px-1 text-[11px] font-bold uppercase tracking-wider text-gray-400';
const segmentClass = 'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition aria-pressed:bg-white aria-pressed:text-[#0071E3] aria-pressed:shadow-sm text-gray-600 hover:text-gray-900';
const zoomSteps = [0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5];
const accentSwatches = ['#145a8d', '#0071E3', '#107C41', '#B3261E', '#7E3AF2', '#E8710A', '#1D1D1F'];

const clients = {
  apple: 'Apple Mail auf dem Mac',
  thunderbird: 'Thunderbird',
  outlook: 'Neues Outlook / Outlook im Web',
  classic: 'Klassisches Outlook für Windows',
  mac: 'Outlook für Mac',
  gmail: 'Gmail im Browser',
  mobile: 'Apple Mail auf dem iPhone / Outlook Mobile',
};

const instructions: Record<keyof typeof clients, string> = {
  apple: 'Lade die .eml-Datei und öffne sie in Apple Mail. Klicke in den Nachrichteninhalt und drücke ⌘A und ⌘C. Öffne Mail → Einstellungen → Signaturen, deaktiviere dort für deine Signatur die Option für die Standardschrift und füge den Inhalt mit ⌘V ein.',
  thunderbird: 'Lade die HTML-Datei herunter. Wähle in den Konten-Einstellungen die Option für eine Signatur aus einer Datei und öffne die heruntergeladene Datei.',
  outlook: 'Öffne Einstellungen → Konten → Signaturen, erstelle eine Signatur, füge die Vorlage ein und speichere sie.',
  classic: 'Öffne eine neue Nachricht und wähle Signatur → Signaturen. Füge die Vorlage ein. Falls nötig, kopiere sie über Word und setze das Logo über den Bildbutton ein.',
  mac: 'Öffne Outlook → Einstellungen → Signaturen und füge die Vorlage in eine neue Signatur ein.',
  gmail: 'Öffne Einstellungen → Alle Einstellungen aufrufen → Allgemein → Signatur. Füge die Vorlage ein und speichere die Änderungen.',
  mobile: 'Kopiere die Textfassung. Öffne auf dem iPhone Einstellungen → Apps → Mail → Signatur oder in Outlook Einstellungen → Signatur.',
};

const legalTemplates = {
  company: {
    label: 'GmbH / UG',
    text: 'Rechtsform und Sitz: [Angabe]\nRegistergericht und Registernummer: [Angabe]\nGeschäftsführung: [Name(n)]',
    hint: 'Ergänze die Angaben deiner Gesellschaft und prüfe, welche weiteren Angaben für sie gelten.',
    source: '§ 35a GmbHG',
    url: 'https://www.gesetze-im-internet.de/gmbhg/__35a.html',
  },
  soleTrader: {
    label: 'Einzelunternehmen ohne Handelsregistereintrag',
    text: '[Vorname Nachname]\n[Straße Hausnummer]\n[PLZ Ort]',
    hint: 'Verwende deinen ausgeschriebenen Namen und eine ladungsfähige Geschäftsanschrift. Wenn dein Name schon oben steht, kannst du ihn hier weglassen.',
    source: 'IHK zu Geschäftsbriefen',
    url: 'https://www.ihk.de/koblenz/unternehmensservice/recht/rechtsauskuenfte-von-a-z/allgemeine-infos/pflichtangaben-auf-geschaeftsbriefen-faxen-und-e-mails-3480308',
  },
  registeredTrader: {
    label: 'Eingetragenes Einzelunternehmen (e.K.)',
    text: '[Eingetragene Firma mit Rechtsformzusatz]\nOrt der Handelsniederlassung: [Ort]\nRegistergericht: [Gericht]\nHandelsregisternummer: [HRA-Nummer]',
    hint: 'Übernimm den Firmennamen einschließlich Rechtsformzusatz aus dem Handelsregister.',
    source: '§ 37a HGB',
    url: 'https://www.gesetze-im-internet.de/hgb/__37a.html',
  },
};

const smallBusinessNote = 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.';

const previewModes: { value: PreviewMode; label: string }[] = [
  { value: 'edit', label: 'Gestalten' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'blocked', label: 'Ohne Bilder' },
  { value: 'plain', label: 'Klartext' },
];

const paletteItems: { item: PaletteItem; label: string; icon: typeof Mail; businessOnly?: boolean }[] = [
  { item: 'greeting', label: 'Grußformel', icon: MessageSquareQuote },
  { item: 'identity', label: 'Name & Kontakt', icon: UserRound },
  { item: 'logo', label: 'Logo / Foto', icon: ImagePlus },
  { item: 'divider', label: 'Trennlinie', icon: Minus },
  { item: 'textArt', label: 'TextArt', icon: Sparkles },
  { item: 'note', label: 'Freier Text', icon: AlignLeft },
  { item: 'legal', label: 'Pflichtangaben', icon: Scale, businessOnly: true },
];

type History = { past: SignatureLibrary[]; future: SignatureLibrary[]; key?: string; time: number };

export function MailSignaturesView() {
  const [library, setLibrary] = useState<SignatureLibrary>();
  const [persistError, setPersistError] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [legalTemplate, setLegalTemplate] = useState<keyof typeof legalTemplates>('company');
  const [client, setClient] = useState<keyof typeof clients>('apple');
  const [mode, setMode] = useState<PreviewMode>('edit');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [zoom, setZoom] = useState(1);
  const [selection, setSelection] = useState<CanvasSelection>();
  const [identityTarget, setIdentityTarget] = useState<'name' | 'identity'>('name');
  const [rightTab, setRightTab] = useState<'design' | 'export'>('design');
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [textArtOpen, setTextArtOpen] = useState(false);
  const [textArtBefore, setTextArtBefore] = useState<SignatureBlock | null>();
  const libraryRef = useRef<SignatureLibrary>();
  const history = useRef<History>({ past: [], future: [], time: 0 });
  const importInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  libraryRef.current = library;

  useEffect(() => {
    let active = true;
    function initialize(saved?: SignatureLibrary) {
      if (!active) return;
      const first = createSignature('private');
      setLibrary(saved?.projects.length ? saved : { activeId: first.id, projects: [first] });
    }
    loadSignatureLibrary().then(initialize).catch(() => initialize());
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!library) return;
    let active = true;
    saveSignatureLibrary(library).then(
      () => { if (active) setPersistError(false); },
      () => { if (active) setPersistError(true); },
    );
    return () => { active = false; };
  }, [library]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(''), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]'))) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); }
      else if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const project = library?.projects.find(item => item.id === library.activeId);
  if (!library || !project) return <p className="p-6">Signaturen werden geladen …</p>;

  const output = renderSignature(project);
  const previewOutput = renderSignature(project, { hideImage: mode === 'blocked', preferLocalImage: true });
  const designOutput = renderSignature(project, { preferLocalImage: true, markImages: true });
  const fileName = signatureFileName(project.title);
  const template = legalTemplates[legalTemplate];
  const legalText = project.legal.trim();
  const canInsertTemplate = !legalText || legalText === smallBusinessNote;
  const legalWithNote = [project.legal.trimEnd(), smallBusinessNote].filter(Boolean).join('\n\n');
  const canvasBlocks = designOutput.blocks.filter(({ key, html }) =>
    key === 'identity' || (Boolean(html) && (key !== 'legal' || project.profile === 'business') && (key !== 'divider' || project.showDivider)),
  );
  const hasGraphics = Boolean(project.image || project.textArt || httpsUrl(project.imageUrl));
  const hasLogo = Boolean(project.image || httpsUrl(project.imageUrl));
  const activeSelection = selection === 'logo'
    ? (hasLogo ? 'logo' : undefined)
    : canvasBlocks.some(block => block.key === selection) ? selection : undefined;

  // ---------- state changes with undo history ----------

  function commit(next: SignatureLibrary, key?: string) {
    const current = libraryRef.current;
    const h = history.current;
    const now = Date.now();
    if (current && !(key && h.key === key && now - h.time < 1200)) {
      h.past.push(current);
      if (h.past.length > 100) h.past.shift();
    }
    h.future = [];
    h.key = key;
    h.time = now;
    libraryRef.current = next;
    setLibrary(next);
  }

  function update(changes: Partial<SignatureProject>, key?: string, id = project!.id) {
    const current = libraryRef.current;
    if (!current) return;
    commit({
      ...current,
      projects: current.projects.map(item => item.id === id ? { ...item, ...changes } : item),
    }, key);
  }

  function restore(from: SignatureLibrary[], to: SignatureLibrary[], message: string) {
    const current = libraryRef.current;
    const previous = from.pop();
    if (!current || !previous) return;
    to.push(current);
    history.current.key = undefined;
    const activeId = previous.projects.some(item => item.id === current.activeId) ? current.activeId : previous.activeId;
    const next = { ...previous, activeId };
    libraryRef.current = next;
    setLibrary(next);
    setStatus(message);
  }

  function undo() { restore(history.current.past, history.current.future, 'Rückgängig gemacht.'); }
  function redo() { restore(history.current.future, history.current.past, 'Wiederhergestellt.'); }

  function placedOrder(block: SignatureBlock, before: SignatureBlock | null) {
    const order = signatureBlockOrder(project!.blockOrder).filter(item => item !== block);
    if (before && before !== block) {
      order.splice(order.indexOf(before), 0, block);
    } else {
      const visible = canvasBlocks.map(item => item.key).filter(item => item !== block);
      const last = Math.max(-1, ...visible.map(item => order.indexOf(item)));
      order.splice(last + 1, 0, block);
    }
    return order;
  }

  function placeBlock(block: SignatureBlock, before: SignatureBlock | null) {
    update({ blockOrder: placedOrder(block, before) });
  }

  function insertFromPalette(item: PaletteItem, before: SignatureBlock | null) {
    setMode('edit');
    setRightTab('design');
    if (item === 'logo') {
      imageInput.current?.click();
      return;
    }
    if (item === 'textArt' && !project!.textArt) {
      setTextArtBefore(before);
      setTextArtOpen(true);
      return;
    }
    if (item === 'divider') {
      update({ showDivider: true, blockOrder: placedOrder('divider', before) });
      setSelection('divider');
      setStatus('Trennlinie eingefügt.');
      return;
    }
    const changes: Partial<SignatureProject> = { blockOrder: placedOrder(item, before) };
    if (item === 'greeting' && !project!.greeting.trim()) {
      changes.greeting = project!.profile === 'business' ? 'Mit freundlichen Grüßen' : 'Viele Grüße';
    }
    if (item === 'note' && !project!.note.trim()) changes.note = 'Dein Text – Doppelklick zum Bearbeiten';
    if (item === 'legal' && !project!.legal.trim()) changes.legal = template.text;
    update(changes);
    setSelection(item);
    setStatus(`${signatureBlocks[item]} eingefügt.`);
  }

  function paletteClick(item: PaletteItem) {
    if (item === 'logo' ? hasLogo : item === 'divider' ? project!.showDivider : canvasBlocks.some(block => block.key === item)) {
      setMode('edit');
      setRightTab('design');
      setSelection(item);
    } else {
      insertFromPalette(item, null);
    }
  }

  function clear(target: CanvasSelection) {
    if (target === 'identity') return;
    if (target === 'logo') update({ image: '', imageUrl: '' });
    else if (target === 'textArt') update({ textArt: undefined });
    else if (target === 'divider') update({ showDivider: false });
    else update({ [target]: '' });
    setSelection(undefined);
    setStatus(`${target === 'logo' ? 'Grafik' : signatureBlocks[target]} entfernt – mit ⌘Z / Strg+Z rückgängig.`);
  }

  function changeTextStyle(target: SignatureTextTarget, style: Partial<SignatureTextStyle> | null) {
    const textStyles = { ...project!.textStyles };
    if (style) {
      textStyles[target] = { ...textStyles[target], ...style };
      if (style.size !== undefined) textStyles[target]!.size = Math.max(9, Math.min(36, style.size));
    } else {
      delete textStyles[target];
    }
    update({ textStyles }, style?.color ? `color-${target}` : undefined);
  }

  function changeImageWidth(slot: SignatureImageSlot, width: number) {
    if (slot === 'logo') update({ imageWidth: width }, 'width-logo');
    else if (project!.textArt) update({ textArt: { ...project!.textArt, width } }, 'width-textArt');
  }

  function add(item: SignatureProject) {
    const current = libraryRef.current;
    if (!current) return;
    commit({ activeId: item.id, projects: [...current.projects, item] });
    setSelection(undefined);
    setStatus('');
  }

  function remove(item: SignatureProject) {
    if (!window.confirm(`„${item.title || 'Signatur'}“ aus diesem Browser löschen?`)) return;
    const current = libraryRef.current;
    if (!current) return;
    const remaining = current.projects.filter(other => other.id !== item.id);
    const projects = remaining.length ? remaining : [createSignature('private')];
    commit({ activeId: projects[0].id, projects });
    setSelection(undefined);
    setStatus('Signatur gelöscht – mit ⌘Z / Strg+Z rückgängig.');
  }

  function focusField(key: keyof SignatureFields) {
    const element = document.getElementById(`sig-field-${key}`);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    element?.focus();
  }

  // ---------- export ----------

  async function copy(formatted: boolean) {
    try {
      if (formatted) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([output.html], { type: 'text/html' }),
          'text/plain': new Blob([output.plain], { type: 'text/plain' }),
        })]);
      } else {
        await navigator.clipboard.writeText(output.plain);
      }
      setStatus(formatted ? 'Formatierte Signatur kopiert.' : 'Klartext kopiert.');
    } catch {
      setMode(formatted ? 'light' : 'plain');
      setStatus('Markiere die Signatur in der Vorschau und kopiere sie manuell.');
      window.setTimeout(() => {
        if (!preview.current) return;
        const range = document.createRange();
        range.selectNodeContents(preview.current);
        const selected = window.getSelection();
        selected?.removeAllRanges();
        selected?.addRange(range);
        preview.current.scrollIntoView({ block: 'nearest' });
      }, 50);
    }
  }

  async function downloadAppleMail() {
    setBusy(true);
    try {
      downloadSignature(`${fileName}.eml`, await createAppleMailSignature(project!));
      setStatus('Datei für Apple Mail heruntergeladen.');
    } catch {
      setStatus('Der Export ist fehlgeschlagen. Prüfe, ob die Grafik in der Vorschau angezeigt wird.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadImage() {
    setBusy(true);
    try {
      const { blob, width } = await resizeSignatureImage(project!);
      const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      downloadSignature(`${fileName}-${width}px.${extension}`, blob);
      setStatus('Grafik in der gewählten Größe heruntergeladen.');
    } catch {
      setStatus('Die Grafik konnte nicht skaliert werden.');
    } finally {
      setBusy(false);
    }
  }

  // ---------- files ----------

  async function loadFile(file: File) {
    setBusy(true);
    try {
      add(await importSignature(file));
      setStatus(/\.json$/i.test(file.name)
        ? 'Signaturprojekt geöffnet.'
        : 'Vorhandene Signatur importiert. Prüfe Text, Links und Bilder in der Vorschau.');
    } catch (error) {
      setStatus(error instanceof Error && !(error instanceof SyntaxError) ? error.message : 'Die Projektdatei ist ungültig.');
    } finally {
      setBusy(false);
    }
  }

  async function addImage(file: File) {
    const id = project!.id;
    setBusy(true);
    try {
      update({ image: await readSignatureImage(file) }, undefined, id);
      setSelection('logo');
      setMode('edit');
      setStatus('Grafik übernommen. Ziehe an der blauen Ecke, um die Größe zu ändern.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Die Grafik konnte nicht geöffnet werden.');
    } finally {
      setBusy(false);
    }
  }

  function dropFile(file: File) {
    if (file.type.startsWith('image/')) void addImage(file);
    else void loadFile(file);
  }

  async function addTextArt(data: Omit<TextArtAnnotation, 'id' | 'pageNumber' | 'x' | 'y'>) {
    const item = project!;
    setBusy(true);
    try {
      const bytes = await renderTextArtToPngBytes({ ...data, id: item.id, pageNumber: 1, x: 0, y: 0 }, 240, 96);
      const image = await readSignatureImage(new File([bytes], 'TextArt.png', { type: 'image/png' }));
      const changes: Partial<SignatureProject> = {
        textArt: { image, alt: data.text.slice(0, 500), width: item.textArt?.width ?? 160 },
      };
      if (textArtBefore !== undefined) changes.blockOrder = placedOrder('textArt', textArtBefore);
      update(changes, undefined, item.id);
      setSelection('textArt');
      setMode('edit');
      setStatus('TextArt als eigener Baustein eingefügt.');
    } catch {
      setStatus('TextArt konnte nicht als Grafik übernommen werden.');
    } finally {
      setTextArtBefore(undefined);
      setBusy(false);
    }
  }

  // ---------- small render helpers ----------

  function textField(key: keyof SignatureFields, multiline = false) {
    const shared = {
      id: `sig-field-${key}`,
      className: inputClass,
      value: project![key],
      maxLength: 12_000,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update({ [key]: event.target.value }, `text-${key}`),
      onFocus: () => {
        const block = key === 'greeting' || key === 'note' || key === 'legal' ? key
          : ['name', 'role', 'company', 'email', 'phone', 'website', 'social'].includes(key) ? 'identity' : undefined;
        if (block && canvasBlocks.some(item => item.key === block)) setSelection(block);
      },
    };
    return (
      <label className="block min-w-0 space-y-1" key={key}>
        <span className="text-[11px] font-semibold text-gray-500">{fields[key]}</span>
        {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} />}
      </label>
    );
  }

  function layoutSwitch() {
    return (
      <div className="flex rounded-xl bg-[#F5F5F7] p-0.5" role="group" aria-label="Anordnung von Grafik und Text">
        <button type="button" className={segmentClass} aria-pressed={project!.layout === 'columns'}
          onClick={() => update({ layout: 'columns' })}><Columns2 size={14} /> Grafik neben Text</button>
        <button type="button" className={segmentClass} aria-pressed={project!.layout === 'stacked'}
          onClick={() => update({ layout: 'stacked' })}><Rows2 size={14} /> Untereinander</button>
      </div>
    );
  }

  function columnDividerControls(item: SignatureProject) {
    return (
      <div className="space-y-2 pt-1">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-gray-600">Vertikaler Trennstrich</span>
          <select className={inputClass} value={item.dividerStyle ?? (item.profile === 'business' ? 'accent' : 'none')}
            onChange={event => update({ dividerStyle: event.currentTarget.value as DividerStyle })}>
            <option value="none">Kein Trennstrich</option>
            <option value="accent">Akzentfarbe (wie im Beispiel)</option>
            <option value="gray">Dezentes Grau</option>
          </select>
        </label>
        {(item.dividerStyle === 'accent' || item.dividerStyle === 'gray') && (
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-600">Strichstärke</span>
            <select className={inputClass} value={item.dividerWidth ?? 2}
              onChange={event => update({ dividerWidth: Number(event.currentTarget.value) })}>
              <option value="1">1 px (fein)</option>
              <option value="2">2 px (markant wie Vorlage)</option>
              <option value="3">3 px (kräftig)</option>
            </select>
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-gray-600">Vertikale Ausrichtung</span>
          <select className={inputClass} value={item.valign ?? (item.profile === 'business' ? 'middle' : 'top')}
            onChange={event => update({ valign: event.currentTarget.value as VerticalAlign })}>
            <option value="middle">Mittig zentriert (ausbalanciert)</option>
            <option value="top">Oben bündig</option>
          </select>
        </label>
      </div>
    );
  }

  function widthSlider(label: string, value: number, onChange: (value: number) => void) {
    return (
      <label className="block space-y-1">
        <span className="flex justify-between text-[11px] font-semibold text-gray-500"><span>{label}</span><span>{value} px</span></span>
        <input className="block w-full accent-[#0071E3]" type="range" min="32" max="240" value={value}
          onChange={event => onChange(Number(event.currentTarget.value))} />
      </label>
    );
  }

  function blockTextArea(key: InlineText) {
    return (
      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-gray-500">Text</span>
        <textarea className={inputClass} rows={key === 'legal' ? 5 : 3} maxLength={12_000} value={project![key]}
          onChange={event => update({ [key]: event.currentTarget.value }, `text-${key}`)} />
      </label>
    );
  }

  function inspector() {
    const item = project!;
    if (!activeSelection) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 px-4 py-6 text-center">
          <MousePointerClick size={22} className="text-[#0071E3]" />
          <p className="text-xs font-semibold text-gray-800">Baustein in der Signatur anklicken</p>
          <p className="text-[11px] text-gray-500">Dann erscheinen hier Schrift, Farbe, Größe und weitere Einstellungen.</p>
        </div>
      );
    }
    if (activeSelection === 'divider') {
      const isVertical = item.layout === 'columns' && item.dividerStyle && item.dividerStyle !== 'none';
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500">Ausrichtung der Linie</span>
            <div className="flex rounded-xl bg-[#F5F5F7] p-0.5" role="group" aria-label="Ausrichtung der Trennlinie">
              <button
                type="button"
                className={segmentClass}
                aria-pressed={!isVertical}
                onClick={() => {
                  update({ showDivider: true });
                }}
              >
                Waagerecht
              </button>
              <button
                type="button"
                className={segmentClass}
                aria-pressed={isVertical}
                onClick={() => {
                  update({
                    layout: 'columns',
                    dividerStyle: item.dividerStyle && item.dividerStyle !== 'none' ? item.dividerStyle : 'accent',
                    valign: item.valign ?? 'middle',
                  });
                }}
              >
                Senkrecht (am Logo)
              </button>
            </div>
          </div>

          {isVertical ? (
            <div className="space-y-2.5 rounded-xl border border-blue-200/70 bg-blue-50/40 p-2.5">
              <span className="text-[11px] font-bold text-blue-900">Senkrechter Strich neben dem Logo</span>
              {!hasLogo && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-gray-600">Lade noch ein Logo oder Foto hoch, damit der Strich daneben steht:</p>
                  <button type="button" className={`${secondaryClass} w-full`} onClick={() => imageInput.current?.click()}>
                    <ImagePlus size={14} /> Logo / Foto hinzufügen
                  </button>
                </div>
              )}
              {columnDividerControls(item)}
            </div>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-gray-500">Linienfarbe</span>
                <select className={inputClass} value={item.horizontalDividerColor ?? 'gray'}
                  onChange={event => update({ horizontalDividerColor: event.currentTarget.value as 'accent' | 'gray' })}>
                  <option value="gray">Dezentes Grau</option>
                  <option value="accent">Akzentfarbe</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-semibold text-gray-500">Linienstärke</span>
                <select className={inputClass} value={item.horizontalDividerWidth ?? 1}
                  onChange={event => update({ horizontalDividerWidth: Number(event.currentTarget.value) })}>
                  <option value="1">1 px (fein)</option>
                  <option value="2">2 px (markant)</option>
                  <option value="3">3 px (kräftig)</option>
                </select>
              </label>
            </>
          )}

          <button type="button" className={`${secondaryClass} w-full text-red-600 hover:bg-red-50`} onClick={() => {
            clear('divider');
            if (isVertical) update({ dividerStyle: 'none' });
          }}>
            <Trash2 size={14} /> Trennlinie entfernen
          </button>
        </div>
      );
    }
    if (activeSelection === 'logo') {
      return (
        <div className="space-y-3">
          {item.image && (
            <div className="flex items-center justify-center rounded-xl bg-[#F5F5F7] p-3">
              <img src={item.image} alt="" className="max-h-24 max-w-full object-contain" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => imageInput.current?.click()}>
              <ImagePlus size={14} /> Ersetzen
            </button>
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => clear('logo')}>
              <Trash2 size={14} /> Entfernen
            </button>
          </div>
          {widthSlider('Breite', item.imageWidth, width => changeImageWidth('logo', width))}
          
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500">Bildform & Stil</span>
            <div className="flex rounded-xl bg-[#F5F5F7] p-0.5" role="group" aria-label="Bildform">
              <button type="button" className={segmentClass} aria-pressed={(!item.imageShape || item.imageShape === 'square')}
                onClick={() => update({ imageShape: 'square' })}>Eckig</button>
              <button type="button" className={segmentClass} aria-pressed={item.imageShape === 'rounded'}
                onClick={() => update({ imageShape: 'rounded' })}>Abgerundet</button>
              <button type="button" className={segmentClass} aria-pressed={item.imageShape === 'circle'}
                onClick={() => update({ imageShape: 'circle' })}>Rund (Avatar)</button>
            </div>
            <label className="flex items-center gap-2 pt-1 text-[11px] font-medium text-gray-700 cursor-pointer">
              <input type="checkbox" checked={Boolean(item.imageBorder)} onChange={event => update({ imageBorder: event.currentTarget.checked })} />
              Feiner Rahmen um die Grafik
            </label>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-gray-500">Anordnung</span>
            {layoutSwitch()}
          </div>

          {item.layout === 'columns' && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              <span className="text-[11px] font-semibold text-gray-500">Trennstrich & Ausrichtung</span>
              {columnDividerControls(item)}
            </div>
          )}

          {textField('imageAlt')}
          {textField('imageUrl')}
          {item.imageUrl && !httpsUrl(item.imageUrl) && <p className="text-[11px] text-amber-800">Gib eine vollständige HTTPS-Adresse für die Grafik ein.</p>}
          {item.image && (
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => void downloadImage()}>
              <Download size={14} /> Grafik laden ({item.imageWidth} px)
            </button>
          )}
        </div>
      );
    }
    if (activeSelection === 'textArt' && item.textArt) {
      return (
        <div className="space-y-3">
          {widthSlider('Breite', item.textArt.width, width => changeImageWidth('textArt', width))}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => setTextArtOpen(true)}>
              <Sparkles size={14} /> Ersetzen
            </button>
            <button type="button" className={secondaryClass} disabled={busy} onClick={() => clear('textArt')}>
              <Trash2 size={14} /> Entfernen
            </button>
          </div>
        </div>
      );
    }
    if (activeSelection === 'identity') {
      return (
        <div className="space-y-3">
          <div className="flex rounded-xl bg-[#F5F5F7] p-0.5" role="group" aria-label="Textbereich">
            <button type="button" className={segmentClass} aria-pressed={identityTarget === 'name'}
              onClick={() => setIdentityTarget('name')}>Name</button>
            <button type="button" className={segmentClass} aria-pressed={identityTarget === 'identity'}
              onClick={() => setIdentityTarget('identity')}>Kontaktdaten</button>
          </div>
          <SignatureStylePanel project={item} target={identityTarget} onChangeStyle={changeTextStyle} />

          <div className="space-y-1 border-t border-gray-100 pt-3">
            <span className="text-[11px] font-semibold text-gray-500">Kontaktzeilen-Beschriftung</span>
            <select className={inputClass} value={item.contactLabels ?? (item.profile === 'business' ? 'text' : 'none')}
              onChange={event => update({ contactLabels: event.currentTarget.value as ContactLabelStyle })}>
              <option value="text">Klassisch (Tel., E-Mail, Web)</option>
              <option value="compact">Kompakt (T:, E:, W:)</option>
              <option value="icon">Symbole (📞, ✉️, 🌐)</option>
              <option value="none">Ohne Präfix (nur Kontaktdaten)</option>
            </select>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-3">
            <span className="text-[11px] font-semibold text-gray-500">Logo / Foto & Trennstrich</span>
            {hasLogo ? (
              <>
                {layoutSwitch()}
                {item.layout === 'columns' && columnDividerControls(item)}
                <button type="button" className={`${secondaryClass} w-full`} onClick={() => setSelection('logo')}>
                  <ImagePlus size={14} /> Grafik & Form bearbeiten
                </button>
              </>
            ) : (
              <button type="button" className={`${secondaryClass} w-full`} disabled={busy} onClick={() => imageInput.current?.click()}>
                <ImagePlus size={14} /> Foto, Logo oder Banner hinzufügen
              </button>
            )}
          </div>
        </div>
      );
    }
    const key = activeSelection as InlineText;
    return (
      <div className="space-y-3">
        <SignatureStylePanel project={item} target={key} onChangeStyle={changeTextStyle} />
        {blockTextArea(key)}
        {key === 'legal' && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-gray-500">Textbaustein für Geschäftsangaben</span>
              <select className={inputClass} value={legalTemplate} onChange={event =>
                setLegalTemplate(event.currentTarget.value as keyof typeof legalTemplates)}>
                {Object.entries(legalTemplates).map(([value, entry]) => <option key={value} value={value}>{entry.label}</option>)}
              </select>
            </label>
            <button type="button" className={`${secondaryClass} w-full`} disabled={!canInsertTemplate}
              onClick={() => update({ legal: [template.text, legalText].filter(Boolean).join('\n\n') })}>Textbaustein einsetzen</button>
            {!canInsertTemplate && <p className="text-[11px] text-gray-500">Leere das Textfeld, um eine Vorlage einzusetzen.</p>}
            <p className="text-[11px] text-gray-500">{template.hint} <a className="underline" href={template.url} target="_blank" rel="noreferrer">{template.source}</a></p>
            <button type="button" className={`${secondaryClass} w-full`}
              disabled={item.legal.includes(smallBusinessNote) || legalWithNote.length > 12_000}
              onClick={() => update({ legal: legalWithNote })}>Kleinunternehmer-Hinweis ergänzen</button>
            <p className="text-[11px] text-gray-500">Optional, wenn du die Kleinunternehmerregelung anwendest. Bei steuerfreien Kleinunternehmerumsätzen gehört der Hinweis auch auf die Rechnung. <a className="underline" href="https://www.gesetze-im-internet.de/ustdv_1980/__34a.html" target="_blank" rel="noreferrer">§ 34a UStDV</a></p>
          </div>
        )}
      </div>
    );
  }

  const selectionLabel = activeSelection === 'logo' ? 'Logo / Foto' : activeSelection ? signatureBlocks[activeSelection] : 'Auswahl';
  const zoomIndex = zoomSteps.indexOf(zoom);

  return (
    <section className="flex h-[calc(100vh-68px)] flex-col overflow-y-auto bg-[#F5F5F7] lg:overflow-hidden" aria-labelledby="mail-signatures-title">
      <h2 id="mail-signatures-title" className="sr-only">E-Mail-Signaturen</h2>
      <input ref={importInput} className="hidden" type="file" accept=".json,.html,.htm,.txt"
        onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void loadFile(file);
        }} />
      <input ref={imageInput} className="hidden" type="file" accept="image/png,image/jpeg" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void addImage(file);
      }} />

      {/* ---------- Top toolbar: project & view ---------- */}
      <div className="z-20 flex min-h-[56px] flex-wrap items-center justify-between gap-2 border-b border-[#E8E8ED] bg-white px-3 py-1.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#0071E3]/10 text-[#0071E3]" title="E-Mail-Signaturen">
            <Mail size={16} aria-hidden="true" />
          </span>
          <label className="relative">
            <span className="sr-only">Meine Signaturen</span>
            <select className="h-8 max-w-[200px] appearance-none rounded-xl border border-gray-200 bg-[#F5F5F7] pl-2.5 pr-7 text-xs font-semibold focus:border-[#0071E3] focus:outline-none"
              value={project.id} disabled={busy} title={`Meine Signaturen (${library.projects.length})`}
              onChange={event => {
                const activeId = event.currentTarget.value;
                const next = { ...library, activeId };
                libraryRef.current = next;
                setLibrary(next);
                setSelection(undefined);
                setStatus('');
              }}>
              {library.projects.map(item => <option key={item.id} value={item.id}>{item.title || 'Unbenannte Signatur'}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-2 text-gray-500" />
          </label>
          <input aria-label="Projektname" className="h-8 w-36 rounded-xl border border-gray-200 bg-white px-2.5 text-xs font-semibold focus:border-[#0071E3] focus:outline-none sm:w-44"
            value={project.title} maxLength={200} onChange={event => update({ title: event.currentTarget.value }, 'text-title')} />
          <div className="relative">
            <button type="button" className={pillClass} disabled={busy} aria-expanded={newMenuOpen} onClick={() => setNewMenuOpen(open => !open)}>
              <Plus size={14} /> Neu <ChevronDown size={12} />
            </button>
            {newMenuOpen && (
              <div className="absolute left-0 top-9 z-40 w-48 space-y-1 rounded-2xl border border-gray-200 bg-white p-2 text-xs shadow-2xl"
                onMouseLeave={() => setNewMenuOpen(false)}>
                {(['private', 'business'] as const).map(profile => (
                  <button key={profile} type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-semibold hover:bg-gray-100"
                    onClick={() => { add(createSignature(profile)); setNewMenuOpen(false); }}>
                    <Plus size={14} className="text-[#0071E3]" /> {profile === 'private' ? 'Private Signatur' : 'Geschäftliche Signatur'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className={pillClass} disabled={busy} onClick={() => importInput.current?.click()} title="Signaturprojekt (.json), HTML- oder Textdatei öffnen">
            <FolderOpen size={14} /> <span className="hidden xl:inline">Öffnen</span>
          </button>
          <button type="button" className={pillClass} disabled={busy} title="Duplizieren" onClick={() => add({
            ...project, id: createSignature(project.profile).id, title: `${project.title} – Kopie`,
          })}><CopyPlus size={14} /> <span className="hidden xl:inline">Duplizieren</span></button>
          <button type="button" className={`${pillClass} hover:bg-red-50 hover:text-red-600`} disabled={busy} title="Signatur löschen" onClick={() => remove(project)}>
            <Trash2 size={14} />
          </button>
          <div className="ml-0.5 flex items-center rounded-xl bg-[#F5F5F7] p-0.5">
            <button type="button" className="rounded-lg p-1.5 text-gray-700 transition hover:bg-white disabled:opacity-30" disabled={!history.current.past.length}
              title="Rückgängig (⌘Z / Strg+Z)" aria-label="Rückgängig" onClick={undo}><Undo2 size={15} /></button>
            <button type="button" className="rounded-lg p-1.5 text-gray-700 transition hover:bg-white disabled:opacity-30" disabled={!history.current.future.length}
              title="Wiederholen (⌘⇧Z / Strg+Y)" aria-label="Wiederholen" onClick={redo}><Redo2 size={15} /></button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex rounded-xl bg-[#F5F5F7] p-0.5" role="group" aria-label="Ansicht">
            {previewModes.map(item => (
              <button key={item.value} type="button" className={`${segmentClass} flex-none`} aria-pressed={mode === item.value}
                onClick={() => setMode(item.value)}>{item.label}</button>
            ))}
          </div>
          <button type="button" className={primaryClass} disabled={busy} onClick={() => {
            exportSignatureProject(project);
            setStatus('Projektdatei heruntergeladen.');
          }}><Download size={14} /> Projekt sichern</button>
        </div>
      </div>
      {persistError && (
        <p role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-900">
          Der Browser konnte den Entwurf nicht sichern. Lade eine Projektdatei herunter.
        </p>
      )}

      {/* ---------- Workspace: content | design window | inspector ---------- */}
      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        {/* Left: building blocks and content */}
        <aside className="order-2 flex flex-col gap-4 border-[#E8E8ED] bg-white p-3 lg:order-none lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-r">
          <div className="space-y-2">
            <div className={sectionTitle}>Bausteine</div>
            <div className="grid grid-cols-2 gap-1.5">
              {paletteItems.filter(entry => !entry.businessOnly || project.profile === 'business').map(({ item, label, icon: Icon }) => {
                const used = item === 'logo' ? hasLogo : canvasBlocks.some(block => block.key === item && block.html);
                return (
                  <button
                    key={item}
                    type="button"
                    draggable
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      event.dataTransfer.effectAllowed = 'copy';
                      event.dataTransfer.setData(PALETTE_MIME, item);
                      event.dataTransfer.setData('text/plain', label);
                    }}
                    onClick={() => paletteClick(item)}
                    className={`group relative flex cursor-grab flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-semibold transition active:cursor-grabbing ${activeSelection === item ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3]' : 'border-gray-200 bg-[#FAFAFC] text-gray-700 hover:border-[#0071E3]/50 hover:bg-white'}`}
                    title={used ? `${label} auswählen – oder an eine andere Stelle ziehen` : `${label} in die Signatur ziehen oder anklicken`}
                  >
                    <Icon size={18} className={used ? 'text-[#0071E3]' : 'text-gray-500 group-hover:text-[#0071E3]'} />
                    {label}
                    {used && <Check size={11} className="absolute right-1.5 top-1.5 text-emerald-600" aria-label="verwendet" />}
                  </button>
                );
              })}
            </div>
            <p className="px-1 text-[11px] text-gray-500">In die Signatur ziehen oder anklicken. Bilder kannst du direkt aus dem Finder auf die Signatur ziehen.</p>
          </div>

          <div className="space-y-2.5">
            <div className={sectionTitle}>{project.profile === 'private' ? 'Angaben · privat' : 'Angaben · geschäftlich'}</div>
            {textField('name')}
            {project.profile === 'business' && (
              <div className="grid grid-cols-2 gap-2">{(['role', 'company'] as const).map(key => textField(key))}</div>
            )}
            {textField('address')}
            {(['phone', 'email', 'website', 'social'] as const).map(key => textField(key))}
            <div className="space-y-1.5 rounded-xl border border-gray-200/70 bg-[#F5F5F7]/60 p-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Aktions-Button (optional)</span>
              {textField('ctaText')}
              {textField('ctaUrl')}
            </div>
            {textField('greeting')}
            {textField('note', true)}
            {project.profile === 'business' && textField('legal', true)}
          </div>
        </aside>

        {/* Center: dominant design window */}
        <div className="relative order-1 flex min-h-[70vh] flex-1 flex-col bg-[#E5E5EA] lg:order-none lg:min-h-0">
          <SignatureCanvas
            key={project.id}
            project={project}
            blocks={canvasBlocks}
            selection={activeSelection}
            mode={mode}
            device={device}
            zoom={zoom}
            previewHtml={previewOutput.html}
            plain={output.plain}
            previewRef={preview}
            onSelect={next => {
              setSelection(next);
              if (next) setRightTab('design');
            }}
            onPlace={placeBlock}
            onPaletteDrop={insertFromPalette}
            onFileDrop={dropFile}
            onClear={clear}
            onReplaceImage={() => imageInput.current?.click()}
            onChangeText={(field, value) => update({ [field]: value }, `text-${field}`)}
            onEditIdentity={() => focusField('name')}
            onImageWidth={changeImageWidth}
          />

          {status && (
            <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-20 max-w-[90%] -translate-x-1/2 rounded-2xl bg-gray-900/90 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur">
              {status}
            </div>
          )}

          {/* Floating view controls, like the page navigation in "Bearbeiten & Signieren" */}
          <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-gray-200/80 bg-white/90 px-2.5 py-1.5 shadow-xl backdrop-blur-md">
            <div className="flex rounded-xl bg-[#F5F5F7] p-0.5" role="group" aria-label="Bildschirmbreite">
              <button type="button" className={segmentClass} aria-pressed={device === 'desktop'} title="Desktop-Ansicht"
                onClick={() => setDevice('desktop')}><Monitor size={14} /><span className="hidden sm:inline">Desktop</span></button>
              <button type="button" className={segmentClass} aria-pressed={device === 'mobile'} title="Schmale Ansicht (Smartphone)"
                onClick={() => setDevice('mobile')}><Smartphone size={14} /><span className="hidden sm:inline">Mobil</span></button>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <button type="button" className="rounded-xl p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-30" aria-label="Verkleinern"
              disabled={zoomIndex <= 0} onClick={() => setZoom(zoomSteps[zoomIndex - 1])}><ZoomOut size={16} /></button>
            <button type="button" className="w-11 text-center font-mono text-[11px] font-semibold text-gray-700" title="Auf 100 % zurücksetzen"
              onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
            <button type="button" className="rounded-xl p-1 text-gray-700 hover:bg-gray-100 disabled:opacity-30" aria-label="Vergrößern"
              disabled={zoomIndex >= zoomSteps.length - 1} onClick={() => setZoom(zoomSteps[zoomIndex + 1])}><ZoomIn size={16} /></button>
          </div>
          {mode === 'edit' && (
            <p className="pointer-events-none absolute left-4 top-3 hidden max-w-[260px] text-[11px] leading-snug text-gray-500 xl:block">
              Ziehen zum Anordnen · Doppelklick zum Bearbeiten · blaue Ecke ziehen für die Bildgröße · ⌘Z rückgängig
            </p>
          )}
        </div>

        {/* Right: inspector and output */}
        <aside className="order-3 flex flex-col border-[#E8E8ED] bg-white lg:w-80 lg:shrink-0 lg:overflow-hidden lg:border-l">
          <div className="flex gap-1 border-b border-[#E8E8ED] p-2">
            <div className="flex flex-1 rounded-xl bg-[#F5F5F7] p-0.5" role="tablist" aria-label="Seitenleiste">
              <button type="button" role="tab" aria-selected={rightTab === 'design'} aria-pressed={rightTab === 'design'} className={segmentClass}
                onClick={() => setRightTab('design')}><Palette size={14} /> Gestalten</button>
              <button type="button" role="tab" aria-selected={rightTab === 'export'} aria-pressed={rightTab === 'export'} className={segmentClass}
                onClick={() => setRightTab('export')}><Send size={14} /> Einrichten</button>
            </div>
          </div>
          <div className="flex-1 space-y-5 p-3 lg:overflow-y-auto">
            {rightTab === 'design' ? (
              <>
                <div className="space-y-2.5">
                  <div className={sectionTitle}>{selectionLabel}</div>
                  {inspector()}
                </div>
                <div className="space-y-2.5 border-t border-gray-100 pt-4">
                  <div className={sectionTitle}>Gesamtes Design</div>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500">Standardschrift</span>
                    <select className={inputClass} value={project.font} style={{ fontFamily: signatureFonts[project.font] }}
                      onChange={event => update({ font: event.currentTarget.value as SignatureProject['font'] })}>
                      {Object.keys(signatureFonts).map(font => <option key={font}>{font}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500">Zeilenabstand</span>
                    <select className={inputClass} value={project.spacing ?? 'normal'}
                      onChange={event => update({ spacing: event.currentTarget.value as SpacingStyle })}>
                      <option value="compact">Kompakt (knapper Raum)</option>
                      <option value="normal">Standard (harmonisch)</option>
                      <option value="relaxed">Luftig (moderner Freiraum)</option>
                    </select>
                  </label>
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-gray-500">Akzentfarbe (Name, Trennstrich & Links)</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {accentSwatches.map(color => (
                        <button key={color} type="button" aria-label={`Akzentfarbe ${color}`} aria-pressed={project.color.toLowerCase() === color.toLowerCase()}
                          className="h-6 w-6 rounded-full border-2 border-white shadow ring-1 ring-gray-200 transition hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-[#0071E3]"
                          style={{ backgroundColor: color }} onClick={() => update({ color })} />
                      ))}
                      <input type="color" aria-label="Eigene Akzentfarbe" className="h-7 w-9 cursor-pointer rounded-lg border border-gray-200 bg-white p-0.5"
                        value={project.color} onChange={event => update({ color: event.currentTarget.value }, 'color-accent')} />
                    </div>
                  </div>
                  {hasLogo && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-gray-500">Anordnung</span>
                      {layoutSwitch()}
                      {project.layout === 'columns' && columnDividerControls(project)}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className={sectionTitle}>Im Mailprogramm einrichten</div>
                <select className={inputClass} aria-label="Mailprogramm" value={client} onChange={event => setClient(event.currentTarget.value as keyof typeof clients)}>
                  {Object.entries(clients).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <p className="rounded-xl bg-[#F5F5F7] p-3 text-xs leading-relaxed text-gray-700">{instructions[client]}</p>
                <div className="flex flex-col gap-2">
                  {client === 'apple' && <button type="button" className={primaryClass}
                    disabled={busy || (!output.plain && !hasGraphics)}
                    onClick={() => void downloadAppleMail()}><Download size={14} /> Für Apple Mail laden (.eml)</button>}
                  {client !== 'mobile' && (client !== 'apple' || (!project.image && !project.textArt)) && <button type="button"
                    className={client === 'apple' || client === 'thunderbird' ? secondaryClass : primaryClass} disabled={!output.plain && !hasGraphics}
                    onClick={() => void copy(true)}><Copy size={14} /> Formatiert kopieren</button>}
                  <button type="button" className={client === 'mobile' ? primaryClass : secondaryClass} disabled={!output.plain} onClick={() => void copy(false)}>Klartext kopieren</button>
                  {client !== 'mobile' && <button type="button" className={client === 'thunderbird' ? primaryClass : secondaryClass} onClick={() => downloadSignature(
                    `${fileName}.html`,
                    new Blob([`<!doctype html><html lang="de"><meta charset="utf-8"><title>Signatur</title><body>${output.html}</body></html>`], { type: 'text/html;charset=utf-8' }),
                  )}>HTML laden</button>}
                  <button type="button" className={secondaryClass} disabled={!output.plain} onClick={() => downloadSignature(
                    `${fileName}.txt`, new Blob([output.plain], { type: 'text/plain;charset=utf-8' }),
                  )}>Textdatei laden</button>
                  {project.image && <button type="button" className={secondaryClass} disabled={busy} onClick={() => void downloadImage()}>
                    Grafik laden ({project.imageWidth} px)
                  </button>}
                </div>
                {client === 'apple' && !project.image && httpsUrl(project.imageUrl) && (
                  <p className="text-[11px] text-gray-500">Lade die Grafik als Datei hoch, damit sie beim Apple-Mail-Export eingebettet wird.</p>
                )}
                {hasGraphics && client !== 'mobile' && client !== 'apple' && (
                  <p className="text-[11px] text-gray-500">Prüfe die Grafik mit einer Testmail. Je nach Mailprogramm kannst du sie separat im Signatur-Editor einsetzen.</p>
                )}
                <p className="text-[11px] text-gray-500">Entwürfe werden automatisch in diesem Browser gespeichert. Mit „Projekt sichern“ erhältst du eine Datei zum Weitergeben oder Wiederherstellen.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {textArtOpen && (
        <TextArtModal isOpen onClose={() => { setTextArtOpen(false); setTextArtBefore(undefined); }}
          onInsert={data => void addTextArt(data)} />
      )}
    </section>
  );
}
