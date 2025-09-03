"use client";

import { useState, useRef, useEffect } from "react";
import { Canvas, IText, Rect } from "fabric";
import useToolbar from "./useToolbar";
import useCreateToolbar from "./useCreateToolbar";
import useTemplateRenderer from "../../../hooks/useTemplateRenderer";
import { Id } from "@/convex/_generated/dataModel";
import { testTemplate } from "./test-template";
import useSave from "./useSave";
import useMeasure from "react-use-measure";
import Toolbar from "./components/toolbar";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TextToolbar from "./components/TextToolbar";
import ObjectProperties from "./components/object-properties";

function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [editorContainerRef, editorContainerBounds] = useMeasure({
    debounce: 100,
  });

  const template = useQuery(api.templates.getTemplateById, {
    templateId: "m97a43p47ke5aseaayerxftc697jyffg" as Id<"templates">,
  });

  const bgRectangle = {
    angle: 0,
    backgroundColor: "",
    fill: "white",
    fillRule: "nonzero",
    flipX: false,
    flipY: false,
    globalCompositeOperation: "source-over",
    height: 1080,
    left: 0,
    opacity: 1,
    originX: "left",
    originY: "top",
    paintFirst: "fill",
    rx: 0,
    ry: 0,
    selectable: false,
    scaleX: 1,
    scaleY: 1,
    shadow: null,
    skewX: 0,
    skewY: 0,
    stroke: null,
    strokeDashArray: null,
    strokeDashOffset: 0,
    strokeLineCap: "butt",
    strokeLineJoin: "miter",
    strokeMiterLimit: 4,
    strokeUniform: false,
    strokeWidth: 1,
    top: 0,
    type: "Rect",
    version: "6.7.0",
    visible: true,
    width: 1920,
  };

  useEffect(() => {
    if (canvasRef.current) {
      const initCanvas = new Canvas(canvasRef.current);

      // const rect = new Rect({
      //   left: 0,
      //   top: 0,
      //   width: 1920,
      //   height: 1080,
      //   fill: "white",
      //   selectable: false,
      // });
      // initCanvas.add(rect);

      initCanvas.renderAll();
      setCanvas(initCanvas);

      return () => {
        initCanvas.dispose();
      };
    }
  }, []);

  useEffect(() => {
    if (
      !canvas ||
      !editorContainerBounds.width ||
      !editorContainerBounds.height
    )
      return;

    canvas.setDimensions({
      width: editorContainerBounds.width,
      height: editorContainerBounds.height,
    });
    canvas.renderAll();
  }, [canvas, editorContainerBounds.width, editorContainerBounds.height]);

  useEffect(() => {
    if (canvas && template) {
      const templateWithBg = {
        ...template.template,
        objects: [bgRectangle, ...template.template.objects],
      };
      canvas.loadFromJSON(templateWithBg).then((canvas) => {
        canvas.renderAll();
      });
    }
  }, [canvas, template]);

  return (
    <div className="w-full h-[calc(100vh-120px)] bg-gray-400 flex flex-col justify-center items-center">
      <Toolbar canvas={canvas} />
      <div className="flex w-full h-full">
        <div ref={editorContainerRef} className="w-full h-full">
          <canvas
            id="canvas"
            ref={canvasRef}
            style={{ width: "100%", height: "100%", zIndex: 100 }}
          />
        </div>
        <ObjectProperties canvas={canvas} />
      </div>
    </div>
  );
}

export default Page;
