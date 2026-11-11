export const SIGNATURE_FORMAT = 'PDF_TOOL_FORALL_MAIL_SIGNATURE_V1';

export const fields = {
  title: 'Projektname',
  greeting: 'Grußformel',
  name: 'Name',
  role: 'Position',
  company: 'Firma',
  email: 'E-Mail',
  phone: 'Telefon',
  website: 'Website',
  social: 'Weiterer Link',
  note: 'Freier Text',
  legal: 'Pflichtangaben / Rechtstext',
  imageAlt: 'Alternativtext',
  imageUrl: 'Öffentliche HTTPS-Bildadresse',
};

export const signatureBlocks = {
  greeting: 'Grußformel',
  identity: 'Name, Kontakt und Grafik',
  note: 'Freier Text',
  legal: 'Pflichtangaben / Rechtstext',
};
export type SignatureBlock = keyof typeof signatureBlocks;
const defaultOrder = Object.keys(signatureBlocks) as SignatureBlock[];

export type SignatureFields = Record<keyof typeof fields, string>;
export type SignatureProject = SignatureFields & {
  id: string;
  profile: 'private' | 'business';
  layout: 'stacked' | 'columns';
  font: 'Arial' | 'Georgia' | 'Verdana';
  color: string;
  image: string;
  imageWidth: number;
  blockOrder: SignatureBlock[];
};

export type SignatureLibrary = {
  activeId: string;
  projects: SignatureProject[];
};

const IMAGE_DATA = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const MAX_IMAGE_SIZE = 2_800_000;
const DB_NAME = 'PdfToolForAll_MailSignatures';

export function createSignature(profile: SignatureProject['profile']): SignatureProject {
  const emptyFields = Object.fromEntries(Object.keys(fields).map(key => [key, ''])) as SignatureFields;
  return {
    ...emptyFields,
    id: Array.from(crypto.getRandomValues(new Uint32Array(4)), part => part.toString(16).padStart(8, '0')).join(''),
    profile,
    title: profile === 'business' ? 'Geschäftliche Signatur' : 'Private Signatur',
    greeting: profile === 'business' ? 'Mit freundlichen Grüßen' : 'Viele Grüße',
    layout: profile === 'business' ? 'columns' : 'stacked',
    font: 'Arial',
    color: '#145a8d',
    image: '',
    imageWidth: 112,
    blockOrder: [...defaultOrder],
  };
}

export function imageDataUrl(value: string): string {
  return value.length <= MAX_IMAGE_SIZE && IMAGE_DATA.test(value) ? value : '';
}

export function httpsUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ));
}

