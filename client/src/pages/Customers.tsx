import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { Customer } from "@/types";

interface CustomerFormData {
  name: string;
  code: string;
  shippingCostPerBF: number | string;
  markupPercent: number | string;
  notes: string;
}

const emptyForm: CustomerFormData = {
  name: "",
  code: "",
  shippingCostPerBF: "",
  markupPercent: "",
  notes: "",
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(
    null
  );
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(
    null
  );
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load customers"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const openAddDialog = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      code: customer.code,
      shippingCostPerBF: customer.shippingCostPerBF ?? "",
      markupPercent: customer.markupPercent ?? "",
      notes: customer.notes ?? "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    setDeletingCustomer(customer);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        name: formData.name,
        code: formData.code,
        shippingCostPerBF: formData.shippingCostPerBF
          ? Number(formData.shippingCostPerBF)
          : undefined,
        markupPercent: formData.markupPercent
          ? Number(formData.markupPercent)
          : undefined,
        notes: formData.notes || undefined,
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
      } else {
        await api.createCustomer(payload);
      }

      setDialogOpen(false);
      await fetchCustomers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save customer"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    try {
      setSaving(true);
      setError(null);
      await api.deleteCustomer(deletingCustomer.id);
      setDeleteDialogOpen(false);
      setDeletingCustomer(null);
      await fetchCustomers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete customer"
      );
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading customers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">
            Manage customer accounts and their pricing configurations.
          </p>
        </div>
        <Button onClick={openAddDialog}>Add Customer</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No customers found. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">Code</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Shipping $/BF
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Markup %
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">
                        <Link
                          to={`/customers/${customer.id}`}
                          className="text-primary hover:underline"
                        >
                          {customer.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4">{customer.code}</td>
                      <td className="py-3 px-4">
                        {customer.shippingCostPerBF != null
                          ? formatCurrency(customer.shippingCostPerBF)
                          : "—"}
                      </td>
                      <td className="py-3 px-4">
                        {customer.markupPercent != null
                          ? formatPercent(customer.markupPercent)
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(customer)}
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Update the customer details below."
                : "Fill in the details for the new customer."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Customer name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => updateField("code", e.target.value)}
                placeholder="e.g., ACME"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingCostPerBF">Shipping Cost ($/BF)</Label>
                <Input
                  id="shippingCostPerBF"
                  type="number"
                  step="0.01"
                  value={formData.shippingCostPerBF}
                  onChange={(e) =>
                    updateField("shippingCostPerBF", e.target.value)
                  }
                  placeholder="0.50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="markupPercent">Markup (%)</Label>
                <Input
                  id="markupPercent"
                  type="number"
                  step="0.1"
                  value={formData.markupPercent}
                  onChange={(e) =>
                    updateField("markupPercent", e.target.value)
                  }
                  placeholder="30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? "Saving..."
                : editingCustomer
                ? "Update"
                : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingCustomer?.name}"? This
              will also remove all associated pricing data. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
