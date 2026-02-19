import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Customer, Foam, CustomerFoamPricing, CushionQuote } from "@/types";

interface PricingOverrideForm {
  foamId: string;
  overrideCostPerBF: string;
  overrideMarkup: string;
}

const emptyPricingForm: PricingOverrideForm = {
  foamId: "",
  overrideCostPerBF: "",
  overrideMarkup: "",
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Info tab state
  const [infoForm, setInfoForm] = useState({
    name: "",
    code: "",
    shippingCostPerBF: "" as string | number,
    markupPercent: "" as string | number,
    notes: "",
  });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  // Pricing overrides tab state
  const [foams, setFoams] = useState<Foam[]>([]);
  const [foamsLoading, setFoamsLoading] = useState(false);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [pricingForm, setPricingForm] =
    useState<PricingOverrideForm>(emptyPricingForm);
  const [pricingSaving, setPricingSaving] = useState(false);

  // Part number template tab state
  const [templateValue, setTemplateValue] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCustomer(Number(id));
      setCustomer(data);

      setInfoForm({
        name: data.name,
        code: data.code,
        shippingCostPerBF: String(data.shippingCostPerBF ?? ""),
        markupPercent: String(data.markupPercent ?? ""),
        notes: data.notes ?? "",
      });

      setTemplateValue(
        data.partNumberTemplate?.template ?? "{customer_code}-{foam_grade}-{L}x{W}x{H}"
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load customer"
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchFoams = useCallback(async () => {
    try {
      setFoamsLoading(true);
      const data = await api.getFoams();
      setFoams(data);
    } catch (err) {
      // Silently handle - foams will just be empty in the dropdown
    } finally {
      setFoamsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  const showSavedFeedback = (
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // --- Info Tab Handlers ---

  const handleSaveInfo = async () => {
    if (!id) return;
    try {
      setInfoSaving(true);
      setError(null);
      await api.updateCustomer(Number(id), {
        name: infoForm.name,
        code: infoForm.code,
        shippingCostPerBF: infoForm.shippingCostPerBF
          ? Number(infoForm.shippingCostPerBF)
          : undefined,
        markupPercent: infoForm.markupPercent
          ? Number(infoForm.markupPercent)
          : undefined,
        notes: infoForm.notes || undefined,
      });
      showSavedFeedback(setInfoSaved);
      await fetchCustomer();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save customer info"
      );
    } finally {
      setInfoSaving(false);
    }
  };

  // --- Pricing Override Handlers ---

  const handleOpenPricingForm = () => {
    if (foams.length === 0) {
      fetchFoams();
    }
    setPricingForm(emptyPricingForm);
    setShowPricingForm(true);
  };

  const handleSavePricingOverride = async () => {
    if (!id || !pricingForm.foamId) return;
    try {
      setPricingSaving(true);
      setError(null);
      await api.upsertCustomerFoamPricing(Number(id), {
        foamId: Number(pricingForm.foamId),
        overrideCostPerBF: pricingForm.overrideCostPerBF
          ? Number(pricingForm.overrideCostPerBF)
          : undefined,
        overrideMarkup: pricingForm.overrideMarkup
          ? Number(pricingForm.overrideMarkup)
          : undefined,
      });
      setShowPricingForm(false);
      await fetchCustomer();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save pricing override"
      );
    } finally {
      setPricingSaving(false);
    }
  };

  const handleDeletePricingOverride = async (
    foamPricingId: number
  ) => {
    if (!id) return;
    try {
      setError(null);
      await api.deleteCustomerFoamPricing(Number(id), foamPricingId);
      await fetchCustomer();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete pricing override"
      );
    }
  };

  // --- Part Number Template Handlers ---

  const handleSaveTemplate = async () => {
    if (!id) return;
    try {
      setTemplateSaving(true);
      setError(null);
      await api.updatePartTemplate(Number(id), templateValue);
      showSavedFeedback(setTemplateSaved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save template"
      );
    } finally {
      setTemplateSaving(false);
    }
  };

  const generateTemplatePreview = (template: string): string => {
    if (!template) return "";
    const sampleValues: Record<string, string> = {
      "{customer_code}": customer?.code ?? "ACME",
      "{foam_grade}": "HR-2130",
      "{L}": "24",
      "{W}": "24",
      "{H}": "4",
      "{density}": "2.1",
      "{dacron}": "Standard 6oz",
      "{quantity}": "10",
    };

    let preview = template;
    for (const [placeholder, value] of Object.entries(sampleValues)) {
      preview = preview.replaceAll(placeholder, value);
    }
    return preview;
  };

  // --- Status Badge Helper ---

  const getStatusVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
      case "accepted":
      case "approved":
        return "default";
      case "pending":
      case "draft":
        return "secondary";
      case "rejected":
      case "expired":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading customer details...</p>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-destructive/15 p-4 text-destructive text-sm">
          {error}
        </div>
        <Button variant="outline" asChild>
          <Link to="/customers">Back to Customers</Link>
        </Button>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Customer not found.</p>
        <Button variant="outline" asChild>
          <Link to="/customers">Back to Customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link to="/customers" className="hover:underline">
              Customers
            </Link>
            <span>/</span>
            <span>{customer.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {customer.name}
          </h1>
          <p className="text-muted-foreground">Code: {customer.code}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="pricing">Pricing Overrides</TabsTrigger>
          <TabsTrigger value="template">Part Number Template</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>
                Edit the customer's basic information and pricing defaults.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="info-name">Name</Label>
                  <Input
                    id="info-name"
                    value={infoForm.name}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="info-code">Code</Label>
                  <Input
                    id="info-code"
                    value={infoForm.code}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        code: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="info-shipping">
                    Shipping Cost ($/BF)
                  </Label>
                  <Input
                    id="info-shipping"
                    type="number"
                    step="0.01"
                    value={infoForm.shippingCostPerBF}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        shippingCostPerBF: e.target.value,
                      }))
                    }
                    placeholder="0.50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="info-markup">Markup (%)</Label>
                  <Input
                    id="info-markup"
                    type="number"
                    step="0.1"
                    value={infoForm.markupPercent}
                    onChange={(e) =>
                      setInfoForm((prev) => ({
                        ...prev,
                        markupPercent: e.target.value,
                      }))
                    }
                    placeholder="30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="info-notes">Notes</Label>
                <Input
                  id="info-notes"
                  value={infoForm.notes}
                  onChange={(e) =>
                    setInfoForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Optional notes about this customer"
                />
              </div>
              <div className="flex items-center gap-4 pt-2">
                <Button onClick={handleSaveInfo} disabled={infoSaving}>
                  {infoSaving ? "Saving..." : "Save"}
                </Button>
                {infoSaved && (
                  <span className="text-sm text-green-600 font-medium">
                    Saved!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Overrides Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Foam Pricing Overrides</CardTitle>
                <CardDescription>
                  Override default pricing for specific foam grades for this
                  customer.
                </CardDescription>
              </div>
              <Button onClick={handleOpenPricingForm}>Add Override</Button>
            </CardHeader>
            <CardContent>
              {showPricingForm && (
                <div className="mb-6 p-4 border rounded-lg space-y-4 bg-muted/50">
                  <h4 className="font-medium">New Pricing Override</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="override-foam">Foam Grade</Label>
                      <Select
                        value={String(pricingForm.foamId)}
                        onValueChange={(value) =>
                          setPricingForm((prev) => ({
                            ...prev,
                            foamId: value,
                          }))
                        }
                      >
                        <SelectTrigger id="override-foam">
                          <SelectValue
                            placeholder={
                              foamsLoading
                                ? "Loading foams..."
                                : "Select a foam"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {foams.map((foam) => (
                            <SelectItem
                              key={foam.id}
                              value={String(foam.id)}
                            >
                              {foam.grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-cost">
                        Override Cost ($/BF)
                      </Label>
                      <Input
                        id="override-cost"
                        type="number"
                        step="0.01"
                        value={pricingForm.overrideCostPerBF}
                        onChange={(e) =>
                          setPricingForm((prev) => ({
                            ...prev,
                            overrideCostPerBF: e.target.value,
                          }))
                        }
                        placeholder="Leave blank to use default"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="override-markup">
                        Override Markup (%)
                      </Label>
                      <Input
                        id="override-markup"
                        type="number"
                        step="0.1"
                        value={pricingForm.overrideMarkup}
                        onChange={(e) =>
                          setPricingForm((prev) => ({
                            ...prev,
                            overrideMarkup: e.target.value,
                          }))
                        }
                        placeholder="Leave blank to use default"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSavePricingOverride}
                      disabled={pricingSaving}
                    >
                      {pricingSaving ? "Saving..." : "Save Override"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowPricingForm(false)}
                      disabled={pricingSaving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!customer.foamPricing || customer.foamPricing.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No pricing overrides configured. Click "Add Override" to
                  create one.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">
                          Foam Grade
                        </th>
                        <th className="text-left py-3 px-4 font-medium">
                          Override Cost/BF
                        </th>
                        <th className="text-left py-3 px-4 font-medium">
                          Override Markup
                        </th>
                        <th className="text-right py-3 px-4 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.foamPricing?.map((pricing) => (
                        <tr
                          key={pricing.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-3 px-4 font-medium">
                            {pricing.foam?.grade ?? `Foam #${pricing.foamId}`}
                          </td>
                          <td className="py-3 px-4">
                            {pricing.overrideCostPerBF != null
                              ? formatCurrency(pricing.overrideCostPerBF)
                              : "—"}
                          </td>
                          <td className="py-3 px-4">
                            {pricing.overrideMarkup != null
                              ? formatPercent(
                                  pricing.overrideMarkup
                                )
                              : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleDeletePricingOverride(pricing.id)
                              }
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Part Number Template Tab */}
        <TabsContent value="template">
          <Card>
            <CardHeader>
              <CardTitle>Part Number Template</CardTitle>
              <CardDescription>
                Define a template for generating part numbers. Use placeholders
                like {"{customerCode}"}, {"{foamGrade}"}, {"{dimensions}"},
                {" "}{"{date}"}, {"{seq}"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-input">Template String</Label>
                <Input
                  id="template-input"
                  value={templateValue}
                  onChange={(e) => setTemplateValue(e.target.value)}
                  placeholder="{customerCode}-{foamGrade}-{dimensions}"
                  className="font-mono"
                />
              </div>

              {templateValue && (
                <div className="space-y-2">
                  <Label>Live Preview</Label>
                  <div className="p-3 rounded-md border bg-muted font-mono text-sm">
                    {generateTemplatePreview(templateValue)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sample values: customerCode="{customer.code}",
                    foamGrade="HR-2130", dimensions="24x24x4",
                    date="20260219", seq="001"
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 pt-2">
                <Button
                  onClick={handleSaveTemplate}
                  disabled={templateSaving}
                >
                  {templateSaving ? "Saving..." : "Save"}
                </Button>
                {templateSaved && (
                  <span className="text-sm text-green-600 font-medium">
                    Saved!
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quotes Tab */}
        <TabsContent value="quotes">
          <Card>
            <CardHeader>
              <CardTitle>Recent Quotes</CardTitle>
              <CardDescription>
                Quotes generated for this customer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!customer.quotes || customer.quotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No quotes found for this customer.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-medium">
                          Date
                        </th>
                        <th className="text-left py-3 px-4 font-medium">
                          Foam
                        </th>
                        <th className="text-left py-3 px-4 font-medium">
                          Dimensions
                        </th>
                        <th className="text-left py-3 px-4 font-medium">
                          Unit Price
                        </th>
                        <th className="text-left py-3 px-4 font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customer.quotes.map((quote) => (
                        <tr
                          key={quote.id}
                          className="border-b last:border-0"
                        >
                          <td className="py-3 px-4">
                            {new Date(quote.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">{quote.foam?.grade || `Foam #${quote.foamId}`}</td>
                          <td className="py-3 px-4 font-mono">
                            {quote.lengthIn}x{quote.widthIn}x{quote.heightIn}
                          </td>
                          <td className="py-3 px-4">
                            {formatCurrency(quote.unitPrice)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={getStatusVariant(quote.status)}>
                              {quote.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