export function renderSignature(project: SignatureProject, options: { hideImage?: boolean; preferLocalImage?: boolean } = {}) {
  const color = /^#[0-9a-f]{6}$/i.test(project.color) ? project.color : '#145a8d';
  const font = project.font === 'Georgia' ? 'Georgia, serif' : `${project.font}, sans-serif`;
  const style = `font-family:${font};font-size:14px;line-height:1.45;color:#24272c;overflow-wrap:anywhere;`;
  const text = (value: string) => escapeHtml(value.trim()).replace(/\r?\n/g, '<br>');
  const link = (value: string, href: string) => href
    ? `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:underline;">${text(value)}</a>`
    : text(value);
  const email = project.email.trim();
  const phone = project.phone.trim();
  const phoneNumber = phone.replace(/[^\d+]/g, '');
  const contact = [
    link(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${encodeURIComponent(email).replace('%40', '@')}` : ''),
    link(phone, /^\+?\d+$/.test(phoneNumber) ? `tel:${phoneNumber}` : ''),
    link(project.website, httpsUrl(project.website)),
    link(project.social, httpsUrl(project.social)),
  ].filter(Boolean).join('<br>');
  const identity = [
    project.name.trim() && `<strong style="font-size:16px;color:${color};">${text(project.name)}</strong>`,
    text(project.role),
    text(project.company),
    contact,
  ].filter(Boolean).join('<br>');
  const localImage = imageDataUrl(project.image);
  const remoteImage = httpsUrl(project.imageUrl);
  const src = options.preferLocalImage ? localImage || remoteImage : remoteImage || localImage;
  const width = Math.max(32, Math.min(240, project.imageWidth));
  const image = src && !options.hideImage
    ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(project.imageAlt.trim())}" width="${width}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;">`
    : '';
  const identityBlock = project.layout === 'columns' && image && identity
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td valign="top" style="padding:0 12px 0 0;">${image}</td><td valign="top" style="${style}">${identity}</td></tr></table>`
    : [identity, image].filter(Boolean).join('<br>');
  const blocks = {
    greeting: { html: text(project.greeting), plain: project.greeting, style: 'padding-bottom:6px;' },
    identity: {
      html: identityBlock,
      plain: [project.name, project.role, project.company, email, phone, project.website, project.social]
        .map(value => value.trim()).filter(Boolean).join('\n'),
      style: '',
    },
    note: { html: text(project.note), plain: project.note, style: 'padding-top:8px;' },
    legal: { html: text(project.legal), plain: project.legal, style: 'padding-top:8px;font-size:12px;' },
  };
  const ordered = (project.blockOrder ?? defaultOrder).map(key => blocks[key]);
  const rows = ordered.filter(block => block.html).map(block => (
    `<tr><td style="${style}${block.style}">${block.html}</td></tr>`
  )).join('');
  return {
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:100%;">${rows}</table>`,
    plain: ordered.map(block => block.plain.trim()).filter(Boolean).join('\n\n'),
  };
}

export function signatureFileName(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').slice(0, 100) || 'Signatur';
}

export function downloadSignature(name: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSignatureProject(project: SignatureProject) {
  downloadSignature(`${signatureFileName(project.title)}.signatur.json`, new Blob(
    [JSON.stringify({ format: SIGNATURE_FORMAT, project }, null, 2)],
    { type: 'application/json;charset=utf-8' },
  ));
}

export async function importSignature(file: File): Promise<SignatureProject> {
  if (file.size > 5_000_000) throw new Error('Die Datei ist größer als 5 MB.');
  const content = await file.text();
  if (/\.json$/i.test(file.name)) {
    const payload = JSON.parse(content.replace(/^\uFEFF/, ''));
    const source = payload?.project;
    if (payload?.format !== SIGNATURE_FORMAT || !source || typeof source !== 'object') {
      throw new Error('Diese Datei ist kein unterstütztes Signaturprojekt.');
    }
    const project = createSignature(source.profile === 'business' ? 'business' : 'private');
    for (const key of Object.keys(fields) as (keyof SignatureFields)[]) {
      if (typeof source[key] === 'string') project[key] = source[key].slice(0, 12_000);
    }
    project.layout = source.layout === 'columns' ? 'columns' : 'stacked';
    if (['Arial', 'Georgia', 'Verdana'].includes(source.font)) project.font = source.font;
    if (typeof source.color === 'string' && /^#[0-9a-f]{6}$/i.test(source.color)) project.color = source.color;
    if (typeof source.image === 'string') project.image = imageDataUrl(source.image);
    if (Number.isFinite(source.imageWidth)) project.imageWidth = Math.max(32, Math.min(240, source.imageWidth));
    if (Array.isArray(source.blockOrder) && source.blockOrder.length === defaultOrder.length &&
        defaultOrder.every(key => source.blockOrder.includes(key))) {
      project.blockOrder = source.blockOrder;
    }
    return project;
  }
  if (!/\.(html?|txt)$/i.test(file.name)) throw new Error('Wähle eine Signaturprojekt-, HTML- oder Textdatei.');
  const project = createSignature('private');
  project.title = file.name.replace(/\.[^.]+$/, '');
  project.greeting = '';
  if (/\.html?$/i.test(file.name)) {
    const template = document.createElement('template');
    template.innerHTML = content;
    template.content.querySelectorAll('script,style,head,template,noscript').forEach(node => node.remove());
    template.content.querySelectorAll('br,p,div,tr,li,td').forEach(node => node.after('\n'));
    project.note = (template.content.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12_000);
    const image = template.content.querySelector('img');
    const src = image?.getAttribute('src') ?? '';
    project.image = imageDataUrl(src);
    project.imageUrl = httpsUrl(src);
    project.imageAlt = image?.getAttribute('alt') ?? '';
  } else {
    project.note = content.trim().slice(0, 12_000);
  }
  return project;
}

export async function readSignatureImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2_000_000) {
    throw new Error('Wähle ein PNG- oder JPEG-Bild bis 2 MB.');
  }
  const result = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = result;
  await image.decode();
  return result;
}

let libraryDb: Promise<IDBDatabase> | undefined;

function openLibrary() {
  libraryDb ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return libraryDb;
}

export async function loadSignatureLibrary(): Promise<SignatureLibrary | undefined> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const request = db.transaction('library').objectStore('library').get('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveSignatureLibrary(library: SignatureLibrary): Promise<void> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readwrite');
    transaction.objectStore('library').put(library, 'projects');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
  });
}
