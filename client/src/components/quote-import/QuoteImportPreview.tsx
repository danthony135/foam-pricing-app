import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Loader2, CheckCircle2, XCircle, DollarSign, Save,
  ArrowRight, RefreshCw, ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { RawQuoteLineItem, ResolvedQuoteLineItem, PricedQuoteLineItem } from '@/types';

type PipelineStep = 'parsed' | 'resolving' | 'resolved' | 'pricing' | 'priced' | 'saving' | 'saved';

interface Props {
  rawItems: RawQuoteLineItem[];
  onReset: () => void;
}

export function QuoteImportPreview({ rawItems, onReset }: Props) {
  const [step, setStep] = useState<PipelineStep>('parsed');
  const [resolvedItems, setResolvedItems] = useState<ResolvedQuoteLineItem[]>([]);
  const [pricedItems, setPricedItems] = useState<PricedQuoteLineItem[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Editable raw items for fixing unmatched references
  const [editableItems, setEditableItems] = useState<RawQuoteLineItem[]>(rawItems);

  const handleResolve = async () => {
    setError(null);
    setStep('resolving');
    try {
      const result = await api.quoteImportResolve(editableItems);
      setResolvedItems(result.items);
      setStep('resolved');
    } catch (err: any) {
      setError(err.message);
      setStep('parsed');
    }
  };

  const handlePrice = async () => {
    setError(null);
    setStep('pricing');
    try {
      const validItems = resolvedItems.filter(i => i.errors.length === 0);
      if (validItems.length === 0) {
        setError('No valid items to price. Fix the errors above and re-resolve.');
        setStep('resolved');
        return;
      }
      const result = await api.quoteImportPrice(validItems);
      setPricedItems(result.items);
      setStep('priced');
    } catch (err: any) {
      setError(err.message);
      setStep('resolved');
    }
  };

  const handleSave = async () => {
    setError(null);
    setStep('saving');
    try {
      const result = await api.quoteImportSave(pricedItems);
      setSavedCount(result.count);
      setStep('saved');
    } catch (err: any) {
      setError(err.message);
      setStep('priced');
    }
  };

  const updateEditableItem = (index: number, field: keyof RawQuoteLineItem, value: string) => {
    setEditableItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'lengthIn' || field === 'widthIn' || field === 'heightIn') {
        return { ...item, [field]: parseFloat(value) || 0 };
      }
      if (field === 'quantity') {
        return { ...item, [field]: parseInt(value) || 1 };
      }
      return { ...item, [field]: value };
    }));
  };

  const isLoading = step === 'resolving' || step === 'pricing' || step === 'saving';

  return (
    <div className="space-y-4">
      {/* Pipeline Status Bar */}
      <div className="flex items-center gap-2 text-sm">
        <StepIndicator label="Parsed" active={step === 'parsed'} done={step !== 'parsed'} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator label="Resolved" active={step === 'resolving' || step === 'resolved'} done={['pricing', 'priced', 'saving', 'saved'].includes(step)} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator label="Priced" active={step === 'pricing' || step === 'priced'} done={['saving', 'saved'].includes(step)} />
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <StepIndicator label="Saved" active={step === 'saving' || step === 'saved'} done={step === 'saved'} />
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
          {error}
        </div>
      )}

      {/* Parsed Items Table (editable) */}
      {(step === 'parsed' || step === 'resolving') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Parsed Items ({editableItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-2 font-medium">#</th>
                    <th className="pb-2 pr-2 font-medium">Customer</th>
                    <th className="pb-2 pr-2 font-medium">Foam</th>
                    <th className="pb-2 pr-2 font-medium">L</th>
                    <th className="pb-2 pr-2 font-medium">W</th>
                    <th className="pb-2 pr-2 font-medium">H</th>
                    <th className="pb-2 pr-2 font-medium">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Dacron</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {editableItems.map((item, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-28"
                          value={item.customerRef}
                          onChange={e => updateEditableItem(i, 'customerRef', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-24"
                          value={item.foamRef}
                          onChange={e => updateEditableItem(i, 'foamRef', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-14"
                          type="number"
                          value={item.lengthIn}
                          onChange={e => updateEditableItem(i, 'lengthIn', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-14"
                          type="number"
                          value={item.widthIn}
                          onChange={e => updateEditableItem(i, 'widthIn', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-14"
                          type="number"
                          value={item.heightIn}
                          onChange={e => updateEditableItem(i, 'heightIn', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-14"
                          type="number"
                          value={item.quantity}
                          onChange={e => updateEditableItem(i, 'quantity', e.target.value)}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          className="h-7 text-xs w-24"
                          value={item.dacronRef || ''}
                          onChange={e => updateEditableItem(i, 'dacronRef', e.target.value)}
                        />
                      </td>
                      <td className="py-2">
                        <span className="text-xs text-muted-foreground">{item.notes || '-'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleResolve} disabled={isLoading}>
                {step === 'resolving' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Resolve References
              </Button>
              <Button variant="outline" onClick={onReset}>Start Over</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolved Items Table */}
      {(step === 'resolved' || step === 'pricing') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resolved Items
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {resolvedItems.filter(i => i.errors.length === 0).length} valid,{' '}
                {resolvedItems.filter(i => i.errors.length > 0).length} with errors
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-2 font-medium"></th>
                    <th className="pb-2 pr-2 font-medium">Customer</th>
                    <th className="pb-2 pr-2 font-medium">Foam</th>
                    <th className="pb-2 pr-2 font-medium">Dimensions</th>
                    <th className="pb-2 pr-2 font-medium text-right">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Dacron</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedItems.map((item, i) => {
                    const valid = item.errors.length === 0;
                    return (
                      <tr key={i} className={`border-b last:border-b-0 ${valid ? '' : 'bg-destructive/5'}`}>
                        <td className="py-2 pr-2">
                          {valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {item.customerName ? (
                            <span>{item.customerName}</span>
                          ) : (
                            <span className="text-destructive">{item.customerRef}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          {item.foamGrade ? (
                            <span>{item.foamGrade}</span>
                          ) : (
                            <span className="text-destructive">{item.foamRef}</span>
                          )}
                        </td>
                        <td className="py-2 pr-2">{item.lengthIn} x {item.widthIn} x {item.heightIn}</td>
                        <td className="py-2 pr-2 text-right">{item.quantity}</td>
                        <td className="py-2 pr-2">{item.dacronName || item.dacronRef || '-'}</td>
                        <td className="py-2">
                          {valid ? (
                            <Badge variant="default">Matched</Badge>
                          ) : (
                            <div className="space-y-0.5">
                              {item.errors.map((err, j) => (
                                <p key={j} className="text-xs text-destructive">{err}</p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={handlePrice}
                disabled={isLoading || resolvedItems.filter(i => i.errors.length === 0).length === 0}
              >
                {step === 'pricing' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Calculate Prices
              </Button>
              <Button variant="outline" onClick={() => { setStep('parsed'); }}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Edit & Re-resolve
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priced Items Table */}
      {(step === 'priced' || step === 'saving') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Priced Items ({pricedItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-2 font-medium">Customer</th>
                    <th className="pb-2 pr-2 font-medium">Foam</th>
                    <th className="pb-2 pr-2 font-medium">Dimensions</th>
                    <th className="pb-2 pr-2 font-medium text-right">Qty</th>
                    <th className="pb-2 pr-2 font-medium">Dacron</th>
                    <th className="pb-2 pr-2 font-medium">Part #</th>
                    <th className="pb-2 pr-2 font-medium text-right">Unit Price</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedItems.map((item, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{item.customerName}</td>
                      <td className="py-2 pr-2">{item.foamGrade}</td>
                      <td className="py-2 pr-2">{item.lengthIn} x {item.widthIn} x {item.heightIn}</td>
                      <td className="py-2 pr-2 text-right">{item.quantity}</td>
                      <td className="py-2 pr-2">{item.dacronName || '-'}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{item.partNumber || '-'}</td>
                      <td className="py-2 pr-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td colSpan={7} className="py-2 pr-2 text-right">Grand Total:</td>
                    <td className="py-2 text-right">
                      {formatCurrency(pricedItems.reduce((sum, i) => sum + i.totalPrice, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} disabled={isLoading}>
                {step === 'saving' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save as Draft Quotes
              </Button>
              <Button variant="outline" onClick={() => setStep('resolved')}>Back to Resolve</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Confirmation */}
      {step === 'saved' && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h3 className="text-lg font-medium">
                {savedCount} Draft Quote{savedCount !== 1 ? 's' : ''} Created
              </h3>
              <p className="text-sm text-muted-foreground">
                Your quotes have been saved with "draft" status.
              </p>
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="outline" asChild>
                  <a href="/quotes">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Quotes
                  </a>
                </Button>
                <Button onClick={onReset}>Import More</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepIndicator({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
      done ? 'bg-green-100 text-green-700' :
      active ? 'bg-primary/10 text-primary' :
      'bg-muted text-muted-foreground'
    }`}>
      {label}
    </span>
  );
}
