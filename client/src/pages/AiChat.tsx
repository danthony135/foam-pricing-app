import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Send, Trash2, CheckCircle, XCircle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  pendingActions?: { tool: string; input: any }[];
}

export default function AiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getAiHistory().then((history) => {
      setMessages(
        history.map((m: any) => ({
          role: m.role,
          content: m.content,
          pendingActions: m.toolCalls || undefined,
        }))
      );
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
      const result = await api.aiChat(userMsg, history);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.response,
          pendingActions: result.pendingActions?.length > 0 ? result.pendingActions : undefined,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const confirmActions = async (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg.pendingActions) return;

    setLoading(true);
    try {
      const result = await api.aiConfirm(msg.pendingActions);
      setMessages((prev) => {
        const updated = [...prev];
        updated[msgIndex] = { ...updated[msgIndex], pendingActions: undefined };
        updated.push({
          role: 'assistant',
          content: `Actions executed successfully:\n${result.results.map((r: any) => `- ${r.tool}: ${JSON.stringify(r.result)}`).join('\n')}`,
        });
        return updated;
      });
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error executing actions: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const rejectActions = (msgIndex: number) => {
    setMessages((prev) => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], pendingActions: undefined };
      updated.push({ role: 'assistant', content: 'Actions cancelled.' });
      return updated;
    });
  };

  const clearHistory = async () => {
    if (!window.confirm('Clear all chat history?')) return;
    await api.clearAiHistory();
    setMessages([]);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Pricing Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about pricing, manage customer markups, or calculate prices
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clearHistory}>
          <Trash2 className="mr-2 h-4 w-4" /> Clear History
        </Button>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-lg font-medium">Start a conversation</p>
                <p className="mt-1 text-sm">Try: "What foams do we have?" or "Price a 24x24x4 HR-2130 cushion for ACME"</p>
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                {msg.pendingActions && msg.pendingActions.length > 0 && (
                  <div className="mt-3 space-y-2 border-t pt-2">
                    <p className="text-xs font-semibold">Pending Actions:</p>
                    {msg.pendingActions.map((action, j) => (
                      <div key={j} className="rounded bg-background/50 p-2 text-xs">
                        <Badge variant="outline" className="mb-1">{action.tool}</Badge>
                        <pre className="mt-1 overflow-x-auto">{JSON.stringify(action.input, null, 2)}</pre>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => confirmActions(i)} disabled={loading}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => rejectActions(i)} disabled={loading}>
                        <XCircle className="mr-1 h-3 w-3" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mb-4 flex justify-start">
              <div className="rounded-lg bg-muted px-4 py-2 text-sm text-muted-foreground">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pricing, customers, or foams..."
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
