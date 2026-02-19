import Anthropic from '@anthropic-ai/sdk';
import type { RawQuoteLineItem } from './quoteImportTypes';

const SYSTEM_PROMPT = `You are a data extraction assistant for a foam cushion manufacturing company.
Extract cushion quote line items from the provided text. Each line item should have:
- customerRef: customer name or code
- foamRef: foam grade/type (e.g. "HR-2130", "HD-3660")
- lengthIn: length in inches
- widthIn: width in inches
- heightIn: height in inches
- quantity: number of pieces
- dacronRef: dacron/wrap type if mentioned (optional)
- notes: any special notes (optional)

Dimensions may appear as "24x24x4" (LxWxH) or described separately.
Quantities may appear as "3x", "qty 3", "3 pcs", etc.
Customer may appear at the top of the text or per-line.

Return ONLY a JSON array of objects with these exact fields. No other text.`;

export async function parseTextWithAi(text: string): Promise<RawQuoteLineItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: text }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response format');

  // Extract JSON from response (may be wrapped in markdown code block)
  let jsonStr = content.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array');

  return parsed.map((item: any) => ({
    customerRef: String(item.customerRef || '').trim(),
    foamRef: String(item.foamRef || '').trim(),
    lengthIn: parseFloat(item.lengthIn) || 0,
    widthIn: parseFloat(item.widthIn) || 0,
    heightIn: parseFloat(item.heightIn) || 0,
    quantity: parseInt(item.quantity) || 1,
    dacronRef: item.dacronRef ? String(item.dacronRef).trim() : undefined,
    notes: item.notes ? String(item.notes).trim() : undefined,
  }));
}

export async function parseImageWithAi(base64Image: string, mediaType: string): Promise<RawQuoteLineItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType as any, data: base64Image },
        },
        {
          type: 'text',
          text: 'Extract all cushion quote line items from this document image. Return as JSON array.',
        },
      ],
    }],
  });

  const content = response.content[0];
  if (content.type !== 'text') throw new Error('Unexpected AI response format');

  let jsonStr = content.text.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1].trim();

  const parsed = JSON.parse(jsonStr);
  if (!Array.isArray(parsed)) throw new Error('AI response is not an array');

  return parsed.map((item: any) => ({
    customerRef: String(item.customerRef || '').trim(),
    foamRef: String(item.foamRef || '').trim(),
    lengthIn: parseFloat(item.lengthIn) || 0,
    widthIn: parseFloat(item.widthIn) || 0,
    heightIn: parseFloat(item.heightIn) || 0,
    quantity: parseInt(item.quantity) || 1,
    dacronRef: item.dacronRef ? String(item.dacronRef).trim() : undefined,
    notes: item.notes ? String(item.notes).trim() : undefined,
  }));
}
