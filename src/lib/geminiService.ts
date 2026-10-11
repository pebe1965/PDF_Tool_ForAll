import { getKiVerbindung, DEFAULT_GEMINI_MODEL, APP_KI_URL, MAX_PDF_BYTES_UEBER_APP } from '../config';
import { pdfjsLib } from './pdfWorker';
import { Annotation, TextAnnotation } from '../types/pdf';
import { extractSinglePageAsPdf } from './pdfEngine';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

/**
 * Extracts plain text from a PDF buffer using Mozilla PDF.js
 * Combines underlying PDF text with any active text annotations on those pages.
 */
export async function extractTextFromPdf(
  pdfBytes: ArrayBuffer,
  pageNumber?: number, // 1-indexed; if undefined, extracts all pages
  annotations?: Annotation[]
): Promise<{ fullText: string; pageTexts: { page: number; text: string }[]; totalLength: number }> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdfDoc = await loadingTask.promise;
    const pageTexts: { page: number; text: string }[] = [];

    const start = pageNumber && pageNumber > 0 && pageNumber <= pdfDoc.numPages ? pageNumber : 1;
    const end = pageNumber && pageNumber > 0 && pageNumber <= pdfDoc.numPages ? pageNumber : pdfDoc.numPages;

    for (let p = start; p <= end; p++) {
      let pageStr = '';
      try {
        const page = await pdfDoc.getPage(p);
        const content = await page.getTextContent();
        pageStr = content.items
          .map((item: any) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .replace(/[ \t]{2,}[iIℹ][ \t]*$/gm, '')
          .replace(/[:.,;][ \t]+[iIℹ][ \t]*$/gm, (m: string) => m[0])
          .replace(/^[ \t]*[iIℹ][ \t]*$/gm, '')
          .replace(/^[ \t]*[•\-\*]\s+[iIℹ]\s*$/gm, '')
          .replace(/[ \t]{2,}[iIℹ][ \t]{2,}/g, ' ')
          .trim();
      } catch (err) {
        console.warn(`Konnte Seite ${p} nicht auslesen:`, err);
      }

      // Also gather any text annotations placed on page p
      const annTexts = annotations
        ? annotations
            .filter((a) => a.pageNumber === p && a.type === 'text' && (a as TextAnnotation).text)
            .map((a) => (a as TextAnnotation).text.trim())
            .filter(Boolean)
        : [];

      // Combine underlying PDF text with annotations on that page
      const combined = [pageStr, ...annTexts].filter(Boolean).join('\n\n').trim();
      pageTexts.push({ page: p, text: combined });
    }

    const fullText = pageTexts
      .map((pt) => (pageNumber ? pt.text : `[Seite ${pt.page}]:\n${pt.text}`))
      .join('\n\n')
      .trim();

    return {
      fullText,
      pageTexts,
      totalLength: fullText.length,
    };
  } catch (err) {
    console.error('Fehler beim Extrahieren des PDF-Texts:', err);
    return { fullText: '', pageTexts: [], totalLength: 0 };
  }
}

/**
 * Convert ArrayBuffer to Base64 string for multimodal inlineData
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Low-level call to Google Gemini REST API
 */
