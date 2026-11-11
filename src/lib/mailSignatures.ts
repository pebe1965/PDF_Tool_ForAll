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
  identity: 'Name, Kontakt und Logo',
  textArt: 'TextArt',
  note: 'Freier Text',
  legal: 'Pflichtangaben / Rechtstext',
};
export type SignatureBlock = keyof typeof signatureBlocks;
const defaultOrder = Object.keys(signatureBlocks) as SignatureBlock[];

export const signatureFonts = {
  Arial: 'Arial, Helvetica, sans-serif',
  Calibri: 'Calibri, Arial, sans-serif',
  'Courier New': "'Courier New', Courier, monospace",
  Georgia: 'Georgia, serif',
  Helvetica: 'Helvetica, Arial, sans-serif',
  Tahoma: 'Tahoma, Arial, sans-serif',
  'Times New Roman': "'Times New Roman', Times, serif",
  'Trebuchet MS': "'Trebuchet MS', Arial, sans-serif",
  Verdana: 'Verdana, Arial, sans-serif',
};

export type SignatureFont = keyof typeof signatureFonts;
export type SignatureTextTarget = Exclude<SignatureBlock, 'textArt'> | 'name';
export type SignatureTextStyle = {
  font: SignatureFont;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
};
export type SignatureTextStyles = Partial<Record<SignatureTextTarget, Partial<SignatureTextStyle>>>;
export type SignatureArtwork = { image: string; alt: string; width: number };

export type SignatureFields = Record<keyof typeof fields, string>;
export type SignatureProject = SignatureFields & {
  id: string;
  profile: 'private' | 'business';
  layout: 'stacked' | 'columns';
  font: SignatureFont;
  color: string;
  image: string;
  imageWidth: number;
  textArt?: SignatureArtwork;
  textStyles?: SignatureTextStyles;
  blockOrder: SignatureBlock[];
};

export type SignatureLibrary = {
  activeId: string;
  projects: SignatureProject[];
};

const IMAGE_DATA = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
const MAX_IMAGE_SIZE = 2_800_000;
const MAX_PROJECT_SIZE = 6_000_000;
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

function signatureImageWidth(width: number) {
  return Math.round(Math.max(32, Math.min(240, width)));
}

export function signatureBlockOrder(order: readonly SignatureBlock[] = []): SignatureBlock[] {
  const known = [...new Set(order.filter(key => defaultOrder.includes(key)))];
  for (const block of defaultOrder) {
    if (known.includes(block)) continue;
    const index = block === 'textArt' && known.includes('identity')
      ? known.indexOf('identity') + 1
      : known.length;
    known.splice(index, 0, block);
  }
  return known;
}

function isSignatureFont(font: unknown): font is SignatureFont {
  return typeof font === 'string' && Object.prototype.hasOwnProperty.call(signatureFonts, font);
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function signatureTextStyle(project: SignatureProject, target: SignatureTextTarget): SignatureTextStyle {
  const defaults = {
    font: isSignatureFont(project.font) ? project.font : 'Arial' as const,
    size: target === 'name' ? 16 : target === 'legal' ? 12 : 14,
    color: target === 'name' && isColor(project.color) ? project.color : '#24272c',
    bold: target === 'name',
    italic: false,
  };
  const style = project.textStyles?.[target];
  return {
    font: isSignatureFont(style?.font) ? style.font : defaults.font,
    size: typeof style?.size === 'number' && Number.isFinite(style.size)
      ? Math.round(Math.max(9, Math.min(36, style.size))) : defaults.size,
    color: isColor(style?.color) ? style.color : defaults.color,
    bold: typeof style?.bold === 'boolean' ? style.bold : defaults.bold,
    italic: typeof style?.italic === 'boolean' ? style.italic : defaults.italic,
  };
}

function textStyleCss(style: SignatureTextStyle) {
  return `font-family:${signatureFonts[style.font]};font-size:${style.size}px;line-height:1.45;color:${style.color};font-weight:${style.bold ? 'bold' : 'normal'};font-style:${style.italic ? 'italic' : 'normal'};overflow-wrap:anywhere;`;
}

type SignatureImageSlot = 'logo' | 'textArt';
type InlineImages = Partial<Record<SignatureImageSlot, { contentId: string; height: number }>>;

type SignatureRenderOptions = {
  hideImage?: boolean;
  preferLocalImage?: boolean;
  inlineImages?: InlineImages;
};

function renderImage(source: string, widthValue: number, alt: string, inline?: InlineImages[SignatureImageSlot]) {
  const src = inline ? `cid:${inline.contentId}` : source;
  if (!src) return '';
  const width = signatureImageWidth(widthValue);
  const height = inline ? ` height="${inline.height}"` : '';
  // Mail uses the alternative text when naming an inline image copied from a message.
  const description = alt.trim() || (inline ? 'Signaturgrafik' : '');
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(description)}" width="${width}"${height} style="display:block;width:${width}px;max-width:100%;height:auto;border:0;">`;
}

