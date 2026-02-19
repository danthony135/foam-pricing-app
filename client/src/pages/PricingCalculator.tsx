import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Customer, Foam, Dacron, PricingBreakdown } from "@/types";
import { Calculator, Save, Loader2 } from "lucide-react";

interface FormValues {
  customerId: string;
  foamId: string;
  length: number;
  width: number;
  height: number;
  foamTolerance: number;
  dacronId: string;
  dacronTolerance: number;
  makeTimeOverride: string;
  quantity: number;
}

const initialFormValues: FormValues = {
  customerId: "",
  foamId: "",
  length: 0,
  width: 0,
  height: 0,
  foamTolerance: 0,
  dacronId: "",
  dacronTolerance: 0,
  makeTimeOverride: "",
  quantity: 1,
};

export default function PricingCalculator() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [foams, setFoams] = useState<Foam[]>([]);
  const [dacrons, setDacrons] = useState<Dacron[]>([]);
  const [form, setForm] = useState<FormValues>(initialFormValues);
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [customerData, foamData, dacronData] = await Promise.all([
          api.getCustomers(),
          api.getFoams(),
          api.getDacrons(),
        ]);
        setCustomers(customerData);
        setFoams(foamData);
        setDacrons(dacronData);
      } catch (error) {
        console.error("Failed to fetch reference data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    const canCalculate =
      form.foamId &&
      form.length > 0 &&
      form.width > 0 &&
      form.height > 0;

    if (!canCalculate) {
      setBreakdown(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setCalculating(true);
      try {
        const result = await api.calculatePrice({
          customerId: form.customerId || undefined,
          foamId: form.foamId,
          length: form.length,
          width: form.width,
          height: form.height,
          foamTolerance: form.foamTolerance,
          dacronId: form.dacronId || undefined,
          dacronTolerance: form.dacronTolerance,
          makeTimeOverride: form.makeTimeOverride
            ? Number(form.makeTimeOverride)
            : undefined,
          quantity: form.quantity,
        });
        setBreakdown(result);
      } catch (error) {
        console.error("Failed to calculate price:", error);
        setBreakdown(null);
      } finally {
        setCalculating(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [form]);

  const updateForm = useCallback(
    (field: keyof FormValues, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleNumberChange = useCallback(
    (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (field === "makeTimeOverride") {
        updateForm(field, val);
      } else {
        updateForm(field, val === "" ? 0 : Number(val));
      }
    },
    [updateForm]
  );

  const handleSaveQuote = async () => {
    if (!breakdown) return;
    setSaving(true);
    try {
      await api.createQuote({
        customerId: form.customerId || undefined,
        foamId: form.foamId,
        length: form.length,
        width: form.width,
        height: form.height,
        foamTolerance: form.foamTolerance,
        dacronId: form.dacronId || undefined,
        dacronTolerance: form.dacronTolerance,
        makeTimeOverride: form.makeTimeOverride
          ? Number(form.makeTimeOverride)
          : undefined,
        quantity: form.quantity,
        breakdown,
      });
      alert("Quote saved!");
    } catch (error) {
      console.error("Failed to save quote:", error);
      alert("Failed to save quote. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Panel — Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Pricing Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer */}
          <div className="space-y-2">
            <Label htmlFor="customer">Customer</Label>
            <Select
              value={form.customerId}
              onValueChange={(value) => updateForm("customerId", value)}
            >
              <SelectTrigger id="customer">
                <SelectValue placeholder="No Customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Customer</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Foam */}
          <div className="space-y-2">
            <Label htmlFor="foam">Foam *</Label>
            <Select
              value={form.foamId}
              onValueChange={(value) => updateForm("foamId", value)}
            >
              <SelectTrigger id="foam">
                <SelectValue placeholder="Select foam..." />
              </SelectTrigger>
              <SelectContent>
                {foams.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dimensions */}
          <div className="space-y-2">
            <Label>Dimensions (inches)</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="length" className="text-xs text-muted-foreground">
                  Length
                </Label>
                <Input
                  id="length"
                  type="number"
                  min={0}
                  step="any"
                  value={form.length || ""}
                  onChange={handleNumberChange("length")}
                  placeholder="Length"
                />
              </div>
              <div>
                <Label htmlFor="width" className="text-xs text-muted-foreground">
                  Width
                </Label>
                <Input
                  id="width"
                  type="number"
                  min={0}
                  step="any"
                  value={form.width || ""}
                  onChange={handleNumberChange("width")}
                  placeholder="Width"
                />
              </div>
              <div>
                <Label htmlFor="height" className="text-xs text-muted-foreground">
                  Height
                </Label>
                <Input
                  id="height"
                  type="number"
                  min={0}
                  step="any"
                  value={form.height || ""}
                  onChange={handleNumberChange("height")}
                  placeholder="Height"
                />
              </div>
            </div>
          </div>

          {/* Foam Tolerance */}
          <div className="space-y-2">
            <Label htmlFor="foamTolerance">Foam Tolerance %</Label>
            <Input
              id="foamTolerance"
              type="number"
              min={0}
              step="any"
              value={form.foamTolerance || ""}
              onChange={handleNumberChange("foamTolerance")}
              placeholder="0"
            />
          </div>

          {/* Dacron */}
          <div className="space-y-2">
            <Label htmlFor="dacron">Dacron</Label>
            <Select
              value={form.dacronId}
              onValueChange={(value) => updateForm("dacronId", value)}
            >
              <SelectTrigger id="dacron">
                <SelectValue placeholder="No Dacron" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Dacron</SelectItem>
                {dacrons.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dacron Tolerance */}
          <div className="space-y-2">
            <Label htmlFor="dacronTolerance">Dacron Tolerance %</Label>
            <Input
              id="dacronTolerance"
              type="number"
              min={0}
              step="any"
              value={form.dacronTolerance || ""}
              onChange={handleNumberChange("dacronTolerance")}
              placeholder="0"
            />
          </div>

          {/* Make Time Override */}
          <div className="space-y-2">
            <Label htmlFor="makeTimeOverride">Make Time Override (min)</Label>
            <Input
              id="makeTimeOverride"
              type="number"
              min={0}
              step="any"
              value={form.makeTimeOverride}
              onChange={handleNumberChange("makeTimeOverride")}
              placeholder="Default"
            />
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={form.quantity || ""}
              onChange={handleNumberChange("quantity")}
              placeholder="1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Right Panel — Results */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {calculating && (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Calculating...</span>
            </div>
          )}

          {!calculating && !breakdown && (
            <p className="text-muted-foreground text-center py-8">
              Enter a foam selection and dimensions to see pricing.
            </p>
          )}

          {!calculating && breakdown && (
            <div className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Board Feet</span>
                  <span>{breakdown.boardFeet} BF</span>
                </div>

                {breakdown.dacronSqFt != null && breakdown.dacronSqFt > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dacron SqFt</span>
                    <span>{breakdown.dacronSqFt}</span>
                  </div>
                )}

                <hr />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Foam Material</span>
                  <span>{formatCurrency(breakdown.foamMaterialCost)}</span>
                </div>

                {breakdown.dacronMaterialCost != null &&
                  breakdown.dacronMaterialCost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Dacron Material
                      </span>
                      <span>{formatCurrency(breakdown.dacronMaterialCost)}</span>
                    </div>
                  )}

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Material</span>
                  <span>{formatCurrency(breakdown.totalMaterialCost)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labor</span>
                  <span>{formatCurrency(breakdown.laborCost)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Material + Labor
                  </span>
                  <span>{formatCurrency(breakdown.materialPlusLabor)}</span>
                </div>

                <hr />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overhead</span>
                  <span>{formatCurrency(breakdown.overheadAmount)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Indirect Labor</span>
                  <span>{formatCurrency(breakdown.indirectLaborAmount)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(breakdown.subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Markup</span>
                  <span>{formatCurrency(breakdown.markupAmount)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>{formatCurrency(breakdown.shippingCost)}</span>
                </div>

                <hr />

                <div className="flex justify-between text-lg font-bold">
                  <span>Unit Price</span>
                  <span>{formatCurrency(breakdown.unitPrice)}</span>
                </div>

                {form.quantity > 1 && (
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Price</span>
                    <span>{formatCurrency(breakdown.totalPrice)}</span>
                  </div>
                )}
              </div>

              {breakdown.partNumber && (
                <div className="mt-4 p-2 bg-muted rounded text-sm">
                  <span className="text-muted-foreground">Part Number: </span>
                  <span className="font-mono">{breakdown.partNumber}</span>
                </div>
              )}

              <Button
                className="w-full mt-4"
                onClick={handleSaveQuote}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save as Quote
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