export async function callGeminiApi({
  prompt,
  systemInstruction,
  pdfBytes,
  extractedText,
  model = DEFAULT_GEMINI_MODEL,
}: {
  prompt: string;
  systemInstruction?: string;
  pdfBytes?: ArrayBuffer;
  extractedText?: string;
  model?: string;
}): Promise<string> {
  const verbindung = getKiVerbindung();

  if (!verbindung) {
    throw new Error(
      'Die KI ist noch nicht eingerichtet. Erstelle im Marketplace von NotionaryAtlas einen Zugangscode und füge ihn unter Einstellungen → KI ein.'
    );
  }

  // Über die App: gleiche Anfrage, aber an NotionaryAtlas mit dem Zugangscode.
  // Modell und Schlüssel bestimmt dort die App.
  const ueberApp = verbindung.art === 'app';
  const endpoint = ueberApp
    ? APP_KI_URL
    : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const authHeaders: Record<string, string> = ueberApp
    ? { Authorization: `Bearer ${verbindung.zugangscode}` }
    : { 'x-goog-api-key': verbindung.schluessel };
  const maxPdfBytes = ueberApp ? MAX_PDF_BYTES_UEBER_APP : 18 * 1024 * 1024;

  const parts: any[] = [];

  // If we have extracted text and it has substantial content, provide it directly
  if (extractedText && extractedText.trim().length > 30) {
    parts.push({
      text: `DOKUMENTEN-INHALT:\n"""\n${extractedText}\n"""\n\nAUFGABE/FRAGE:\n${prompt}`,
    });
  } else if (pdfBytes && pdfBytes.byteLength > maxPdfBytes && !(extractedText && extractedText.trim())) {
    throw new Error(
      'Dieses PDF enthält keinen auslesbaren Text und ist für die Bildanalyse über die App zu groß (höchstens 2,8 MB). Teile es in kleinere Dateien auf.'
    );
  } else if (pdfBytes && pdfBytes.byteLength > 0 && pdfBytes.byteLength <= maxPdfBytes) {
    // Multimodal Fallback: send visual PDF as inlineData if text extraction was empty (scanned doc)
    const base64Pdf = arrayBufferToBase64(pdfBytes);
    parts.push({
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf,
      },
    });
    parts.push({ text: prompt });
  } else if (extractedText) {
    parts.push({
      text: `DOKUMENTEN-INHALT:\n"""\n${extractedText}\n"""\n\nAUFGABE/FRAGE:\n${prompt}`,
    });
  } else {
    parts.push({ text: prompt });
  }

  const requestBody: any = {
    contents: [
      {
        parts: parts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    if (ueberApp && (response.status === 401 || response.status === 403)) {
      throw new Error(`${message} — Zugangscode unter Einstellungen → KI prüfen.`);
    }
    if (ueberApp && response.status === 402) {
      throw new Error(`${message}. KI-Credits gibt es in NotionaryAtlas unter Einstellungen.`);
    }
    throw new Error(ueberApp ? message : `Gemini API-Fehler: ${message}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];

  if (!candidate || !candidate.content?.parts?.[0]?.text) {
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('Die Antwort wurde von den Sicherheitsfiltern von Google blockiert.');
    }
    throw new Error('Keine Antwort von Gemini erhalten.');
  }

  const rawText = candidate.content.parts[0].text;
  return formatMarkdownToCleanText(rawText);
}

/**
 * Strips all markdown syntax (#, **, *, `, $, LaTeX) and converts it into
 * clean, print-ready, professional document typography with clean bullet points.
 */
export function formatMarkdownToCleanText(md: string): string {
  if (!md) return '';

  return md
    // 1. Convert LaTeX math arrows and formulas
    .replace(/\\rightarrow|\$\s*\\rightarrow\s*\$/g, '->')
    .replace(/\\leftarrow|\$\s*\\leftarrow\s*\$/g, '<-')
    .replace(/\$([^\$]+)\$/g, '$1')

    // 2. Remove code fences and inline backticks
    .replace(/```[a-z]*\n([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')

    // 3. Remove horizontal dividers
    .replace(/^---+$/gm, '')

    // 4. Convert bullet lists (*, -, +) to clean bullets (•) FIRST
    // (Crucial: must happen before single-asterisk italic stripping so bullets are preserved!)
    .replace(/^(\s*)[*+-]\s+/gm, '$1• ')

    // 5. Clean bold and italic markers (line-bound so asterisks across lines do not eat text)
    .replace(/\*\*\*([^\*\n]+)\*\*\*/g, '$1')
    .replace(/\*\*([^\*\n]+)\*\*/g, '$1')
    .replace(/\*([^\*\n]+)\*/g, '$1')
    .replace(/___([^_\n]+)___/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')

    // 6. Convert markdown headings (#, ##, ###) into clean readable headings
    .replace(/^###+\s+(.+)$/gm, '$1:')
    .replace(/^##\s+(.+)$/gm, '$1:')
    .replace(/^#\s+(.+)$/gm, '$1')

    // 7. Clean links [label](url) -> label (url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')

    // 8. Clean isolated info-icon / pictogram glyph artifacts (e.g. trailing "   i" or isolated "i" / "ℹ")
    .replace(/[ \t]{2,}[iIℹ][ \t]*$/gm, '')
    .replace(/[:.,;][ \t]+[iIℹ][ \t]*$/gm, (m) => m[0])
    .replace(/^[ \t]*[iIℹ][ \t]*$/gm, '')
    .replace(/^[ \t]*[•\-\*]\s+[iIℹ]\s*$/gm, '')
    .replace(/[ \t]{2,}[iIℹ][ \t]{2,}/g, ' ')

    // 9. Clean up multiple empty lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 1. Zusammenfassung generieren
 */
export async function summarizeDocument(
  pdfBytes: ArrayBuffer,
  pageNumber?: number,
  style: 'bullet' | 'short' | 'detailed' = 'bullet',
  annotations?: Annotation[]
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber, annotations);

  let stylePrompt = '';
  if (style === 'short') {
    stylePrompt = 'Erstelle ein prägnantes TL;DR (Executive Summary) in 3-4 präzisen Sätzen.';
  } else if (style === 'detailed') {
    stylePrompt =
      'Erstelle eine ausführliche, strukturierte Zusammenfassung mit Abschnitten, Kontext und Schlussfolgerungen.';
  } else {
    stylePrompt =
      'Erstelle eine übersichtliche Aufzählung mit: 1. Kernaussagen (Aufzählungspunkte), 2. Wichtige Fristen/Aufgaben/Action Items, 3. Beteiligte Personen/Parteien.';
  }

  const scopePrompt = pageNumber
    ? `Analysiere und fasse ausschließlich den Inhalt von Seite ${pageNumber} des Dokuments zusammen. Fasse keine anderen Seiten zusammen.`
    : `Analysiere und fasse das gesamte Dokument zusammen.`;

  const prompt = `${scopePrompt}\n${stylePrompt}\nAntworte auf Deutsch in sauberem, druckreifem Plain-Text OHNE Markdown-Sonderzeichen (KEINE Hashes #, KEINE Sternchen **, KEINE Backticks, KEINE LaTeX-Codes). Verwende für Aufzählungen einfache Spiegelstriche (-) oder Punkte (•). Überschriften als eigenständige Zeile hervorheben.`;

  let effectivePdfBytes = pdfBytes;
  if (pageNumber) {
    try {
      const singlePageBytes = await extractSinglePageAsPdf(pdfBytes, pageNumber);
      effectivePdfBytes = singlePageBytes.buffer as ArrayBuffer;
    } catch (_) {
      effectivePdfBytes = pdfBytes;
    }
  }

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein professioneller Dokumenten-Assistent. Analysiere das Dokument präzise und objektiv. Formatiere deine Antworten stets in sauberem, druckreifem Plain-Text ohne Markdown-Syntax, sodass der Text direkt in PDF-Dokumente eingefügt werden kann.',
    pdfBytes: effectivePdfBytes,
    extractedText: fullText,
  });
}

/**
 * 2. Rechtschreib-, Grammatik- & Stilprüfung
 */
export async function checkGrammarAndSpelling(
  pdfBytes: ArrayBuffer,
  pageNumber?: number,
  annotations?: Annotation[]
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber, annotations);

  const scopePrompt = pageNumber
    ? `Analysiere ausschließlich den Text von Seite ${pageNumber} des Dokuments sorgfältig auf:`
    : `Analysiere den Text des Dokuments sorgfältig auf:`;

  const prompt = `${scopePrompt}
1. Rechtschreibfehler (Orthografie)
2. Grammatik- und Zeichensetzungsfehler (Kommasetzung)
3. Unklare oder holprige Formulierungen

Gib die Antwort so aus:
- **Gefundene Korrekturen**: Liste mit "Gefunden" ➔ "Korrektur" und kurzer Begründung.
- **Vollständiger korrigierter Text**: Der gesamte Text in fehlerfreier, stilistisch runder Fassung.
Falls der Text bereits fehlerfrei ist, bestätige dies lobend.`;

  let effectivePdfBytes = pdfBytes;
  if (pageNumber) {
    try {
      const singlePageBytes = await extractSinglePageAsPdf(pdfBytes, pageNumber);
      effectivePdfBytes = singlePageBytes.buffer as ArrayBuffer;
    } catch (_) {
      effectivePdfBytes = pdfBytes;
    }
  }

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein professioneller Lektor und Experte für deutsche Rechtschreibung nach Duden.',
    pdfBytes: effectivePdfBytes,
    extractedText: fullText,
  });
}

