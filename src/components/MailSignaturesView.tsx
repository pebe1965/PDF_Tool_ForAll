import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, ImagePlus, Mail, Plus, Upload } from 'lucide-react';
import { TextArtModal } from './TextArtModal';
import { renderTextArtToPngBytes } from '../lib/textArtHelper';
import {
  createAppleMailSignature, createSignature, downloadSignature, exportSignatureProject, fields, httpsUrl,
  importSignature, loadSignatureLibrary, readSignatureImage, renderSignature, resizeSignatureImage,
  saveSignatureLibrary, signatureBlocks, signatureFileName,
} from '../lib/mailSignatures';
import type { SignatureBlock, SignatureFields, SignatureLibrary, SignatureProject } from '../lib/mailSignatures';
import type { TextArtAnnotation } from '../types/pdf';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50';
const primaryClass = 'inline-flex items-center justify-center gap-2 rounded-lg bg-[#0071E3] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0063c7] disabled:opacity-50';
const cardClass = 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5';

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

export function MailSignaturesView() {
  const [library, setLibrary] = useState<SignatureLibrary>();
  const [persistError, setPersistError] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [client, setClient] = useState<keyof typeof clients>('apple');
  const [previewMode, setPreviewMode] = useState('light');
  const [narrow, setNarrow] = useState(false);
  const [textArtOpen, setTextArtOpen] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLDivElement>(null);

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

  const project = library?.projects.find(item => item.id === library.activeId);
  if (!library || !project) return <p className="p-6">Signaturen werden geladen …</p>;

  const output = renderSignature(project);
  const previewHtml = renderSignature(project, {
    hideImage: previewMode === 'blocked',
    preferLocalImage: true,
  }).html;
  const fileName = signatureFileName(project.title);
  const blockOrder = project.blockOrder ?? Object.keys(signatureBlocks) as SignatureBlock[];
  const visibleBlocks = blockOrder.filter(key => key !== 'legal' || project.profile === 'business');

  function update(id: string, changes: Partial<SignatureProject>) {
    setLibrary(previous => previous && ({
      ...previous,
      projects: previous.projects.map(item => item.id === id ? { ...item, ...changes } : item),
    }));
  }

  function moveBlock(key: SignatureBlock, direction: number) {
    if (!project) return;
    const neighbor = visibleBlocks[visibleBlocks.indexOf(key) + direction];
    if (!neighbor) return;
    const updated = [...blockOrder];
    const from = updated.indexOf(key);
    const to = updated.indexOf(neighbor);
    [updated[from], updated[to]] = [updated[to], updated[from]];
    update(project.id, { blockOrder: updated });
  }

  function add(item: SignatureProject) {
    setLibrary(previous => previous && ({ activeId: item.id, projects: [...previous.projects, item] }));
    setStatus('');
  }

  function remove(item: SignatureProject) {
    if (!window.confirm(`„${item.title || 'Signatur'}“ aus diesem Browser löschen?`)) return;
    setLibrary(previous => {
      if (!previous) return previous;
      const remaining = previous.projects.filter(other => other.id !== item.id);
      const projects = remaining.length ? remaining : [createSignature('private')];
      return { activeId: projects[0].id, projects };
    });
    setStatus('Signatur gelöscht.');
  }

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
      setPreviewMode(formatted ? 'light' : 'plain');
      setStatus('Markiere die Signatur in der Vorschau und kopiere sie manuell.');
      window.requestAnimationFrame(() => {
        if (!preview.current) return;
        const range = document.createRange();
        range.selectNodeContents(preview.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        preview.current.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  async function downloadAppleMail() {
    if (!project) return;
    setBusy(true);
    try {
      downloadSignature(`${fileName}.eml`, await createAppleMailSignature(project));
      setStatus('Datei für Apple Mail heruntergeladen.');
    } catch {
      setStatus('Der Export ist fehlgeschlagen. Prüfe, ob die Grafik in der Vorschau angezeigt wird.');
    } finally {
      setBusy(false);
    }
  }

  async function downloadImage() {
    if (!project) return;
    setBusy(true);
    try {
      const { blob, width } = await resizeSignatureImage(project);
      const extension = blob.type === 'image/jpeg' ? 'jpg' : 'png';
      downloadSignature(`${fileName}-${width}px.${extension}`, blob);
      setStatus('Grafik in der gewählten Größe heruntergeladen.');
    } catch {
      setStatus('Die Grafik konnte nicht skaliert werden.');
    } finally {
      setBusy(false);
    }
  }

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

  async function addImage(file: File, id: string, alt?: string) {
    setBusy(true);
    try {
      update(id, { image: await readSignatureImage(file), ...(alt ? { imageAlt: alt } : {}) });
      setStatus('Grafik übernommen.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Die Grafik konnte nicht geöffnet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function addTextArt(data: Omit<TextArtAnnotation, 'id' | 'pageNumber' | 'x' | 'y'>, id: string) {
    setBusy(true);
    try {
      const bytes = await renderTextArtToPngBytes({ ...data, id, pageNumber: 1, x: 0, y: 0 }, 240, 96);
      await addImage(new File([bytes], 'TextArt.png', { type: 'image/png' }), id, data.text);
    } catch {
      setStatus('TextArt konnte nicht als Grafik übernommen werden.');
    } finally {
      setBusy(false);
    }
  }

  function textField(key: keyof SignatureFields, multiline = false) {
    const shared = {
      className: inputClass,
      value: project![key],
      maxLength: 12_000,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        update(project!.id, { [key]: event.target.value }),
    };
    return (
      <label className={`block min-w-0 space-y-1 text-sm ${multiline ? 'sm:col-span-2' : ''}`} key={key}>
        <span className="font-medium">{fields[key]}</span>
        {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} />}
      </label>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6" aria-labelledby="mail-signatures-title">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="mail-signatures-title" className="flex items-center gap-2 text-2xl font-bold">
            <Mail size={24} aria-hidden="true" /> E-Mail-Signaturen
          </h2>
          <p className="mt-1 text-sm text-slate-600">Entwürfe werden in diesem Browser gespeichert.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonClass} disabled={busy} onClick={() => add(createSignature('private'))}><Plus size={16} /> Privat</button>
          <button className={buttonClass} disabled={busy} onClick={() => add(createSignature('business'))}><Plus size={16} /> Geschäftlich</button>
          <button className={buttonClass} disabled={busy} onClick={() => importInput.current?.click()}><Upload size={16} /> Projekt oder Signatur öffnen</button>
          <input ref={importInput} className="hidden" type="file" accept=".json,.html,.htm,.txt"
            onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void loadFile(file);
            }} />
        </div>
      </header>
      {persistError && <p role="alert" className="text-sm text-amber-800">Der Browser konnte den Entwurf nicht sichern. Lade eine Projektdatei herunter.</p>}
      <div className={`${cardClass} flex flex-wrap items-end gap-2`}>
        <label className="min-w-40 flex-1 space-y-1 text-sm font-medium">
          <span>{`Meine Signaturen (${library.projects.length})`}</span>
          <select className={inputClass} value={project.id} disabled={busy} onChange={event => {
            const activeId = event.currentTarget.value;
            setLibrary(previous => previous && ({ ...previous, activeId }));
            setStatus('');
          }}>
            {library.projects.map(item => <option key={item.id} value={item.id}>{item.title || 'Unbenannte Signatur'}</option>)}
          </select>
        </label>
        <button className={buttonClass} disabled={busy} onClick={() => add({
          ...project, id: createSignature(project.profile).id, title: `${project.title} – Kopie`,
        })}>Duplizieren</button>
        <button className={buttonClass} disabled={busy} onClick={() => remove(project)}>Löschen</button>
        <button className={primaryClass} disabled={busy} onClick={() => {
          exportSignatureProject(project);
          setStatus('Projektdatei heruntergeladen.');
        }}><Download size={16} /> Projekt sichern</button>
      </div>
      <p role="status" className="min-h-5 text-sm text-slate-700">{status}</p>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <div className={cardClass}>
            <h3 className="mb-3 font-semibold">{project.profile === 'private' ? 'Private Signatur' : 'Geschäftliche Signatur'}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['title', 'greeting', 'name'] as const).map(key => textField(key))}
              {project.profile === 'business' && (['role', 'company'] as const).map(key => textField(key))}
              {(['email', 'phone', 'website', 'social'] as const).map(key => textField(key))}
              {textField('note', true)}
              {project.profile === 'business' && textField('legal', true)}
            </div>
            {project.profile === 'business' && (
              <div className="mt-3 space-y-2">
                <button className={buttonClass} disabled={Boolean(project.legal.trim())} onClick={() => update(project.id, {
                  legal: 'Rechtsform und Sitz: [Angabe]\nRegistergericht und Registernummer: [Angabe]\nGeschäftsführung: [Name(n)]',
                })}>GmbH-/UG-Textbaustein einsetzen</button>
                <p className="text-xs text-slate-600">Ergänze die Angaben deiner Gesellschaft und prüfe, welche weiteren Angaben für sie gelten. <a className="underline" href="https://www.gesetze-im-internet.de/gmbhg/__35a.html" target="_blank" rel="noreferrer">§ 35a GmbHG</a></p>
              </div>
            )}
          </div>
          <div className={cardClass}>
            <h3 className="mb-3 font-semibold">Gestaltung und Grafik</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-sm font-medium">
                <span>Layout</span>
                <select className={inputClass} value={project.layout} onChange={event =>
                  update(project.id, { layout: event.currentTarget.value as SignatureProject['layout'] })}>
                  <option value="stacked">Untereinander</option>
                  <option value="columns">Grafik neben Text</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Schrift</span>
                <select className={inputClass} value={project.font} onChange={event =>
                  update(project.id, { font: event.currentTarget.value as SignatureProject['font'] })}>
                  <option>Arial</option><option>Georgia</option><option>Verdana</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                <span>Akzentfarbe</span>
                <input className={`${inputClass} h-10 p-1`} type="color" value={project.color}
                  onChange={event => update(project.id, { color: event.currentTarget.value })} />
              </label>
            </div>
            <div className="my-3 flex flex-wrap gap-2">
              <button className={buttonClass} disabled={busy} onClick={() => imageInput.current?.click()}><ImagePlus size={16} /> Foto, Logo oder Banner</button>
              <button className={buttonClass} disabled={busy} onClick={() => setTextArtOpen(true)}>TextArt erstellen</button>
              {(project.image || project.imageUrl) && <button className={buttonClass} disabled={busy} onClick={() => update(project.id, { image: '', imageUrl: '' })}>Grafik entfernen</button>}
              <input ref={imageInput} className="hidden" type="file" accept="image/png,image/jpeg" onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void addImage(file, project.id);
              }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {textField('imageAlt')}
              {textField('imageUrl')}
              <label className="space-y-1 text-sm font-medium">
                <span>Bildbreite ({project.imageWidth} px)</span>
                <input className="block w-full" type="range" min="32" max="240" value={project.imageWidth}
                  onChange={event => update(project.id, { imageWidth: Number(event.currentTarget.value) })} />
              </label>
            </div>
            {project.imageUrl && !httpsUrl(project.imageUrl) && <p className="mt-2 text-sm text-amber-800">Gib eine vollständige HTTPS-Adresse für die Grafik ein.</p>}
            <h4 className="mb-2 mt-4 text-sm font-semibold">Reihenfolge</h4>
            <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
              {visibleBlocks.map((key, index) => (
                <li key={key} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span>{signatureBlocks[key]}</span>
                  <span className="flex gap-1">
                    <button type="button" className={buttonClass} disabled={index === 0}
                      aria-label={`${signatureBlocks[key]} nach oben`} onClick={() => moveBlock(key, -1)}><ArrowUp size={14} /></button>
                    <button type="button" className={buttonClass} disabled={index === visibleBlocks.length - 1}
                      aria-label={`${signatureBlocks[key]} nach unten`} onClick={() => moveBlock(key, 1)}><ArrowDown size={14} /></button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="min-w-0 space-y-5">
          <div className={cardClass}>
            <h3 className="mb-3 font-semibold">Vorschau</h3>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <select className={`${inputClass} w-auto`} aria-label="Vorschau-Modus" value={previewMode} onChange={event => setPreviewMode(event.currentTarget.value)}>
                <option value="light">Hell</option>
                <option value="dark">Dunkel</option>
                <option value="blocked">Ohne Bilder</option>
                <option value="plain">Klartext</option>
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={narrow} onChange={event => setNarrow(event.currentTarget.checked)} /> Schmale Ansicht</label>
            </div>
            <div className={`overflow-auto rounded-xl border border-slate-200 p-3 ${narrow ? 'max-w-[320px]' : ''} ${previewMode === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
              <div ref={preview} className={`break-words ${previewMode === 'dark' ? '[&_td]:!text-slate-100 [&_strong]:!text-blue-300 [&_a]:!text-blue-300' : ''}`}
                onClick={event => {
                  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
                }}>
                {previewMode === 'plain'
                  ? <div className="whitespace-pre-wrap text-sm">{output.plain}</div>
                  : <div dangerouslySetInnerHTML={{ __html: previewHtml }} />}
              </div>
            </div>
          </div>
          <div className={cardClass}>
            <h3 className="mb-3 font-semibold">Im Mailprogramm einrichten</h3>
            <select className={inputClass} aria-label="Mailprogramm" value={client} onChange={event => setClient(event.currentTarget.value as keyof typeof clients)}>
              {Object.entries(clients).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <p className="my-3 text-sm text-slate-600">{instructions[client]}</p>
            <div className="flex flex-wrap gap-2">
              {client === 'apple' && <button className={primaryClass}
                disabled={busy || (!output.plain && !project.image && !httpsUrl(project.imageUrl))}
                onClick={() => void downloadAppleMail()}><Download size={16} /> Für Apple Mail laden (.eml)</button>}
              {client !== 'mobile' && (client !== 'apple' || !project.image) && <button className={client === 'apple' || client === 'thunderbird' ? buttonClass : primaryClass} disabled={!output.plain && !project.image && !httpsUrl(project.imageUrl)}
                onClick={() => void copy(true)}><Copy size={16} /> Formatiert kopieren</button>}
              <button className={client === 'mobile' ? primaryClass : buttonClass} disabled={!output.plain} onClick={() => void copy(false)}>Klartext kopieren</button>
              {client !== 'mobile' && <button className={client === 'thunderbird' ? primaryClass : buttonClass} onClick={() => downloadSignature(
                `${fileName}.html`,
                new Blob([`<!doctype html><html lang="de"><meta charset="utf-8"><title>Signatur</title><body>${output.html}</body></html>`], { type: 'text/html;charset=utf-8' }),
              )}>HTML laden</button>}
              <button className={buttonClass} disabled={!output.plain} onClick={() => downloadSignature(
                `${fileName}.txt`, new Blob([output.plain], { type: 'text/plain;charset=utf-8' }),
              )}>Textdatei laden</button>
              {project.image && <button className={buttonClass} disabled={busy} onClick={() => void downloadImage()}>
                Grafik laden ({project.imageWidth} px)
              </button>}
            </div>
            {client === 'apple' && !project.image && httpsUrl(project.imageUrl) && (
              <p className="mt-3 text-xs text-slate-600">Lade die Grafik als Datei hoch, damit sie beim Apple-Mail-Export eingebettet wird.</p>
            )}
            {(project.image || httpsUrl(project.imageUrl)) && client !== 'mobile' && client !== 'apple' && (
              <p className="mt-3 text-xs text-slate-600">Prüfe die Grafik mit einer Testmail. Je nach Mailprogramm kannst du sie separat im Signatur-Editor einsetzen.</p>
            )}
          </div>
        </div>
      </div>
      {textArtOpen && <TextArtModal isOpen onClose={() => setTextArtOpen(false)} onInsert={data => void addTextArt(data, project.id)} />}
    </section>
  );
}
