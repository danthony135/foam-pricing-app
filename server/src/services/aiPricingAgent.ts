import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../index';
import { calculatePrice, PricingInput } from './pricingEngine';

const toolDefinitions: Anthropic.Tool[] = [
  {
    name: 'list_customers',
    description: 'List all customers with their codes and markup percentages',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'list_foams',
    description: 'List all foam grades with density and cost per board foot',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_customer_pricing',
    description: 'Get customer-specific foam pricing overrides',
    input_schema: {
      type: 'object' as const,
      properties: { customer_code: { type: 'string', description: 'Customer code' } },
      required: ['customer_code'],
    },
  },
  {
    name: 'update_customer_markup',
    description: 'Update the default markup percentage for a customer',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_code: { type: 'string' },
        markup_percent: { type: 'number' },
      },
      required: ['customer_code', 'markup_percent'],
    },
  },
  {
    name: 'set_foam_price_for_customer',
    description: 'Set a per-customer foam cost override ($/BF)',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_code: { type: 'string' },
        foam_grade: { type: 'string' },
        cost_per_bf: { type: 'number' },
      },
      required: ['customer_code', 'foam_grade', 'cost_per_bf'],
    },
  },
  {
    name: 'create_pricing_rule',
    description: 'Create a conditional pricing rule (e.g. markup for foam type or customer)',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string' },
        conditions: { type: 'object' as const, description: 'JSON conditions like {foam_grade_prefix: "HR", customer_code: "ACME"}' },
        actions: { type: 'object' as const, description: 'JSON actions like {markup_percent: 25, cost_adjustment: 0.05}' },
        priority: { type: 'number' },
      },
      required: ['name', 'conditions', 'actions'],
    },
  },
  {
    name: 'calculate_price',
    description: 'Calculate the full price breakdown for a cushion',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_code: { type: 'string' },
        foam_grade: { type: 'string' },
        length: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        quantity: { type: 'number' },
      },
      required: ['foam_grade', 'length', 'width', 'height'],
    },
  },
];

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'list_customers': {
      const customers = await prisma.customer.findMany({ select: { name: true, code: true, markupPercent: true, shippingCostPerBF: true } });
      return JSON.stringify(customers);
    }
    case 'list_foams': {
      const foams = await prisma.foam.findMany({ select: { grade: true, density: true, costPerBoardFoot: true, supplier: true } });
      return JSON.stringify(foams);
    }
    case 'get_customer_pricing': {
      const customer = await prisma.customer.findUnique({
        where: { code: input.customer_code },
        include: { foamPricing: { include: { foam: true } } },
      });
      if (!customer) return JSON.stringify({ error: 'Customer not found' });
      return JSON.stringify({
        customer: { name: customer.name, code: customer.code, markup: customer.markupPercent },
        overrides: customer.foamPricing.map(p => ({
          foam: p.foam.grade,
          costPerBF: p.overrideCostPerBF,
          markup: p.overrideMarkup,
        })),
      });
    }
    case 'update_customer_markup': {
      const c = await prisma.customer.update({
        where: { code: input.customer_code },
        data: { markupPercent: input.markup_percent },
      });
      return JSON.stringify({ success: true, customer: c.code, newMarkup: c.markupPercent });
    }
    case 'set_foam_price_for_customer': {
      const customer = await prisma.customer.findUniqueOrThrow({ where: { code: input.customer_code } });
      const foam = await prisma.foam.findUniqueOrThrow({ where: { grade: input.foam_grade } });
      const pricing = await prisma.customerFoamPricing.upsert({
        where: { customerId_foamId: { customerId: customer.id, foamId: foam.id } },
        update: { overrideCostPerBF: input.cost_per_bf },
        create: { customerId: customer.id, foamId: foam.id, overrideCostPerBF: input.cost_per_bf },
      });
      return JSON.stringify({ success: true, pricing });
    }
    case 'create_pricing_rule': {
      const rule = await prisma.pricingRule.create({
        data: {
          name: input.name,
          ruleType: 'ai',
          conditions: input.conditions,
          actions: input.actions,
          priority: input.priority || 0,
        },
      });
      return JSON.stringify({ success: true, rule });
    }
    case 'calculate_price': {
      const foam = await prisma.foam.findUniqueOrThrow({ where: { grade: input.foam_grade } });
      const customer = input.customer_code
        ? await prisma.customer.findUnique({ where: { code: input.customer_code } })
        : null;
      const labor = await prisma.laborSettings.upsert({ where: { id: 1 }, update: {}, create: {} });
      const overhead = await prisma.overheadSettings.upsert({ where: { id: 1 }, update: {}, create: {} });

      let foamCost = foam.costPerBoardFoot;
      let markup = customer?.markupPercent ?? overhead.defaultMarkupPercent;
      if (customer) {
        const override = await prisma.customerFoamPricing.findUnique({
          where: { customerId_foamId: { customerId: customer.id, foamId: foam.id } },
        });
        if (override?.overrideCostPerBF != null) foamCost = override.overrideCostPerBF;
        if (override?.overrideMarkup != null) markup = override.overrideMarkup;
      }

      const pi: PricingInput = {
        lengthIn: input.length, widthIn: input.width, heightIn: input.height,
        foamCostPerBF: foamCost, foamTolerancePct: 0,
        makeTimeMin: labor.defaultMakeTimeMin, hourlyRate: labor.avgHourlyRate,
        facilityOverheadPct: overhead.facilityOverheadPercent,
        indirectLaborPct: overhead.indirectLaborPercent,
        markupPct: markup,
        shippingCostPerBF: customer?.shippingCostPerBF ?? 0,
        quantity: input.quantity || 1,
      };
      const breakdown = calculatePrice(pi);
      return JSON.stringify(breakdown);
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function runAiChat(userMessage: string, history: Anthropic.MessageParam[]): Promise<{
  response: string;
  pendingActions: { tool: string; input: any }[];
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { response: 'ANTHROPIC_API_KEY not configured.', pendingActions: [] };

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: userMessage },
  ];

  const systemPrompt = `You are a foam pricing assistant. You help users manage foam pricing, customer markups, and calculate cushion prices. Use the available tools to look up data and make changes. Always confirm before making changes that affect pricing. Be concise and helpful.`;

  let response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    tools: toolDefinitions,
    messages,
  });

  const pendingActions: { tool: string; input: any }[] = [];
  let textParts: string[] = [];

  // Agentic loop
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: any } =>
        b.type === 'tool_use'
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      // Read-only tools execute immediately; write tools need confirmation
      const readOnlyTools = ['list_customers', 'list_foams', 'get_customer_pricing', 'calculate_price'];
      if (readOnlyTools.includes(block.name)) {
        const result = await executeTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      } else {
        pendingActions.push({ tool: block.name, input: block.input });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify({ status: 'pending_confirmation', message: 'Action queued for user confirmation' }),
        });
      }
    }

    // Collect text blocks
    for (const block of response.content) {
      if (block.type === 'text') textParts.push(block.text);
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: toolDefinitions,
      messages,
    });
  }

  // Collect final text
  for (const block of response.content) {
    if (block.type === 'text') textParts.push(block.text);
  }

  return { response: textParts.join('\n'), pendingActions };
}

export { executeTool };
