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
import { api } from "@/lib/api";
import { OdooSettings } from "@/components/settings/OdooSettings";
import type { LaborSettings, OverheadSettings } from "@/types";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Labor settings
  const [laborSettings, setLaborSettings] = useState<LaborSettings | null>(
    null
  );
  const [laborForm, setLaborForm] = useState({
    defaultMakeTimeMin: "",
    avgHourlyRate: "",
  });
  const [laborSaving, setLaborSaving] = useState(false);
  const [laborSaved, setLaborSaved] = useState(false);

  // Overhead settings
  const [overheadSettings, setOverheadSettings] =
    useState<OverheadSettings | null>(null);
  const [overheadForm, setOverheadForm] = useState({
    facilityOverheadPercent: "",
    indirectLaborPercent: "",
  });
  const [overheadSaving, setOverheadSaving] = useState(false);
  const [overheadSaved, setOverheadSaved] = useState(false);

  // Markup settings (stored as part of overhead or separate)
  const [markupForm, setMarkupForm] = useState({
    defaultMarkupPercent: "",
  });
  const [markupSaving, setMarkupSaving] = useState(false);
  const [markupSaved, setMarkupSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [labor, overhead] = await Promise.all([
        api.getLaborSettings(),
        api.getOverheadSettings(),
      ]);

      setLaborSettings(labor);
      setLaborForm({
        defaultMakeTimeMin: String(labor.defaultMakeTimeMin ?? ""),
        avgHourlyRate: String(labor.avgHourlyRate ?? ""),
      });

      setOverheadSettings(overhead);
      setOverheadForm({
        facilityOverheadPercent: String(
          overhead.facilityOverheadPercent ?? ""
        ),
        indirectLaborPercent: String(overhead.indirectLaborPercent ?? ""),
      });

      setMarkupForm({
        defaultMarkupPercent: String(overhead.defaultMarkupPercent ?? ""),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load settings"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const showSavedFeedback = (
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleSaveLabor = async () => {
    try {
      setLaborSaving(true);
      setError(null);
      await api.updateLaborSettings({
        defaultMakeTimeMin: Number(laborForm.defaultMakeTimeMin),
        avgHourlyRate: Number(laborForm.avgHourlyRate),
      });
      showSavedFeedback(setLaborSaved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save labor settings"
      );
    } finally {
      setLaborSaving(false);
    }
  };

  const handleSaveOverhead = async () => {
    try {
      setOverheadSaving(true);
      setError(null);
      await api.updateOverheadSettings({
        facilityOverheadPercent: Number(overheadForm.facilityOverheadPercent),
        indirectLaborPercent: Number(overheadForm.indirectLaborPercent),
      });
      showSavedFeedback(setOverheadSaved);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save overhead settings"
      );
    } finally {
      setOverheadSaving(false);
    }
  };

  const handleSaveMarkup = async () => {
    try {
      setMarkupSaving(true);
      setError(null);
      await api.updateOverheadSettings({
        defaultMarkupPercent: Number(markupForm.defaultMarkupPercent),
      });
      showSavedFeedback(setMarkupSaved);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save markup settings"
      );
    } finally {
      setMarkupSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure global pricing parameters for labor, overhead, and markup.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Labor Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Labor Settings</CardTitle>
            <CardDescription>
              Configure default labor time and hourly rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultMakeTimeMin">
                Default Make Time (min)
              </Label>
              <Input
                id="defaultMakeTimeMin"
                type="number"
                step="0.1"
                value={laborForm.defaultMakeTimeMin}
                onChange={(e) =>
                  setLaborForm((prev) => ({
                    ...prev,
                    defaultMakeTimeMin: e.target.value,
                  }))
                }
                placeholder="15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avgHourlyRate">Avg Hourly Rate ($)</Label>
              <Input
                id="avgHourlyRate"
                type="number"
                step="0.01"
                value={laborForm.avgHourlyRate}
                onChange={(e) =>
                  setLaborForm((prev) => ({
                    ...prev,
                    avgHourlyRate: e.target.value,
                  }))
                }
                placeholder="25.00"
              />
            </div>
          </CardContent>
          <div className="flex items-center justify-between px-6 pb-6">
            <Button onClick={handleSaveLabor} disabled={laborSaving}>
              {laborSaving ? "Saving..." : "Save"}
            </Button>
            {laborSaved && (
              <span className="text-sm text-green-600 font-medium">
                Saved!
              </span>
            )}
          </div>
        </Card>

        {/* Overhead Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle>Overhead Settings</CardTitle>
            <CardDescription>
              Configure facility and indirect labor overhead percentages.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facilityOverheadPercent">
                Facility Overhead (%)
              </Label>
              <Input
                id="facilityOverheadPercent"
                type="number"
                step="0.1"
                value={overheadForm.facilityOverheadPercent}
                onChange={(e) =>
                  setOverheadForm((prev) => ({
                    ...prev,
                    facilityOverheadPercent: e.target.value,
                  }))
                }
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="indirectLaborPercent">
                Indirect Labor (%)
              </Label>
              <Input
                id="indirectLaborPercent"
                type="number"
                step="0.1"
                value={overheadForm.indirectLaborPercent}
                onChange={(e) =>
                  setOverheadForm((prev) => ({
                    ...prev,
                    indirectLaborPercent: e.target.value,
                  }))
                }
                placeholder="5"
              />
            </div>
          </CardContent>
          <div className="flex items-center justify-between px-6 pb-6">
            <Button onClick={handleSaveOverhead} disabled={overheadSaving}>
              {overheadSaving ? "Saving..." : "Save"}
            </Button>
            {overheadSaved && (
              <span className="text-sm text-green-600 font-medium">
                Saved!
              </span>
            )}
          </div>
        </Card>

        {/* Default Markup Card */}
        <Card>
          <CardHeader>
            <CardTitle>Default Markup</CardTitle>
            <CardDescription>
              Set the default markup percentage applied to all pricing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="defaultMarkupPercent">
                Default Markup (%)
              </Label>
              <Input
                id="defaultMarkupPercent"
                type="number"
                step="0.1"
                value={markupForm.defaultMarkupPercent}
                onChange={(e) =>
                  setMarkupForm((prev) => ({
                    ...prev,
                    defaultMarkupPercent: e.target.value,
                  }))
                }
                placeholder="30"
              />
            </div>
          </CardContent>
          <div className="flex items-center justify-between px-6 pb-6">
            <Button onClick={handleSaveMarkup} disabled={markupSaving}>
              {markupSaving ? "Saving..." : "Save"}
            </Button>
            {markupSaved && (
              <span className="text-sm text-green-600 font-medium">
                Saved!
              </span>
            )}
          </div>
        </Card>
      </div>
        <OdooSettings />
    </div>
  );
}
