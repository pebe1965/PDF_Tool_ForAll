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

    // 3. Preserve horizontal dividers as ---
    .replace(/^_{3,}$/gm, '---')
    .replace(/^\*{3,}$/gm, '---')

    // 4. Convert Markdown checklists (- [ ] / - [x] / ☐ / ☑) to [ ] / [x] FIRST
    .replace(/^(\s*)[*+-]?\s*\[\s*\]\s+/gm, '$1[ ] ')
    .replace(/^(\s*)[*+-]?\s*\[[xX✓✔]\]\s+/gm, '$1[x] ')
    .replace(/^(\s*)☐\s+/gm, '$1[ ] ')
    .replace(/^(\s*)[☑✓✔]\s+/gm, '$1[x] ')

    // 5. Convert bullet lists (*, -, +) to clean bullets (•)
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

/**
 * 7. Rechnungen, Belege & Tabellen strukturiert für Excel / CSV auslesen
 */
export async function extractBusinessDataWithAi(
  pdfBytes: ArrayBuffer,
  mode: 'invoice' | 'tables' | 'privacy_audit',
  pageNumber?: number,
  annotations?: Annotation[]
): Promise<{ reportText: string; csvData: string }> {
  const { fullText } = await extractTextFromPdf(pdfBytes, pageNumber, annotations);

  let effectivePdfBytes = pdfBytes;
  if (pageNumber) {
    try {
      const singlePageBytes = await extractSinglePageAsPdf(pdfBytes, pageNumber);
      effectivePdfBytes = singlePageBytes.buffer as ArrayBuffer;
    } catch (_) {
      effectivePdfBytes = pdfBytes;
    }
  }

  if (mode === 'invoice') {
    const prompt = `Lies alle Rechnungs-, Angebots- oder Belegdaten aus diesem Dokument präzise aus.
Gib zuerst eine übersichtliche Zusammenfassung der Kopfdaten aus (Lieferant/Aussteller, Rechnungsnummer, Rechnungsdatum, Leistungszeitraum, Zahlungsziel, IBAN, Netto, MwSt., Brutto).
Gib danach am Ende unter der exakten Überschrift "CSV_EXPORT_START" eine Semikolon-getrennte Tabelle (;) für Microsoft Excel aus, die erst die Kopfdaten und darunter alle Einzelpositionen (Pos;Bezeichnung;Menge;Einzelpreis;Gesamtpreis) enthält.`;

    const res = await callGeminiApi({
      prompt,
      systemInstruction:
        'Du bist ein präziser Buchhaltungs- und Finanz-Assistent. Extrahiere Beträge, Daten, IBAN und Rechnungspositionen exakt.',
      pdfBytes: effectivePdfBytes,
      extractedText: fullText,
    });

    const parts = res.split(/CSV_EXPORT_START[:]?/i);
    const reportText = parts[0]?.trim() || res;
    const csvData =
      parts[1]?.trim() ||
      convertTextLinesToFallbackCsv(reportText);
    return { reportText, csvData };
  }

  if (mode === 'tables') {
    const prompt = `Extrahiere sämtliche Tabellen, Listen, Positionen oder strukturierten Daten aus diesem Dokument.
Gib zuerst eine lesbare Übersicht aus und füge darunter ab der Zeile "CSV_EXPORT_START" die vollständigen Tabellendaten im Semikolon-getrennten CSV-Format (Spalte1;Spalte2;Spalte3...) für den direkten Import in Microsoft Excel an.`;

    const res = await callGeminiApi({
      prompt,
      systemInstruction:
        'Du bist ein Daten-Analyst. Extrahiere Tabellen vollständig und spaltengetreu in das Semikolon-CSV-Format.',
      pdfBytes: effectivePdfBytes,
      extractedText: fullText,
    });

    const parts = res.split(/CSV_EXPORT_START[:]?/i);
    const reportText = parts[0]?.trim() || res;
    const csvData = parts[1]?.trim() || convertTextLinesToFallbackCsv(reportText);
    return { reportText, csvData };
  }

  // mode === 'privacy_audit'
  const prompt = `Führe eine gründliche DSGVO-Datenschutz- und Vertragsrisiko-Prüfung dieses Dokuments durch:
1. Personenbezogene & sensible Daten (zum Schwärzen): Liste alle gefundenen Namen, Adressen, E-Mail-Adressen, Telefonnummern, IBAN/Bankdaten, Geburtsdaten, Kunden-/Steuernummern oder Gehaltsangaben mit Seitenzahl auf.
2. Kritische Vertragsklauseln & Fristen: Weise auf Kündigungsfristen, automatische Vertragsverlängerungen, Haftungsrisiken, Vertragsstrafen oder ungewöhnliche Zahlungsbedingungen hin.`;

  const res = await callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein Datenschutzbeauftragter (DSGVO) und Wirtschaftsjurist. Prüfe Dokumente präzise auf sensible Daten und vertragliche Risiken.',
    pdfBytes: effectivePdfBytes,
    extractedText: fullText,
  });

  return { reportText: res, csvData: '' };
}

function convertTextLinesToFallbackCsv(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const csvRows: string[] = ['Feld / Position;Wert / Details'];
  for (const line of lines) {
    const clean = line.replace(/^[•\-]\s*/, '');
    if (clean.includes(':')) {
      const idx = clean.indexOf(':');
      const k = clean.slice(0, idx).trim().replace(/;/g, ',');
      const v = clean.slice(idx + 1).trim().replace(/;/g, ',');
      csvRows.push(`${k};${v}`);
    } else if (clean.includes(';')) {
      csvRows.push(clean);
    }
  }
  return csvRows.join('\n');
}

/**
 * 8. Zwei PDF-Dokumente inhaltlich per KI vergleichen (Vertrags- & Angebots-Diff)
 */
export async function comparePdfDocumentsWithAi(
  textA: string,
  nameA: string,
  textB: string,
  nameB: string
): Promise<string> {
  const prompt = `Vergleiche die folgenden zwei Dokument-Versionen sorgfältig miteinander:

DOKUMENT A (Alt / "${nameA}"):
"""
${textA.slice(0, 25000)}
"""

DOKUMENT B (Neu / "${nameB}"):
"""
${textB.slice(0, 25000)}
"""

Erstelle eine strukturierte Übersicht aller Änderungen:
1. Geänderte Zahlen, Preise, Beträge oder Mengen (Alt -> Neu)
2. Geänderte Daten, Fristen oder Laufzeiten
3. Neu hinzugefügte Abschnitte oder Klauseln
4. Gestrichene / entfernte Inhalte
5. Fazit / Risikobewertung der Änderungen`;

  return callGeminiApi({
    prompt,
    systemInstruction:
      'Du bist ein präziser Dokumenten-Prüfer für Verträge, Angebote und Geschäftsdokumente. Arbeite jede inhaltliche Abweichung zwischen Version A und Version B klar heraus.',
  });
}

/**
 * Triggers a download of a CSV string with UTF-8 BOM so Microsoft Excel (macOS & Windows) opens umlauts and columns cleanly
 */
export function downloadCsvForExcel(csvContent: string, filename: string) {
  const cleanCsv = csvContent
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/i, '')
    .trim();
  // UTF-8 BOM (\uFEFF) ensures Excel recognizes UTF-8 encoding (ä, ö, ü, ß, €)
  const bom = '\uFEFF';
  const blob = new Blob([bom + cleanCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