/**
 * 3. Übersetzung in Zielsprache
 */
export async function translateDocument(
  pdfBytes: ArrayBuffer,
  targetLanguage: string = 'Englisch',
  pageNumber?: number,
  annotations?: Annotation[]
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber, annotations);

  const scopeInstruction = pageNumber
    ? `Übersetze ausschließlich den folgenden Inhalt von Seite ${pageNumber} des Dokuments vollständig und professionell ins ${targetLanguage}. Übersetze keine anderen Seiten.`
    : `Übersetze den Inhalt des Dokuments vollständig und professionell ins ${targetLanguage}.`;

  const prompt = `${scopeInstruction}
Behalte Absätze, Aufzählungen und die formale Tonalität exakt bei.
Entferne isolierte Piktogramm-Buchstaben oder Info-Icons (wie alleinstehende 'i'-Symbole oder 'ℹ' am Zeilenende oder in Aufzählungen).
Gib ausschließlich die Übersetzung ohne Begrüßungsfloskeln aus.`;

  let effectivePdfBytes = pdfBytes;
  if (pageNumber) {
    try {
      const singlePageBytes = await extractSinglePageAsPdf(pdfBytes, pageNumber);
      effectivePdfBytes = singlePageBytes.buffer as ArrayBuffer;
    } catch (_) {
      effectivePdfBytes = pdfBytes;
    }
  }

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein erfahrener Fachübersetzer. Übersetze präzise unter Beibehaltung von Fachbegriffen und Sinn.',
    pdfBytes: effectivePdfBytes,
    extractedText: fullText,
  });
}

