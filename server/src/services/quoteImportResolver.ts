import { prisma } from '../index';
import type { RawQuoteLineItem, ResolvedQuoteLineItem } from './quoteImportTypes';

/** Simple fuzzy match: lowercase includes or starts-with */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase().trim();
  return h === n || h.includes(n) || n.includes(h);
}

function bestMatch<T extends { score: number }>(candidates: T[]): T | null {
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export async function resolveItems(items: RawQuoteLineItem[]): Promise<ResolvedQuoteLineItem[]> {
  const [customers, foams, dacrons] = await Promise.all([
    prisma.customer.findMany(),
    prisma.foam.findMany(),
    prisma.dacron.findMany(),
  ]);

  return items.map(item => {
    const errors: string[] = [];

    // Resolve customer
    let customerId: number | null = null;
    let customerName: string | null = null;
    if (item.customerRef) {
      const ref = item.customerRef.trim();
      // Try exact code match first
      const exactCode = customers.find(c => c.code.toLowerCase() === ref.toLowerCase());
      if (exactCode) {
        customerId = exactCode.id;
        customerName = exactCode.name;
      } else {
        // Try fuzzy match on name and code
        const scored = customers.map(c => {
          let score = 0;
          if (c.code.toLowerCase() === ref.toLowerCase()) score = 100;
          else if (c.name.toLowerCase() === ref.toLowerCase()) score = 90;
          else if (fuzzyMatch(ref, c.code)) score = 70;
          else if (fuzzyMatch(ref, c.name)) score = 60;
          return { ...c, score };
        }).filter(c => c.score > 0);

        const match = bestMatch(scored);
        if (match) {
          customerId = match.id;
          customerName = match.name;
        } else {
          errors.push(`Customer not found: "${ref}"`);
        }
      }
    } else {
      errors.push('Customer reference is required');
    }

    // Resolve foam
    let foamId: number | null = null;
    let foamGrade: string | null = null;
    if (item.foamRef) {
      const ref = item.foamRef.trim();
      // Try exact grade match first
      const exactGrade = foams.find(f => f.grade.toLowerCase() === ref.toLowerCase());
      if (exactGrade) {
        foamId = exactGrade.id;
        foamGrade = exactGrade.grade;
      } else {
        const scored = foams.map(f => {
          let score = 0;
          if (f.grade.toLowerCase() === ref.toLowerCase()) score = 100;
          else if (fuzzyMatch(ref, f.grade)) score = 70;
          else if (f.description && fuzzyMatch(ref, f.description)) score = 40;
          return { ...f, score };
        }).filter(f => f.score > 0);

        const match = bestMatch(scored);
        if (match) {
          foamId = match.id;
          foamGrade = match.grade;
        } else {
          errors.push(`Foam not found: "${ref}"`);
        }
      }
    } else {
      errors.push('Foam reference is required');
    }

    // Resolve dacron (optional)
    let dacronId: number | null = null;
    let dacronName: string | null = null;
    if (item.dacronRef) {
      const ref = item.dacronRef.trim();
      const exactName = dacrons.find(d => d.name.toLowerCase() === ref.toLowerCase());
      if (exactName) {
        dacronId = exactName.id;
        dacronName = exactName.name;
      } else {
        const scored = dacrons.map(d => {
          let score = 0;
          if (d.name.toLowerCase() === ref.toLowerCase()) score = 100;
          else if (fuzzyMatch(ref, d.name)) score = 70;
          else if (d.description && fuzzyMatch(ref, d.description)) score = 40;
          return { ...d, score };
        }).filter(d => d.score > 0);

        const match = bestMatch(scored);
        if (match) {
          dacronId = match.id;
          dacronName = match.name;
        } else {
          errors.push(`Dacron not found: "${ref}"`);
        }
      }
    }

    return {
      ...item,
      customerId,
      customerName,
      foamId,
      foamGrade,
      dacronId,
      dacronName,
      errors,
    };
  });
}
