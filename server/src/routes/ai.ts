import { Router } from 'express';
import { prisma } from '../index';
import { runAiChat, executeTool } from '../services/aiPricingAgent';

const router = Router();

router.post('/chat', async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;

    // Save user message
    await prisma.aiChatMessage.create({ data: { role: 'user', content: message } });

    const result = await runAiChat(message, history);

    // Save assistant response
    await prisma.aiChatMessage.create({
      data: {
        role: 'assistant',
        content: result.response,
        toolCalls: result.pendingActions.length > 0 ? result.pendingActions : undefined,
      },
    });

    res.json(result);
  } catch (err) { next(err); }
});

// Confirm and execute pending actions
router.post('/confirm', async (req, res, next) => {
  try {
    const { actions } = req.body; // array of { tool, input }
    const results = [];

    for (const action of actions) {
      const result = await executeTool(action.tool, action.input);
      results.push({ tool: action.tool, result: JSON.parse(result) });
    }

    res.json({ results });
  } catch (err) { next(err); }
});

router.get('/history', async (_req, res, next) => {
  try {
    const messages = await prisma.aiChatMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    res.json(messages);
  } catch (err) { next(err); }
});

router.delete('/history', async (_req, res, next) => {
  try {
    await prisma.aiChatMessage.deleteMany();
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
