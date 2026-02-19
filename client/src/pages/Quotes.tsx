import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { CushionQuote, Customer } from "@/types";
import {
  FileText,
  Loader2,
  Trash2,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

const STATUS_ORDER = ["draft", "quoted", "accepted", "invoiced"] as const;
type QuoteStatus = (typeof STATUS_ORDER)[number];

const STATUS_BADGE_VARIANT: Record<QuoteStatus, string> = {
  draft: "secondary",
  quoted: "default",
  accepted: "success",
  invoiced: "outline",
};

function getNextStatus(current: QuoteStatus): QuoteStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDimensions(l: number, w: number, h: number): string {
  return `${l} x ${w} x ${h}`;
}

export default function Quotes() {
  const [quotes, setQuotes] = useState<CushionQuote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");

  const fetchQuotes = useCallback(async () => {
    try {
      const data = await api.getQuotes();
      setQuotes(data);
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const [quotesData, customersData] = await Promise.all([
          api.getQuotes(),
          api.getCustomers(),
        ]);
        setQuotes(quotesData);
        setCustomers(customersData);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const filteredQuotes = quotes.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (customerFilter !== "all" && String(q.customerId) !== customerFilter)
      return false;
    return true;
  });

  const handleAdvanceStatus = async (quote: CushionQuote) => {
    const next = getNextStatus(quote.status as QuoteStatus);
    if (!next) return;
    try {
      await api.updateQuote(quote.id, { status: next });
      setQuotes((prev) =>
        prev.map((q) => (q.id === quote.id ? { ...q, status: next } : q))
      );
    } catch (error) {
      console.error("Failed to update quote status:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this quote?")) return;
    try {
      await api.deleteQuote(id);
      setQuotes((prev) => prev.filter((q) => q.id !== id));
    } catch (error) {
      console.error("Failed to delete quote:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading quotes...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Quotes
        </h1>
        <Button variant="outline" size="sm" onClick={fetchQuotes}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="quoted">Quoted</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Select value={customerFilter} onValueChange={setCustomerFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quotes Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredQuotes.length} Quote{filteredQuotes.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredQuotes.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No quotes found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Customer</th>
                    <th className="pb-2 pr-4 font-medium">Foam Grade</th>
                    <th className="pb-2 pr-4 font-medium">Dimensions</th>
                    <th className="pb-2 pr-4 font-medium text-right">Qty</th>
                    <th className="pb-2 pr-4 font-medium text-right">
                      Unit Price
                    </th>
                    <th className="pb-2 pr-4 font-medium text-right">
                      Total Price
                    </th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => {
                    const nextStatus = getNextStatus(
                      quote.status as QuoteStatus
                    );
                    return (
                      <tr
                        key={quote.id}
                        className="border-b last:border-b-0 hover:bg-muted/50"
                      >
                        <td className="py-3 pr-4">
                          {formatDate(quote.createdAt)}
                        </td>
                        <td className="py-3 pr-4">
                          {quote.customer?.name || "N/A"}
                        </td>
                        <td className="py-3 pr-4">{quote.foam?.grade || "N/A"}</td>
                        <td className="py-3 pr-4">
                          {formatDimensions(
                            quote.lengthIn,
                            quote.widthIn,
                            quote.heightIn
                          )}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {quote.quantity}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatCurrency(quote.unitPrice)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {formatCurrency(quote.totalPrice)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant={
                              STATUS_BADGE_VARIANT[
                                quote.status as QuoteStatus
                              ] as any
                            }
                          >
                            {quote.status}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {nextStatus && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAdvanceStatus(quote)}
                                title={`Advance to ${nextStatus}`}
                              >
                                <ChevronRight className="h-4 w-4" />
                                {nextStatus}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(quote.id)}
                              title="Delete quote"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
