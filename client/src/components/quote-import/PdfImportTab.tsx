import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { RawQuoteLineItem } from '@/types';

interface Props {
  onItemsParsed: (items: RawQuoteLineItem[]) => void;
}

export function PdfImportTab({ onItemsParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      const result = await api.quoteImportParsePdf(base64);
      if (result.items.length === 0) {
        setError('No quote items found in the PDF. Make sure it contains customer, foam, dimensions, and quantity information.');
      } else {
        onItemsParsed(result.items);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse PDF');
    } finally {
      setLoading(false);
    }
  }, [onItemsParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Extracting from {fileName}...</p>
                <p className="text-xs text-muted-foreground">This may take a moment for scanned PDFs</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <FileText className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">Drop your PDF file here</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Supports text-based and scanned PDFs (via AI vision)
                  </p>
                </div>
                <label>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileInput}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Browse Files
                    </span>
                  </Button>
                </label>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive mt-3">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
