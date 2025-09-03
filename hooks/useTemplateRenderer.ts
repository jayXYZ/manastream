import { Canvas } from "fabric";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import useVariablesData from "./useVariablesData";
import { useCallback, useRef, useState, useEffect } from "react";
import { processTextWithVariables } from "@/app/dashboard/editor/templateUtils2";

// Helper function to check if text has variables
function hasVariables(text: string) {
  return /\{\{\w+\}\}/.test(text);
}

const useTemplateRenderer = (canvas: Canvas | null, publicUuid: string) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const currentTemplateRef = useRef<any>(null);
  const textObjectMapRef = useRef(new Map());

  const overlay = useQuery(api.overlays.getOverlayByUuid, {
    publicUuid,
  });

  const template = useQuery(
    api.templates.getTemplateById,
    overlay && overlay.overlayType === "match" && overlay.templateId
      ? {
          templateId: overlay.templateId as Id<"templates">,
        }
      : "skip",
  );

  const variablesData = useVariablesData(overlay?._id as Id<"overlays">);

  // Process template JSON
  const processTemplateJson = useCallback(
    (templateJson: any, variableData: any) => {
      if (!templateJson?.objects) return templateJson;

      const processed = { ...templateJson };
      processed.objects = templateJson.objects.map((obj: any) => {
        if (
          (obj.type === "i-text" ||
            obj.type === "text" ||
            obj.type === "IText") &&
          hasVariables(obj.text)
        ) {
          // Convert Fabric.js styles format to the format expected by processTextWithVariables
          const styles = obj.styles
            ? Object.entries(obj.styles).map(
                ([index, style]: [string, any]) => ({
                  start: parseInt(index),
                  end: parseInt(index) + 1,
                  style: style,
                }),
              )
            : [];

          const processed = processTextWithVariables(
            obj.text,
            styles,
            Object.fromEntries(
              Object.entries(variableData).map(([k, v]) => [k, String(v)]),
            ),
          );

          return {
            ...obj,
            text: processed.text,
            styles: processed.styles.reduce((acc: any, style: any) => {
              for (let i = style.start; i < style.end; i++) {
                acc[i] = style.style;
              }
              return acc;
            }, {}),
          };
        }
        return obj;
      });

      return processed;
    },
    [],
  );

  // Build object map for selective updates
  const buildObjectMap = useCallback((templateJson: any, canvas: Canvas) => {
    textObjectMapRef.current.clear();

    const templateObjects = templateJson.objects;
    const canvasObjects = canvas.getObjects();

    templateObjects.forEach((templateObj: any, index: number) => {
      if (
        (templateObj.type === "i-text" ||
          templateObj.type === "text" ||
          templateObj.type === "IText") &&
        hasVariables(templateObj.text)
      ) {
        textObjectMapRef.current.set(templateObj, canvasObjects[index]);
      }
    });
  }, []);

  // Initial template load
  useEffect(() => {
    if (!canvas || !overlay || overlay.overlayType !== "match" || !template)
      return;
    setIsLoading(true);
    setError(null);
    if (currentTemplateRef.current === null) {
      try {
        const processedJson = processTemplateJson(
          template?.template,
          variablesData,
        );
        canvas.loadFromJSON(processedJson).then((canvas) => {
          buildObjectMap(template?.template, canvas);
          canvas.requestRenderAll();
        });

        currentTemplateRef.current = template.template;
        setIsLoading(false);
      } catch (err) {
        setError(err as Error);
        setIsLoading(false);
      }
    }
  }, [overlay, canvas, processTemplateJson, template]);

  // Handle variable updates
  useEffect(() => {
    if (!variablesData || !canvas || !currentTemplateRef.current) return;

    // Update only text objects with variables
    textObjectMapRef.current.forEach((canvasObj, templateObj) => {
      if (!canvasObj) return;

      // Convert Fabric.js styles format to the format expected by processTextWithVariables
      const styles = templateObj.styles
        ? Object.entries(templateObj.styles).map(
            ([index, style]: [string, any]) => ({
              start: parseInt(index),
              end: parseInt(index) + 1,
              style: style,
            }),
          )
        : [];

      const processed = processTextWithVariables(
        templateObj.text,
        styles,
        Object.fromEntries(
          Object.entries(variablesData).map(([k, v]) => [k, String(v)]),
        ),
      );

      // Convert back to Fabric.js styles format
      const fabricStyles = processed.styles.reduce((acc: any, style: any) => {
        for (let i = style.start; i < style.end; i++) {
          acc[i] = style.style;
        }
        return acc;
      }, {});

      canvasObj.set({
        text: processed.text,
        styles: fabricStyles,
      });
    });

    canvas.renderAll();
  }, [variablesData, canvas]);

  return {
    isLoading,
    error,
  };
};

export default useTemplateRenderer;
