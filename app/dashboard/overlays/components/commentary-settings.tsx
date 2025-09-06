import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentaryOverlay, TemplateType } from "@/convex/types";
import { useState } from "react";

interface CommentarySettingsProps {
  overlay: CommentaryOverlay;
}

export default function CommentarySettings({
  overlay,
}: CommentarySettingsProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>(
    overlay.template as TemplateType,
  );

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Template</label>
      <Select
        value={selectedTemplate}
        onValueChange={(value: TemplateType) => setSelectedTemplate(value)}
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
    </div>
  );
}