export function renderSignature(project: SignatureProject, options: SignatureRenderOptions = {}) {
  const color = project.textStyles?.identity?.color;
  const linkColor = isColor(color) ? color : isColor(project.color) ? project.color : '#145a8d';
  const style = (target: SignatureTextTarget) => textStyleCss(signatureTextStyle(project, target));
  const text = (value: string) => escapeHtml(value.trim()).replace(/\r?\n/g, '<br>');
  const link = (value: string, href: string) => href
    ? `<a href="${escapeHtml(href)}" style="color:${linkColor};text-decoration:underline;">${text(value)}</a>`
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
    project.name.trim() && `<span style="${style('name')}">${text(project.name)}</span>`,
    text(project.role),
    text(project.company),
    contact,
  ].filter(Boolean).join('<br>');
  const localImage = imageDataUrl(project.image);
  const remoteImage = httpsUrl(project.imageUrl);
  const logoSrc = options.preferLocalImage ? localImage || remoteImage : remoteImage || localImage;
  const logo = options.hideImage ? '' : renderImage(logoSrc, project.imageWidth, project.imageAlt, options.inlineImages?.logo);
  const art = project.textArt;
  const artwork = !options.hideImage && art
    ? renderImage(imageDataUrl(art.image), art.width, art.alt, options.inlineImages?.textArt)
    : '';
  const identityStyle = style('identity');
  const identityBlock = project.layout === 'columns' && logo && identity
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td valign="top" style="padding:0 12px 0 0;">${logo}</td><td valign="top" style="${identityStyle}">${identity}</td></tr></table>`
    : [identity, logo].filter(Boolean).join('<br>');
  const blocks = {
    greeting: { html: text(project.greeting), plain: project.greeting, style: style('greeting') + 'padding-bottom:6px;' },
    identity: {
      html: identityBlock,
      plain: [project.name, project.role, project.company, email, phone, project.website, project.social]
        .map(value => value.trim()).filter(Boolean).join('\n'),
      style: identityStyle,
    },
    textArt: { html: artwork, plain: art?.alt ?? '', style: 'padding-top:6px;' },
    note: { html: text(project.note), plain: project.note, style: style('note') + 'padding-top:8px;' },
    legal: { html: text(project.legal), plain: project.legal, style: style('legal') + 'padding-top:8px;' },
  };
  const ordered = signatureBlockOrder(project.blockOrder).map(key => ({ key, ...blocks[key] }));
  const rows = ordered.filter(block => block.html).map(block => (
    `<tr><td style="${block.style}">${block.html}</td></tr>`
  )).join('');
  return {
    blocks: ordered,
    html: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:100%;">${rows}</table>`,
    plain: ordered.map(block => block.plain.trim()).filter(Boolean).join('\n\n'),
  };
}

export function resizeSignatureImage(project: SignatureProject) {
  return resizeImage(project.image, project.imageWidth);
}

async function resizeImage(dataUrl: string, imageWidth: number) {
  const src = imageDataUrl(dataUrl);
  if (!src) throw new Error('Die hochgeladene Grafik konnte nicht gelesen werden.');

  const image = new Image();
  image.src = src;
  await image.decode();
  const width = signatureImageWidth(imageWidth);
  const height = Math.max(1, Math.round(image.naturalHeight * width / image.naturalWidth));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Die Grafik konnte nicht skaliert werden.');

  context.drawImage(image, 0, 0, width, height);
  const mimeType = src.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(result => {
      if (result) resolve(result);
      else reject(new Error('Die Grafik konnte nicht skaliert werden.'));
    }, mimeType, 0.92);
  });
  return { blob, width, height };
}

