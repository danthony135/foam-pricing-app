import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type {
  Foam,
  Dacron,
  FoamInventory,
  DacronInventory,
} from "@/types";
import { Package, Loader2, Plus, Pencil } from "lucide-react";

// ---------- Foam Inventory Tab ----------

function FoamInventoryTab() {
  const [inventory, setInventory] = useState<FoamInventory[]>([]);
  const [foams, setFoams] = useState<Foam[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoamInventory | null>(null);
  const [dialogFoamId, setDialogFoamId] = useState("");
  const [dialogBoardFeet, setDialogBoardFeet] = useState(0);
  const [dialogThreshold, setDialogThreshold] = useState(0);
  const [dialogSaving, setDialogSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [invData, foamData] = await Promise.all([
          api.getFoamInventory(),
          api.getFoams(),
        ]);
        setInventory(invData);
        setFoams(foamData);
      } catch (error) {
        console.error("Failed to fetch foam inventory:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const openAddDialog = () => {
    setEditingItem(null);
    setDialogFoamId("");
    setDialogBoardFeet(0);
    setDialogThreshold(0);
    setDialogOpen(true);
  };

  const openUpdateDialog = (item: FoamInventory) => {
    setEditingItem(item);
    setDialogFoamId(String(item.foamId));
    setDialogBoardFeet(item.boardFeetOnHand);
    setDialogThreshold(item.lowStockThreshold);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setDialogSaving(true);
    try {
      if (editingItem) {
        const updated = await api.upsertFoamInventory({
          foamId: editingItem.foamId,
          boardFeetOnHand: dialogBoardFeet,
          lowStockThreshold: dialogThreshold,
        });
        setInventory((prev) =>
          prev.map((i) => (i.id === editingItem.id ? updated : i))
        );
      } else {
        const created = await api.upsertFoamInventory({
          foamId: Number(dialogFoamId),
          boardFeetOnHand: dialogBoardFeet,
          lowStockThreshold: dialogThreshold,
        });
        setInventory((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to save foam inventory:", error);
    } finally {
      setDialogSaving(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading foam inventory...</span>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Inventory
        </Button>
      </div>

      {inventory.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No foam inventory records found.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium">Foam Grade</th>
                <th className="pb-2 pr-4 font-medium text-right">
                  Board Feet On Hand
                </th>
                <th className="pb-2 pr-4 font-medium text-right">
                  Low Stock Threshold
                </th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Last Updated</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const isLow =
                  item.boardFeetOnHand <= item.lowStockThreshold;
                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <td className="py-3 pr-4">{item.foam?.grade}</td>
                    <td className="py-3 pr-4 text-right">
                      {item.boardFeetOnHand}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {item.lowStockThreshold}
                    </td>
                    <td className="py-3 pr-4">
                      {isLow ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {formatDate(item.lastUpdated)}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openUpdateDialog(item)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Update Stock
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Update Foam Stock" : "Add Foam Inventory"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingItem && (
              <div className="space-y-2">
                <Label htmlFor="foam-select">Foam</Label>
                <Select value={dialogFoamId} onValueChange={setDialogFoamId}>
                  <SelectTrigger id="foam-select">
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
            )}
            <div className="space-y-2">
              <Label htmlFor="board-feet">Board Feet On Hand</Label>
              <Input
                id="board-feet"
                type="number"
                min={0}
                step="any"
                value={dialogBoardFeet || ""}
                onChange={(e) =>
                  setDialogBoardFeet(
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Threshold</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                step="any"
                value={dialogThreshold || ""}
                onChange={(e) =>
                  setDialogThreshold(
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={dialogSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                dialogSaving || (!editingItem && !dialogFoamId)
              }
            >
              {dialogSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Dacron Inventory Tab ----------

function DacronInventoryTab() {
  const [inventory, setInventory] = useState<DacronInventory[]>([]);
  const [dacrons, setDacrons] = useState<Dacron[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DacronInventory | null>(null);
  const [dialogDacronId, setDialogDacronId] = useState("");
  const [dialogSqFt, setDialogSqFt] = useState(0);
  const [dialogRolls, setDialogRolls] = useState(0);
  const [dialogThreshold, setDialogThreshold] = useState(0);
  const [dialogSaving, setDialogSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [invData, dacronData] = await Promise.all([
          api.getDacronInventory(),
          api.getDacrons(),
        ]);
        setInventory(invData);
        setDacrons(dacronData);
      } catch (error) {
        console.error("Failed to fetch dacron inventory:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const openAddDialog = () => {
    setEditingItem(null);
    setDialogDacronId("");
    setDialogSqFt(0);
    setDialogRolls(0);
    setDialogThreshold(0);
    setDialogOpen(true);
  };

  const openUpdateDialog = (item: DacronInventory) => {
    setEditingItem(item);
    setDialogDacronId(String(item.dacronId));
    setDialogSqFt(item.sqFtOnHand);
    setDialogRolls(item.rollsOnHand);
    setDialogThreshold(item.lowStockThreshold);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setDialogSaving(true);
    try {
      if (editingItem) {
        const updated = await api.upsertDacronInventory({
          dacronId: editingItem.dacronId,
          sqFtOnHand: dialogSqFt,
          rollsOnHand: dialogRolls,
          lowStockThreshold: dialogThreshold,
        });
        setInventory((prev) =>
          prev.map((i) => (i.id === editingItem.id ? updated : i))
        );
      } else {
        const created = await api.upsertDacronInventory({
          dacronId: Number(dialogDacronId),
          sqFtOnHand: dialogSqFt,
          rollsOnHand: dialogRolls,
          lowStockThreshold: dialogThreshold,
        });
        setInventory((prev) => [...prev, created]);
      }
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to save dacron inventory:", error);
    } finally {
      setDialogSaving(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">
          Loading dacron inventory...
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Inventory
        </Button>
      </div>

      {inventory.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No dacron inventory records found.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-2 pr-4 font-medium">Dacron Name</th>
                <th className="pb-2 pr-4 font-medium text-right">
                  SqFt On Hand
                </th>
                <th className="pb-2 pr-4 font-medium text-right">
                  Rolls On Hand
                </th>
                <th className="pb-2 pr-4 font-medium text-right">
                  Low Stock Threshold
                </th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Last Updated</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => {
                const isLow =
                  item.sqFtOnHand <= item.lowStockThreshold;
                return (
                  <tr
                    key={item.id}
                    className="border-b last:border-b-0 hover:bg-muted/50"
                  >
                    <td className="py-3 pr-4">{item.dacron?.name}</td>
                    <td className="py-3 pr-4 text-right">
                      {item.sqFtOnHand}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {item.rollsOnHand}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {item.lowStockThreshold}
                    </td>
                    <td className="py-3 pr-4">
                      {isLow ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {formatDate(item.lastUpdated)}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openUpdateDialog(item)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Update Stock
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Update Dacron Stock" : "Add Dacron Inventory"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editingItem && (
              <div className="space-y-2">
                <Label htmlFor="dacron-select">Dacron</Label>
                <Select
                  value={dialogDacronId}
                  onValueChange={setDialogDacronId}
                >
                  <SelectTrigger id="dacron-select">
                    <SelectValue placeholder="Select dacron..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dacrons.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="sqft-on-hand">SqFt On Hand</Label>
              <Input
                id="sqft-on-hand"
                type="number"
                min={0}
                step="any"
                value={dialogSqFt || ""}
                onChange={(e) =>
                  setDialogSqFt(
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rolls-on-hand">Rolls On Hand</Label>
              <Input
                id="rolls-on-hand"
                type="number"
                min={0}
                step={1}
                value={dialogRolls || ""}
                onChange={(e) =>
                  setDialogRolls(
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dacron-threshold">Low Stock Threshold</Label>
              <Input
                id="dacron-threshold"
                type="number"
                min={0}
                step="any"
                value={dialogThreshold || ""}
                onChange={(e) =>
                  setDialogThreshold(
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={dialogSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                dialogSaving || (!editingItem && !dialogDacronId)
              }
            >
              {dialogSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Main Inventory Page ----------

export default function Inventory() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Package className="h-6 w-6" />
        Inventory
      </h1>

      <Tabs defaultValue="foam">
        <TabsList>
          <TabsTrigger value="foam">Foam Inventory</TabsTrigger>
          <TabsTrigger value="dacron">Dacron Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="foam">
          <Card>
            <CardHeader>
              <CardTitle>Foam Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <FoamInventoryTab />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dacron">
          <Card>
            <CardHeader>
              <CardTitle>Dacron Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <DacronInventoryTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
