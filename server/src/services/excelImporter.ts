import * as XLSX from 'xlsx';

export interface FoamImportRow {
  grade: string;
  density: number;
  ild?: number;
  costPerBoardFoot: number;
  supplier?: string;
  description?: string;
}

interface ColumnMapping {
  grade: string;
  density: string;
  ild?: string;
  costPerBoardFoot: string;
  supplier?: string;
  description?: string;
}

export function parseExcelBuffer(buffer: Buffer, mapping?: Partial<ColumnMapping>): FoamImportRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

  if (rawRows.length === 0) return [];

  // Auto-detect column mapping if not provided
  const headers = Object.keys(rawRows[0]);
  const m: ColumnMapping = {
    grade: mapping?.grade || findHeader(headers, ['grade', 'foam', 'type', 'name']) || headers[0],
    density: mapping?.density || findHeader(headers, ['density', 'lb', 'pcf']) || headers[1],
    costPerBoardFoot: mapping?.costPerBoardFoot || findHeader(headers, ['cost', 'price', '$/bf', 'bf']) || headers[2],
    ild: mapping?.ild || findHeader(headers, ['ild', 'firmness']),
    supplier: mapping?.supplier || findHeader(headers, ['supplier', 'vendor', 'mfg']),
    description: mapping?.description || findHeader(headers, ['description', 'desc', 'notes']),
  };

  return rawRows
    .map(row => ({
      grade: String(row[m.grade] || '').trim(),
      density: parseFloat(row[m.density]) || 0,
      ild: m.ild ? parseFloat(row[m.ild]) || undefined : undefined,
      costPerBoardFoot: parseFloat(row[m.costPerBoardFoot]) || 0,
      supplier: m.supplier ? String(row[m.supplier] || '').trim() || undefined : undefined,
      description: m.description ? String(row[m.description] || '').trim() || undefined : undefined,
    }))
    .filter(r => r.grade && r.costPerBoardFoot > 0);
}

function findHeader(headers: string[], patterns: string[]): string | undefined {
  return headers.find(h => {
    const lower = h.toLowerCase();
    return patterns.some(p => lower.includes(p));
  });
}
