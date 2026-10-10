import { getActiveGeminiApiKey, DEFAULT_GEMINI_MODEL } from '../config';
import { pdfjsLib } from './pdfWorker';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

/**
 * Extracts plain text from a PDF buffer using Mozilla PDF.js
 */
export async function extractTextFromPdf(
  pdfBytes: ArrayBuffer,
  pageNumber?: number // 1-indexed; if undefined, extracts all pages
): Promise<{ fullText: string; pageTexts: { page: number; text: string }[]; totalLength: number }> {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdfDoc = await loadingTask.promise;
    const pageTexts: { page: number; text: string }[] = [];

    const start = pageNumber && pageNumber > 0 && pageNumber <= pdfDoc.numPages ? pageNumber : 1;
    const end = pageNumber && pageNumber > 0 && pageNumber <= pdfDoc.numPages ? pageNumber : pdfDoc.numPages;

    for (let p = start; p <= end; p++) {
      const page = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      const pageStr = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ');
      pageTexts.push({ page: p, text: pageStr.trim() });
    }

    const fullText = pageTexts
      .map((pt) => `[Seite ${pt.page}]:\n${pt.text}`)
      .join('\n\n');

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
  const apiKey = getActiveGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      'Kein Gemini API-Schlüssel hinterlegt. Bitte hinterlege deinen Google Gemini API-Schlüssel in der Konfiguration.'
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: any[] = [];

  // If we have extracted text and it has substantial content, provide it directly
  if (extractedText && extractedText.trim().length > 30) {
    parts.push({
      text: `DOKUMENTEN-INHALT:\n"""\n${extractedText}\n"""\n\nAUFGABE/FRAGE:\n${prompt}`,
    });
  } else if (pdfBytes && pdfBytes.byteLength > 0 && pdfBytes.byteLength < 18 * 1024 * 1024) {
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
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(`Gemini API-Fehler: ${message}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];

  if (!candidate || !candidate.content?.parts?.[0]?.text) {
    if (candidate?.finishReason === 'SAFETY') {
      throw new Error('Die Antwort wurde von den Sicherheitsfiltern von Google blockiert.');
    }
    throw new Error('Keine Antwort von Gemini erhalten.');
  }

  return candidate.content.parts[0].text;
}

/**
 * 1. Zusammenfassung generieren
 */
export async function summarizeDocument(
  pdfBytes: ArrayBuffer,
  pageNumber?: number,
  style: 'bullet' | 'short' | 'detailed' = 'bullet'
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber);

  let stylePrompt = '';
  if (style === 'short') {
    stylePrompt = 'Erstelle ein prägnantes TL;DR (Executive Summary) in 3-4 präzisen Sätzen.';
  } else if (style === 'detailed') {
    stylePrompt =
      'Erstelle eine ausführliche, strukturierte Zusammenfassung mit Abschnitten, Kontext und Schlussfolgerungen.';
  } else {
    stylePrompt =
      'Erstelle eine übersichtliche Aufzählung mit: 1. Kernaussagen (Bulletpoints), 2. Wichtige Fristen/Aufgaben/Action Items, 3. Beteiligte Personen/Parteien.';
  }

  const prompt = `${stylePrompt}\nBitte antworte auf Deutsch in klar formatiertem Markdown.`;

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein professioneller Dokumenten-Assistent. Analysiere das Dokument präzise und objektiv.',
    pdfBytes,
    extractedText: fullText,
  });
}

/**
 * 2. Rechtschreib-, Grammatik- & Stilprüfung
 */
export async function checkGrammarAndSpelling(
  pdfBytes: ArrayBuffer,
  pageNumber?: number
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber);

  const prompt = `Analysiere den Text des Dokuments sorgfältig auf:
1. Rechtschreibfehler (Orthografie)
2. Grammatik- und Zeichensetzungsfehler (Kommasetzung)
3. Unklare oder holprige Formulierungen

Gib die Antwort so aus:
- **Gefundene Korrekturen**: Liste mit "Gefunden" ➔ "Korrektur" und kurzer Begründung.
- **Vollständiger korrigierter Text**: Der gesamte Text in fehlerfreier, stilistisch runder Fassung.
Falls der Text bereits fehlerfrei ist, bestätige dies lobend.`;

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein professioneller Lektor und Experte für deutsche Rechtschreibung nach Duden.',
    pdfBytes,
    extractedText: fullText,
  });
}

/**
 * 3. Übersetzung in Zielsprache
 */
export async function translateDocument(
  pdfBytes: ArrayBuffer,
  targetLanguage: string = 'Englisch',
  pageNumber?: number
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber);

  const prompt = `Übersetze den Inhalt des Dokuments vollständig und professionell ins ${targetLanguage}.
Behalte Absätze, Aufzählungen und die formale Tonalität exakt bei.
Gib ausschließlich die Übersetzung ohne Begrüßungsfloskeln aus.`;

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein erfahrener Fachübersetzer. Übersetze präzise unter Beibehaltung von Fachbegriffen und Sinn.',
    pdfBytes,
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
  pageNumber?: number
): Promise<string> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber);

  const prompt = `Beantworte folgende Frage basierend auf dem Dokument präzise und fundiert:
"${question}"

Wenn die Information im Dokument vorhanden ist, nenne wenn möglich auch den Kontext bzw. die Seitenzahl.`;

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein aufmerksamer Assistent. Beantworte Fragen wahrheitsgemäß auf Basis des Dokuments.',
    pdfBytes,
    extractedText: fullText,
  });
}
