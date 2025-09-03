import { Canvas } from "fabric";
import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

const useSave = (canvas: Canvas | null, templateId: Id<"templates">) => {
  const saveTemplate = useMutation(api.templates.setOverlayTemplate);

  const save = () => {
    if (!canvas) return;
    const canvasJson = canvas.toJSON();
    canvasJson.objects.shift();
    saveTemplate({
      templateId,
      template: canvasJson,
    });
  };

  return { save };
};

export default useSave;