function mimeBase64(bytes: Uint8Array) {
  const lines: string[] = [];
  // 57 bytes of input produce 76 Base64 characters, the MIME line limit.
  for (let offset = 0; offset < bytes.length; offset += 57) {
    lines.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 57))));
  }
  return lines.join('\r\n');
}

export async function createAppleMailSignature(project: SignatureProject): Promise<Blob> {
  const images: { slot: SignatureImageSlot; dataUrl: string; width: number }[] = [];
  if (project.image) images.push({ slot: 'logo', dataUrl: project.image, width: project.imageWidth });
  if (project.textArt) images.push({ slot: 'textArt', dataUrl: project.textArt.image, width: project.textArt.width });
  const boundary = 'pdf-tool-forall-signature';
  const inlineImages: InlineImages = {};
  const imageParts = await Promise.all(images.map(async ({ slot, dataUrl, width }) => {
    const image = await resizeImage(dataUrl, width);
    const contentId = `${slot.toLowerCase()}@pdf-tool-forall.invalid`;
    inlineImages[slot] = { contentId, height: image.height };
    const extension = image.blob.type === 'image/jpeg' ? 'jpg' : 'png';
    const imageName = `${slot === 'logo' ? 'signatur-grafik' : 'signatur-textart'}.${extension}`;
    return [
      `--${boundary}`,
      `Content-Type: ${image.blob.type}; name="${imageName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${contentId}>`,
      `Content-Disposition: inline; filename="${imageName}"`,
      '',
      mimeBase64(new Uint8Array(await image.blob.arrayBuffer())),
    ];
  }));
  const { html } = renderSignature(project, { inlineImages });
  const htmlDocument = `<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  const htmlPart = [
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    mimeBase64(new TextEncoder().encode(htmlDocument)),
  ];
  const headers = ['MIME-Version: 1.0', 'Subject: E-Mail-Signatur'];
  const parts = imageParts.length ? [
    `Content-Type: multipart/related; boundary="${boundary}"; type="text/html"`,
    '',
    `--${boundary}`,
    ...htmlPart,
    ...imageParts.flat(),
    `--${boundary}--`,
  ] : htmlPart;
  return new Blob([[...headers, ...parts, ''].join('\r\n')], { type: 'message/rfc822' });
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
  if (file.size > MAX_PROJECT_SIZE) throw new Error('Die Datei ist größer als 6 MB.');
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
    if (isSignatureFont(source.font)) project.font = source.font;
    if (isColor(source.color)) project.color = source.color;
    if (typeof source.image === 'string') project.image = imageDataUrl(source.image);
    if (Number.isFinite(source.imageWidth)) project.imageWidth = signatureImageWidth(source.imageWidth);
    if (Array.isArray(source.blockOrder)) project.blockOrder = signatureBlockOrder(source.blockOrder);
    const artImage = typeof source.textArt?.image === 'string' ? imageDataUrl(source.textArt.image) : '';
    if (artImage) {
      project.textArt = {
        image: artImage,
        alt: typeof source.textArt.alt === 'string' ? source.textArt.alt.slice(0, 500) : '',
        width: Number.isFinite(source.textArt.width) ? signatureImageWidth(source.textArt.width) : 160,
      };
    }
    const styles: SignatureTextStyles = {};
    for (const target of ['greeting', 'identity', 'name', 'note', 'legal'] as const) {
      const style = source.textStyles?.[target];
      if (!style || typeof style !== 'object') continue;
      styles[target] = {};
      if (isSignatureFont(style.font)) styles[target].font = style.font;
      if (Number.isFinite(style.size)) styles[target].size = Math.round(Math.max(9, Math.min(36, style.size)));
      if (isColor(style.color)) styles[target].color = style.color;
      if (typeof style.bold === 'boolean') styles[target].bold = style.bold;
      if (typeof style.italic === 'boolean') styles[target].italic = style.italic;
    }
    project.textStyles = styles;
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
