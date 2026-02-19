import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Box, Users, FileText, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface Foam {
  id: number;
  grade: string;
  density: number;
  ild: number;
  costPerBoardFoot: number;
  supplier: string;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

interface Customer {
  id: number;
  name: string;
}

interface Quote {
  id: number;
  date: string;
  customerName: string;
  foamGrade: string;
  length: number;
  width: number;
  height: number;
  unitPrice: number;
  status: "draft" | "sent" | "accepted" | "rejected";
}

export default function Dashboard() {
  const [foams, setFoams] = useState<Foam[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<Foam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [foamsData, customersData, quotesData, lowStockData] =
          await Promise.all([
            api.getFoams(),
            api.getCustomers(),
            api.getQuotes(),
            api.getFoamLowStock(),
          ]);
        setFoams(foamsData);
        setCustomers(customersData);
        setQuotes(quotesData);
        setLowStockAlerts(lowStockData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  const recentQuotes = quotes.slice(0, 5);

  const statusColor: Record<string, string> = {
    draft: "bg-gray-200 text-gray-800",
    sent: "bg-blue-200 text-blue-800",
    accepted: "bg-green-200 text-green-800",
    rejected: "bg-red-200 text-red-800",
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Foams
            </CardTitle>
            <Box className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{foams.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Customers
            </CardTitle>
            <Users className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Recent Quotes
            </CardTitle>
            <FileText className="h-5 w-5 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quotes.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {lowStockAlerts.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Quotes Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Quotes</CardTitle>
          <Link
            to="/quotes"
            className="text-sm text-blue-600 hover:underline"
          >
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recentQuotes.length === 0 ? (
            <p className="text-gray-500 text-sm">No quotes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Customer</th>
                    <th className="pb-2 pr-4">Foam Grade</th>
                    <th className="pb-2 pr-4">Dimensions</th>
                    <th className="pb-2 pr-4">Unit Price</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentQuotes.map((quote) => (
                    <tr key={quote.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {new Date(quote.date).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4">{quote.customerName}</td>
                      <td className="py-2 pr-4">{quote.foamGrade}</td>
                      <td className="py-2 pr-4">
                        {quote.length}" x {quote.width}" x {quote.height}"
                      </td>
                      <td className="py-2 pr-4">
                        {formatCurrency(quote.unitPrice)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            statusColor[quote.status] ?? "bg-gray-200 text-gray-800"
                          }`}
                        >
                          {quote.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Stock Alerts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStockAlerts.length === 0 ? (
            <p className="text-gray-500 text-sm">
              All foam stock levels are healthy.
            </p>
          ) : (
            <ul className="space-y-2">
              {lowStockAlerts.map((foam) => (
                <li
                  key={foam.id}
                  className="flex items-center justify-between rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium">{foam.grade}</span>
                    <span className="text-gray-500 text-sm">
                      — {foam.supplier}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Stock: {foam.stockQuantity ?? 0} / Threshold:{" "}
                    {foam.lowStockThreshold ?? 0}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
