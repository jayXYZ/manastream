import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentaryOverlay } from "@/convex/types";
import { useEffect, useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SquarePen } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CommentarySettingsProps {
  overlay: CommentaryOverlay;
  onOpenChange: (open: boolean) => void;
}

export default function CommentarySettings({
  overlay,
  onOpenChange,
}: CommentarySettingsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<
    CommentaryOverlay["template"]
  >(
    overlay.template,
  );
  const [editingName, setEditingName] = useState(false);
  const [overlayName, setOverlayName] = useState(overlay.name);
  const [nameError, setNameError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isChanges =
    overlayName !== overlay.name || selectedTemplate !== overlay.template;

  const setCommentaryOverlaySettings = useMutation(
    api.overlays.setCommentaryOverlaySettings,
  );

  const deleteOverlayMutation = useMutation(api.overlays.deleteOverlay);

  const handleSave = () => {
    // Validate overlay name
    if (!overlayName.trim()) {
      setNameError("Overlay name is required");
      return;
    }

    setNameError("");
    setCommentaryOverlaySettings({
      overlayId: overlay._id as Id<"overlays">,
      name: overlayName.trim(),
      template: selectedTemplate,
    });
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
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  const handleNameChange = (value: string) => {
    setOverlayName(value);
    if (nameError && value.trim()) {
      setNameError("");
    }
  };

  return (
    <>
      <>
        <DialogHeader>
          <DialogTitle>
            {editingName ? (
              <Input
                ref={inputRef}
                value={overlayName}
                onChange={(e) => handleNameChange(e.target.value)}
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
              setSelectedTemplate(value as CommentaryOverlay["template"])
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
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDelete()}
          >
            {isDeleting ? "Are you sure?" : "Delete Overlay"}
          </Button>
          <Button onClick={() => handleSave()} disabled={!isChanges}>
            Save Changes
          </Button>
        </DialogFooter>
      </>
    </>
  );
}
