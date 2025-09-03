import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Canvas, FabricText, IText } from "fabric";
import useCreateToolbar from "../useCreateToolbar";
import { Button } from "@/components/ui/button";
import useSave from "../useSave";
import { Id } from "@/convex/_generated/dataModel";

export default function Toolbar({ canvas }: { canvas: Canvas | null }) {
  const [zoom, setZoom] = useState(0);
  const { createRectangle, createText } = useCreateToolbar(canvas);
  const { save } = useSave(
    canvas,
    "m97a43p47ke5aseaayerxftc697jyffg" as Id<"templates">,
  );

  useEffect(() => {
    if (canvas) {
      setZoom(canvas.getZoom() * 100);
    }
  }, [canvas]);

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setZoom(value);
    if (canvas) {
      canvas.setZoom(value / 100);
      canvas.requestRenderAll();
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoom + 10, 500);
    setZoom(newZoom);
    if (canvas) {
      canvas.setZoom(newZoom / 100);
      canvas.requestRenderAll();
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom - 10, 10);
    setZoom(newZoom);
    if (canvas) {
      canvas.setZoom(newZoom / 100);
      canvas.requestRenderAll();
    }
  };

  const fitCanvasToContainer = (canvas: Canvas | null) => {
    if (!canvas) return;
    const canvasWidth = canvas.getWidth();
    const canvasHeight = canvas.getHeight();
    const zoomX = canvasWidth / 1920;
    const zoomY = canvasHeight / 1080;
    const zoom = Math.min(zoomX, zoomY); // maintain aspect ratio

    canvas.setZoom(zoom);
  };

  const handleBold = () => {
    if (!canvas) return;
    const target = canvas.getActiveObject();
    if (!target) return;

    // Check if the object is an IText instance (supports selection and styles)
    if ((target as any).isType && (target as any).isType("i-text")) {
      const iText = target as IText;
      const selectionStart = iText.selectionStart;
      const selectionEnd = iText.selectionEnd;

      if (selectionStart === selectionEnd) {
        // No selection, toggle whole object
        iText.fontWeight = iText.fontWeight === "bold" ? "normal" : "bold";
      } else {
        // Partial selection, toggle only selected text
        const currentStyles = iText.getSelectionStyles();
        const isBold = currentStyles.some(
          (style: any) => style.fontWeight === "bold",
        );
        iText.setSelectionStyles({ fontWeight: isBold ? "normal" : "bold" });
      }
      canvas.requestRenderAll();
    }
  };

  return (
    <div className="w-full h-10 z-10 bg-black text-white flex gap-2 items-center px-2">
      <Button onClick={handleZoomOut}>-</Button>
      <div className="relative flex items-center">
        <Input
          type="number"
          value={zoom}
          onChange={handleZoomChange}
          min={10}
          max={500}
          step={1}
          className="pr-6"
        />
        <span className="absolute right-2 text-gray-400 pointer-events-none">
          %
        </span>
      </div>
      <Button onClick={handleZoomIn}>+</Button>
      <Button onClick={() => fitCanvasToContainer(canvas)}>Fit</Button>
      <Button onClick={createRectangle}>Rectangle</Button>
      <Button onClick={createText}>Text</Button>
      <Button onClick={save} className="bg-green-400">
        Save
      </Button>
      <Button
        onClick={() => {
          console.log(canvas?.toJSON());
        }}
      >
        Print
      </Button>
      <Button onClick={handleBold}>Bold</Button>
    </div>
  );
}
