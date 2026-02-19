import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Mail, FileText, Import } from 'lucide-react';
import { ExcelImportTab } from '@/components/quote-import/ExcelImportTab';
import { EmailImportTab } from '@/components/quote-import/EmailImportTab';
import { PdfImportTab } from '@/components/quote-import/PdfImportTab';
import { QuoteImportPreview } from '@/components/quote-import/QuoteImportPreview';
import type { RawQuoteLineItem } from '@/types';

export default function ImportQuotes() {
  const [rawItems, setRawItems] = useState<RawQuoteLineItem[] | null>(null);

  const handleItemsParsed = (items: RawQuoteLineItem[]) => {
    setRawItems(items);
  };

  const handleReset = () => {
    setRawItems(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Import className="h-6 w-6" />
        Import Quotes
      </h1>

      {!rawItems ? (
        <Tabs defaultValue="excel">
          <TabsList>
            <TabsTrigger value="excel" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel / CSV
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-2">
              <FileText className="h-4 w-4" />
              PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="excel">
            <ExcelImportTab onItemsParsed={handleItemsParsed} />
          </TabsContent>

          <TabsContent value="email">
            <EmailImportTab onItemsParsed={handleItemsParsed} />
          </TabsContent>

          <TabsContent value="pdf">
            <PdfImportTab onItemsParsed={handleItemsParsed} />
          </TabsContent>
        </Tabs>
      ) : (
        <QuoteImportPreview rawItems={rawItems} onReset={handleReset} />
      )}
    </div>
  );
}
