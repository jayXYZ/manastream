import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MatchOverlay } from "@/convex/types";
import { useEffect, useState, useRef } from "react";
import {
  DialogTitle,
  DialogHeader,
  DialogFooter,
} from "@/components/ui/dialog";
import { SquarePen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface MatchSettingsProps {
  overlay: MatchOverlay;
  onOpenChange: (open: boolean) => void;
}

export default function MatchSettings({
  overlay,
  onOpenChange,
}: MatchSettingsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MatchOverlay["template"]>(
    overlay.template,
  );
  const [editingName, setEditingName] = useState(false);
  const [overlayName, setOverlayName] = useState(overlay.name);
  const [isChanges, setIsChanges] = useState(false);
  const [nameError, setNameError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setMatchOverlaySettings = useMutation(
    api.overlays.setMatchOverlaySettings,
  );

  const deleteOverlayMutation = useMutation(api.overlays.deleteOverlay);

  const handleSave = () => {
    // Validate overlay name
    if (!overlayName.trim()) {
      setNameError("Overlay name is required");
      return;
    }

    setNameError("");
    setMatchOverlaySettings({
      overlayId: overlay._id as Id<"overlays">,
      name: overlayName.trim(),
      template: selectedTemplate,
    });
    setIsChanges(false);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!isDeleting) {
      setIsDeleting(true);
      return;
    }
    deleteOverlayMutation({
      overlayId: overlay._id as Id<"overlays">,
    });
    onOpenChange(false);
  };

  useEffect(() => {
    if (overlayName !== overlay.name || selectedTemplate !== overlay.template) {
      setIsChanges(true);
    } else {
      setIsChanges(false);
    }
  }, [overlayName, overlay.name, selectedTemplate, overlay.template]);

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  // Clear error when user starts typing
  useEffect(() => {
    if (nameError && overlayName.trim()) {
      setNameError("");
    }
  }, [overlayName, nameError]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editingName ? (
            <Input
              ref={inputRef}
              value={overlayName}
              onChange={(e) => setOverlayName(e.target.value)}
              onBlur={() => setEditingName(false)}
              className={`w-[80%] ${nameError ? "border-red-500" : ""}`}
            />
          ) : (
            <span className="group flex items-center gap-2">
              {overlayName}
              <SquarePen
                className="size-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => setEditingName(true)}
              />
            </span>
          )}
        </DialogTitle>
      </DialogHeader>
      {nameError && (
        <div className="text-red-500 text-sm font-medium">{nameError}</div>
      )}
      <div className="space-y-2">
        <label className="text-sm font-medium">Template</label>
        <Select
          value={selectedTemplate}
          onValueChange={(value) =>
            setSelectedTemplate(value as MatchOverlay["template"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select template" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem disabled value="Default">
              Default
            </SelectItem>
            <SelectItem value="Duress Crew">Duress Crew</SelectItem>
            <SelectItem value="Lobstercon">Lobstercon</SelectItem>
            <SelectItem disabled value="Custom">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
        <br />
      </div>
      <DialogFooter className="sm:justify-between">
        <Button size="sm" variant="destructive" onClick={() => handleDelete()}>
          {isDeleting ? "Are you sure?" : "Delete Overlay"}
        </Button>
        <Button onClick={() => handleSave()} disabled={!isChanges}>
          Save Changes
        </Button>
      </DialogFooter>
    </>
  );
}
