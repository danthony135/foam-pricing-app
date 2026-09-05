import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import type { Foam } from "@/types";

interface FoamFormState {
  grade: string;
  density: string;
  ild: string;
  costPerBoardFoot: string;
  supplier: string;
  description: string;
  thicknessIn: string;
  sheetLengthIn: string;
  sheetWidthIn: string;
}

interface ImportPreviewRow {
  grade: string;
  density: number;
  ild: number;
  costPerBoardFoot: number;
  supplier: string;
  description: string;
}

const emptyForm: FoamFormState = {
  grade: "",
  density: "",
  ild: "",
  costPerBoardFoot: "",
  supplier: "",
  description: "",
  thicknessIn: "",
  sheetLengthIn: "82",
  sheetWidthIn: "36",
};

export default function FoamLibrary() {
  const [foams, setFoams] = useState<Foam[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add / Edit dialog state
  const [formDialogOpen, setFormDialogOpen] = useState<boolean>(false);
  const [editingFoamId, setEditingFoamId] = useState<number | null>(null);
  const [form, setForm] = useState<FoamFormState>(emptyForm);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBase64, setImportBase64] = useState<string>("");
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[] | null>(
    null
  );
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // ---- Data fetching ----

  async function fetchFoams() {
    try {
      const data = await api.getFoams();
      setFoams(data);
    } catch (error) {
      console.error("Failed to fetch foams:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFoams();
  }, []);

  // ---- Form helpers ----

  function handleFormChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function openAddDialog() {
    setEditingFoamId(null);
    setForm(emptyForm);
    setFormDialogOpen(true);
  }

  function openEditDialog(foam: Foam) {
    setEditingFoamId(foam.id);
    setForm({
      grade: foam.grade,
      density: String(foam.density),
      ild: String(foam.ild),
      costPerBoardFoot: String(foam.costPerBoardFoot),
      supplier: foam.supplier ?? "",
      description: foam.description ?? "",
      thicknessIn: foam.thicknessIn != null ? String(foam.thicknessIn) : "",
      sheetLengthIn: String(foam.sheetLengthIn ?? 82),
      sheetWidthIn: String(foam.sheetWidthIn ?? 36),
    });
    setFormDialogOpen(true);
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);

    const payload = {
      grade: form.grade,
      density: parseFloat(form.density),
      ild: parseFloat(form.ild),
      costPerBoardFoot: parseFloat(form.costPerBoardFoot),
      supplier: form.supplier,
      description: form.description,
      thicknessIn: form.thicknessIn ? parseFloat(form.thicknessIn) : null,
      sheetLengthIn: parseFloat(form.sheetLengthIn) || 82,
      sheetWidthIn: parseFloat(form.sheetWidthIn) || 36,
    };

    try {
      if (editingFoamId !== null) {
        await api.updateFoam(editingFoamId, payload);
      } else {
        await api.createFoam(payload);
      }
      setFormDialogOpen(false);
      setForm(emptyForm);
      setEditingFoamId(null);
      await fetchFoams();
    } catch (error) {
      console.error("Failed to save foam:", error);
    } finally {
      setFormSubmitting(false);
    }
  }

  // ---- Delete ----

  async function handleDelete(foam: Foam) {
    const confirmed = window.confirm(
      `Are you sure you want to delete foam grade "${foam.grade}"?`
    );
    if (!confirmed) return;

    try {
      await api.deleteFoam(foam.id);
      await fetchFoams();
    } catch (error) {
      console.error("Failed to delete foam:", error);
    }
  }

  // ---- Import helpers ----

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix to get raw base64
        const base64 = result.split(",")[1] ?? result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelected(file: File) {
    setImportFile(file);
    setImportPreview(null);
    try {
      const base64 = await readFileAsBase64(file);
      setImportBase64(base64);
    } catch (error) {
      console.error("Failed to read file:", error);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  }

  async function handlePreviewImport() {
    if (!importBase64) return;
    setImportLoading(true);
    try {
      const preview = await api.previewFoamImport(importBase64);
      setImportPreview(preview);
    } catch (error) {
      console.error("Failed to preview import:", error);
    } finally {
      setImportLoading(false);
    }
  }

  async function handleConfirmImport() {
    if (!importBase64) return;
    setImportLoading(true);
    try {
      await api.executeFoamImport(importBase64);
      setImportDialogOpen(false);
      resetImportState();
      await fetchFoams();
    } catch (error) {
      console.error("Failed to execute import:", error);
    } finally {
      setImportLoading(false);
    }
  }

  function resetImportState() {
    setImportFile(null);
    setImportBase64("");
    setImportPreview(null);
  }

  // ---- Render ----

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Foam Library</h1>
        <div className="flex gap-2">
          {/* Import Excel Button + Dialog */}
          <Dialog
            open={importDialogOpen}
            onOpenChange={(open) => {
              setImportDialogOpen(open);
              if (!open) resetImportState();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Import Foams from Excel</DialogTitle>
                <DialogDescription>
                  Upload an .xlsx file containing foam data. The file will be
                  previewed before importing.
                </DialogDescription>
              </DialogHeader>

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 bg-gray-50"
                }`}
              >
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
                <p className="mb-2 text-sm text-gray-600">
                  Drag and drop your .xlsx file here, or
                </p>
                <label className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:underline">
                    browse to select a file
                  </span>
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </label>
                {importFile && (
                  <p className="mt-3 text-sm text-gray-700">
                    Selected: <span className="font-medium">{importFile.name}</span>
                  </p>
                )}
              </div>

              {/* Preview button */}
              {importBase64 && !importPreview && (
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handlePreviewImport}
                    disabled={importLoading}
                  >
                    {importLoading ? "Loading preview..." : "Preview Import"}
                  </Button>
                </div>
              )}

              {/* Preview table */}
              {importPreview && importPreview.length > 0 && (
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    {importPreview.length} foam record(s) found:
                  </p>
                  <div className="max-h-64 overflow-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100">
                        <tr className="text-left">
                          <th className="px-3 py-2">Grade</th>
                          <th className="px-3 py-2">Density</th>
                          <th className="px-3 py-2">ILD</th>
                          <th className="px-3 py-2">Cost/BF</th>
                          <th className="px-3 py-2">Supplier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{row.grade}</td>
                            <td className="px-3 py-2">{row.density}</td>
                            <td className="px-3 py-2">{row.ild}</td>
                            <td className="px-3 py-2">
                              {formatCurrency(row.costPerBoardFoot)}
                            </td>
                            <td className="px-3 py-2">{row.supplier}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={handleConfirmImport}
                      disabled={importLoading}
                    >
                      {importLoading ? "Importing..." : "Confirm Import"}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Add Foam Button + Dialog */}
          <Dialog
            open={formDialogOpen}
            onOpenChange={(open) => {
              setFormDialogOpen(open);
              if (!open) {
                setForm(emptyForm);
                setEditingFoamId(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Foam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingFoamId !== null ? "Edit Foam" : "Add Foam"}
                </DialogTitle>
                <DialogDescription>
                  {editingFoamId !== null
                    ? "Update the foam details below."
                    : "Fill in the details to add a new foam to the library."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Input
                    id="grade"
                    name="grade"
                    value={form.grade}
                    onChange={handleFormChange}
                    placeholder="e.g. HR-3245"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="density">Density (lbs/ft³)</Label>
                    <Input
                      id="density"
                      name="density"
                      type="number"
                      step="0.01"
                      value={form.density}
                      onChange={handleFormChange}
                      placeholder="e.g. 1.8"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ild">ILD</Label>
                    <Input
                      id="ild"
                      name="ild"
                      type="number"
                      step="0.1"
                      value={form.ild}
                      onChange={handleFormChange}
                      placeholder="e.g. 36"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="costPerBoardFoot">Cost per Board Foot ($)</Label>
                  <Input
                    id="costPerBoardFoot"
                    name="costPerBoardFoot"
                    type="number"
                    step="0.01"
                    value={form.costPerBoardFoot}
                    onChange={handleFormChange}
                    placeholder="e.g. 0.45"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    name="supplier"
                    value={form.supplier}
                    onChange={handleFormChange}
                    placeholder="e.g. FoamCo Inc."
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="thicknessIn">Slab thickness (in)</Label>
                    <Input id="thicknessIn" name="thicknessIn" type="number" step="0.25" value={form.thicknessIn} onChange={handleFormChange} placeholder="5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sheetLengthIn">Slab length (in)</Label>
                    <Input id="sheetLengthIn" name="sheetLengthIn" type="number" step="1" value={form.sheetLengthIn} onChange={handleFormChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sheetWidthIn">Slab width (in)</Label>
                    <Input id="sheetWidthIn" name="sheetWidthIn" type="number" step="1" value={form.sheetWidthIn} onChange={handleFormChange} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    placeholder="Optional description"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFormDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formSubmitting}>
                    {formSubmitting
                      ? "Saving..."
                      : editingFoamId !== null
                        ? "Update Foam"
                        : "Add Foam"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Foam Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Foams</CardTitle>
        </CardHeader>
        <CardContent>
          {foams.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No foams in the library yet. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 pr-4">Grade</th>
                    <th className="pb-2 pr-4">Density</th>
                    <th className="pb-2 pr-4">ILD</th>
                    <th className="pb-2 pr-4">Cost/BF</th>
                    <th className="pb-2 pr-4">Supplier</th>
                    <th className="pb-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {foams.map((foam) => (
                    <tr key={foam.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{foam.grade}</td>
                      <td className="py-2 pr-4">{foam.density}</td>
                      <td className="py-2 pr-4">{foam.ild}</td>
                      <td className="py-2 pr-4">
                        {formatCurrency(foam.costPerBoardFoot)}
                      </td>
                      <td className="py-2 pr-4">{foam.supplier}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(foam)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(foam)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
