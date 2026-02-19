import { useState, useEffect, useCallback } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Dacron } from "@/types";

interface DacronFormData {
  name: string;
  weightOz: number | string;
  thicknessInches: number | string;
  costPerSqFt: number | string;
  supplier: string;
  description: string;
}

const emptyForm: DacronFormData = {
  name: "",
  weightOz: "",
  thicknessInches: "",
  costPerSqFt: "",
  supplier: "",
  description: "",
};

export default function DacronLibrary() {
  const [dacrons, setDacrons] = useState<Dacron[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingDacron, setEditingDacron] = useState<Dacron | null>(null);
  const [deletingDacron, setDeletingDacron] = useState<Dacron | null>(null);
  const [formData, setFormData] = useState<DacronFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchDacrons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDacrons();
      setDacrons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dacrons");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDacrons();
  }, [fetchDacrons]);

  const openAddDialog = () => {
    setEditingDacron(null);
    setFormData(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (dacron: Dacron) => {
    setEditingDacron(dacron);
    setFormData({
      name: dacron.name,
      weightOz: dacron.weightOz,
      thicknessInches: dacron.thicknessInches,
      costPerSqFt: dacron.costPerSqFt,
      supplier: dacron.supplier ?? "",
      description: dacron.description ?? "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (dacron: Dacron) => {
    setDeletingDacron(dacron);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        name: formData.name,
        weightOz: Number(formData.weightOz),
        thicknessInches: Number(formData.thicknessInches),
        costPerSqFt: Number(formData.costPerSqFt),
        supplier: formData.supplier || undefined,
        description: formData.description || undefined,
      };

      if (editingDacron) {
        await api.updateDacron(editingDacron.id, payload);
      } else {
        await api.createDacron(payload);
      }

      setDialogOpen(false);
      await fetchDacrons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save dacron");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDacron) return;
    try {
      setSaving(true);
      await api.deleteDacron(deletingDacron.id);
      setDeleteDialogOpen(false);
      setDeletingDacron(null);
      await fetchDacrons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete dacron");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof DacronFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dacrons...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dacron Library</h1>
          <p className="text-muted-foreground">
            Manage dacron wraps used in foam pricing calculations.
          </p>
        </div>
        <Button onClick={openAddDialog}>Add Dacron</Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Dacrons</CardTitle>
          <CardDescription>
            {dacrons.length} dacron{dacrons.length !== 1 ? "s" : ""} in library
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dacrons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No dacrons found. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Name</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Weight (oz)
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Thickness (in)
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Cost/SqFt
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Supplier
                    </th>
                    <th className="text-right py-3 px-4 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dacrons.map((dacron) => (
                    <tr key={dacron.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">{dacron.name}</td>
                      <td className="py-3 px-4">{dacron.weightOz}</td>
                      <td className="py-3 px-4">{dacron.thicknessInches}</td>
                      <td className="py-3 px-4">
                        {formatCurrency(dacron.costPerSqFt)}
                      </td>
                      <td className="py-3 px-4">{dacron.supplier ?? "—"}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(dacron)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteDialog(dacron)}
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
              {editingDacron ? "Edit Dacron" : "Add Dacron"}
            </DialogTitle>
            <DialogDescription>
              {editingDacron
                ? "Update the dacron details below."
                : "Fill in the details for the new dacron."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g., 1oz Dacron Wrap"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weightOz">Weight (oz)</Label>
                <Input
                  id="weightOz"
                  type="number"
                  step="0.01"
                  value={formData.weightOz}
                  onChange={(e) => updateField("weightOz", e.target.value)}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thicknessInches">Thickness (in)</Label>
                <Input
                  id="thicknessInches"
                  type="number"
                  step="0.001"
                  value={formData.thicknessInches}
                  onChange={(e) =>
                    updateField("thicknessInches", e.target.value)
                  }
                  placeholder="0.25"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="costPerSqFt">Cost per SqFt ($)</Label>
              <Input
                id="costPerSqFt"
                type="number"
                step="0.01"
                value={formData.costPerSqFt}
                onChange={(e) => updateField("costPerSqFt", e.target.value)}
                placeholder="0.15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => updateField("supplier", e.target.value)}
                placeholder="Supplier name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="Optional description"
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
              {saving ? "Saving..." : editingDacron ? "Update" : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Dacron</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingDacron?.name}"? This
              action cannot be undone.
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