/**
 * 4. Text umschreiben / neu formulieren
 */
export async function rewriteText(
  sourceText: string,
  tone: 'professional' | 'simple' | 'polite' | 'concise' | 'contract'
): Promise<string> {
  const toneDescriptions: Record<string, string> = {
    professional: 'professionell, geschäftlich und überzeugend',
    simple: 'in einfacher, leicht verständlicher Sprache ohne Fachchinesisch',
    polite: 'besonders höflich, zuvorkommend und wertschätzend',
    concise: 'auf das Wesentliche gekürzt, prägnant und auf den Punkt',
    contract: 'rechtssicher, juristisch präzise und formal korrekt',
  };

  const prompt = `Formuliere folgenden Text um. Tonalität: ${
    toneDescriptions[tone] || 'professionell'
  }.

ORIGINALTEXT:
"""
${sourceText}
"""

Gib direkt den umformulierten Text aus.`;

  return callGeminiApi({
    prompt,
    systemInstruction: 'Du bist ein erfahrener Texter und Kommunikationsprofi.',
  });
}

/**
 * 5. Neuen Text von Grund auf generieren (z. B. für leere PDFs)
 */
export async function generateNewText(instructionPrompt: string): Promise<string> {
  const prompt = `Erstelle einen vollständigen, druckreifen Text basierend auf folgenden Vorgaben:
"${instructionPrompt}"

Formatierung:
- Klar strukturiert (Überschriften, Absätze, Aufzählungen)
- Bereit, um direkt in ein offizielles PDF-Dokument eingefügt zu werden.`;

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein Experte für geschäftliche und formelle Korrespondenz, Verträge und Protokolle.',
  });
}

/**
 * 6. Freie Fragen an das Dokument (Q&A / Chat)
 */
export async function askDocumentQuestion(
  pdfBytes: ArrayBuffer,
  question: string,
  pageNumber?: number,
  annotations?: Annotation[]
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber, annotations);

  const scopePrompt = pageNumber
    ? `Beantworte folgende Frage ausschließlich basierend auf Seite ${pageNumber} des Dokuments:`
    : `Beantworte folgende Frage basierend auf dem Dokument präzise und fundiert:`;

  const prompt = `${scopePrompt}
"${question}"

Wenn die Information im Dokument vorhanden ist, nenne wenn möglich auch den Kontext bzw. die Seitenzahl.`;

  let effectivePdfBytes = pdfBytes;
  if (pageNumber) {
    try {
      const singlePageBytes = await extractSinglePageAsPdf(pdfBytes, pageNumber);
      effectivePdfBytes = singlePageBytes.buffer as ArrayBuffer;
    } catch (_) {
      effectivePdfBytes = pdfBytes;
    }
  }

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein aufmerksamer Assistent. Beantworte Fragen wahrheitsgemäß auf Basis des Dokuments.',
    pdfBytes: effectivePdfBytes,
    extractedText: fullText,
  });
}
