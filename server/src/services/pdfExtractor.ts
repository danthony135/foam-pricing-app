import { parseTextWithAi, parseImageWithAi } from './quoteAiParser';
import type { RawQuoteLineItem } from './quoteImportTypes';

/** Extract text from a PDF buffer and parse into quote line items */
export async function extractFromPdf(buffer: Buffer): Promise<RawQuoteLineItem[]> {
  // Try text extraction first
  const text = await extractTextFromPdf(buffer);

  if (text && text.trim().length > 50) {
    // Text-based PDF - parse extracted text with AI
    return parseTextWithAi(text);
  }

  // Scanned/image PDF - send as document to Claude vision
  const base64 = buffer.toString('base64');
  return parseImageWithAi(base64, 'application/pdf');
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch {
    return '';
  }
}
