"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
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
import { Check, RotateCcw, X, ArrowLeft } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";

// Utility function to clear localStorage if there are persistence issues
function clearPersistedSettings() {
  try {
    localStorage.removeItem("lifetracker-settings");
    console.log("Cleared persisted settings due to storage issues");
  } catch (e) {
    console.warn("Failed to clear localStorage:", e);
  }
}

// Custom hook to safely validate and update connected overlay
function useOverlayValidation() {
  const { connectedOverlayId, setConnectedOverlayId } = useLifeTrackerStore();
  const allOverlays = useQuery(api.overlays.getUserOverlays);

  useEffect(() => {
    if (allOverlays && connectedOverlayId) {
      const overlayExists = allOverlays.find(
        (overlay) => overlay._id === connectedOverlayId,
      );
      if (!overlayExists) {
        console.log("Connected overlay no longer exists, clearing connection");
        setConnectedOverlayId(null);
      }
    }
  }, [allOverlays, connectedOverlayId, setConnectedOverlayId]);

  return { allOverlays, connectedOverlayId, setConnectedOverlayId };
}

export default function AdminSettings() {
  const { allOverlays, connectedOverlayId, setConnectedOverlayId } =
    useOverlayValidation();
  const [selectedOverlay, setSelectedOverlay] = useState<string>(
    connectedOverlayId || "none",
  );
  const [showSuccess, setShowSuccess] = useState(false);

  const setShowAdminSettings = useLifeTrackerStore(
    (state) => state.setShowAdminSettings,
  );
  const resetBothPlayers = useLifeTrackerStore(
    (state) => state.resetBothPlayers,
  );

  // Mutation for resetting match
  const resetMatch = useMutation(api.overlays.resetMatch);

  // Fetch all overlays and filter for type "match"
  const matchOverlays =
    allOverlays?.filter((overlay) => overlay.overlayType === "match") || [];

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

  const handleMatchReset = () => {
    if (!connectedOverlayId) return;

    resetMatch({
      overlayId: connectedOverlayId as Id<"overlays">,
    });
    resetBothPlayers();
  };

  const handleClose = () => {
    setShowAdminSettings(false);
  };

  const handleGoToDashboard = () => {
    window.location.href = "/dashboard";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md relative">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>

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

          <Button
            onClick={clearPersistedSettings}
            variant="outline"
            className="w-full h-10 text-sm"
            size="sm"
          >
            Clear Stored Settings
          </Button>

          {/* Admin Actions Section */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Admin Actions
            </h3>
            <div className="space-y-2">
              <Button
                onClick={handleMatchReset}
                variant="destructive"
                className="w-full h-10"
                disabled={!connectedOverlayId}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Match
              </Button>

              <Button
                onClick={handleGoToDashboard}
                variant="outline"
                className="w-full h-10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
