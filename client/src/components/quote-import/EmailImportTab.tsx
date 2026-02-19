import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import type { RawQuoteLineItem } from '@/types';

interface Props {
  onItemsParsed: (items: RawQuoteLineItem[]) => void;
}

export function EmailImportTab({ onItemsParsed }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    if (!text.trim()) return;
    setError(null);
    setLoading(true);

    try {
      const result = await api.quoteImportParseEmail(text);
      if (result.items.length === 0) {
        setError('No quote items found in the text. Try including customer name, foam grade, dimensions, and quantity.');
      } else {
        onItemsParsed(result.items);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>Paste the email text below and AI will extract quote line items</span>
            </div>

            <textarea
              className="w-full min-h-[200px] rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
              placeholder={`Example:\n\nHi, need pricing for ACME Corp:\n- 3x HR-2130 cushions 24x24x4\n- 5x HD-3660 cushions 30x20x6 with dacron wrap\n- 2x HR-2130 24x18x5\n\nThanks!`}
              value={text}
              onChange={e => setText(e.target.value)}
            />

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              onClick={handleParse}
              disabled={!text.trim() || loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              {loading ? 'Parsing with AI...' : 'Parse with AI'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
