"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useLifeTrackerStore } from "./store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check } from "lucide-react";

export default function AdminSettings() {
  const { connectedOverlayId, setConnectedOverlayId } = useLifeTrackerStore();
  const [selectedOverlay, setSelectedOverlay] = useState<string>(
    connectedOverlayId || "none",
  );
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch all overlays and filter for type "match"
  const allOverlays = useQuery(api.overlays.getUserOverlays);
  const matchOverlays =
    allOverlays?.filter((overlay) => overlay.type === "match") || [];

  // Update selected value when store changes
  useEffect(() => {
    setSelectedOverlay(connectedOverlayId || "none");
  }, [connectedOverlayId]);

  // Hide success message after 3 seconds
  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess]);

  const hasChanges = selectedOverlay !== (connectedOverlayId || "none");

  const handleSave = () => {
    setConnectedOverlayId(selectedOverlay === "none" ? null : selectedOverlay);
    setShowSuccess(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Admin Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Label
              htmlFor="overlay-select"
              className="text-base font-medium whitespace-nowrap"
            >
              Connected Overlay:
            </Label>
            <Select value={selectedOverlay} onValueChange={setSelectedOverlay}>
              <SelectTrigger
                id="overlay-select"
                className="h-12 text-base flex-1"
              >
                <SelectValue placeholder="Choose an overlay..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {matchOverlays.map((overlay) => (
                  <SelectItem key={overlay._id} value={overlay._id}>
                    {overlay.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showSuccess && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 rounded-md border border-green-200 dark:border-green-800">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">
                Settings updated successfully!
              </span>
            </div>
          )}

          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
