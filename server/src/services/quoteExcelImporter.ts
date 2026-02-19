import * as XLSX from 'xlsx';
import type { RawQuoteLineItem } from './quoteImportTypes';

interface ColumnMapping {
  customer: string;
  foam: string;
  dimensions?: string; // combined "24x24x4"
  length?: string;
  width?: string;
  height?: string;
  quantity: string;
  dacron?: string;
  notes?: string;
}

export function parseQuoteExcel(buffer: Buffer, mapping?: Partial<ColumnMapping>): RawQuoteLineItem[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

  if (rawRows.length === 0) return [];

  const headers = Object.keys(rawRows[0]);
  const m: ColumnMapping = {
    customer: mapping?.customer || findHeader(headers, ['customer', 'client', 'account', 'company']) || headers[0],
    foam: mapping?.foam || findHeader(headers, ['foam', 'grade', 'type', 'material']) || headers[1],
    dimensions: mapping?.dimensions || findHeader(headers, ['dimensions', 'dim', 'size']),
    length: mapping?.length || findHeader(headers, ['length', 'len', 'l']),
    width: mapping?.width || findHeader(headers, ['width', 'wid', 'w']),
    height: mapping?.height || findHeader(headers, ['height', 'ht', 'h', 'thickness', 'thick']),
    quantity: mapping?.quantity || findHeader(headers, ['qty', 'quantity', 'count', 'pcs']) || headers[headers.length - 1],
    dacron: mapping?.dacron || findHeader(headers, ['dacron', 'wrap', 'fiber']),
    notes: mapping?.notes || findHeader(headers, ['notes', 'note', 'comment', 'comments']),
  };

  return rawRows
    .map(row => {
      let lengthIn = 0, widthIn = 0, heightIn = 0;

      // Try combined dimensions first (e.g. "24x24x4")
      if (m.dimensions && row[m.dimensions]) {
        const parsed = parseDimensions(String(row[m.dimensions]));
        if (parsed) {
          lengthIn = parsed.l;
          widthIn = parsed.w;
          heightIn = parsed.h;
        }
      }

      // Fall back to separate columns
      if (lengthIn === 0 && m.length && row[m.length]) {
        lengthIn = parseFloat(row[m.length]) || 0;
      }
      if (widthIn === 0 && m.width && row[m.width]) {
        widthIn = parseFloat(row[m.width]) || 0;
      }
      if (heightIn === 0 && m.height && row[m.height]) {
        heightIn = parseFloat(row[m.height]) || 0;
      }

      return {
        customerRef: String(row[m.customer] || '').trim(),
        foamRef: String(row[m.foam] || '').trim(),
        lengthIn,
        widthIn,
        heightIn,
        quantity: parseInt(row[m.quantity]) || 1,
        dacronRef: m.dacron && row[m.dacron] ? String(row[m.dacron]).trim() : undefined,
        notes: m.notes && row[m.notes] ? String(row[m.notes]).trim() : undefined,
      };
    })
    .filter(r => r.customerRef && r.foamRef && r.lengthIn > 0 && r.widthIn > 0 && r.heightIn > 0);
}

/** Parse combined dimension string like "24x24x4", "24 x 24 x 4", "24X24X4" */
function parseDimensions(str: string): { l: number; w: number; h: number } | null {
  const match = str.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { l: parseFloat(match[1]), w: parseFloat(match[2]), h: parseFloat(match[3]) };
}

function findHeader(headers: string[], patterns: string[]): string | undefined {
  return headers.find(h => {
    const lower = h.toLowerCase().trim();
    return patterns.some(p => lower === p || lower.includes(p));
  });
}
