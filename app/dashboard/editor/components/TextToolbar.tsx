import { Canvas } from "fabric";
import useToolbar from "../useToolbar";
import { useEffect, useState } from "react";

export default function TextToolbar({ canvas }: { canvas: Canvas | null }) {
  const { selectedObjects, selectedObjectsType, objectProperties } =
    useToolbar(canvas);
  const [visible, setVisible] = useState(false);
  const [toolbarPos, setToolbarPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (
      canvas &&
      selectedObjects.length > 0 &&
      (selectedObjectsType === "i-text" || selectedObjectsType === "IText")
    ) {
      const obj = selectedObjects[0];
      const rect = obj.getBoundingRect();
      const canvasEl = canvas.getElement();
      const canvasRect = canvasEl.getBoundingClientRect();

      setToolbarPos({
        left: canvasRect.left + rect.left,
        top:
          rect.top - 80 < 0
            ? canvasRect.top + rect.top + rect.height + 40
            : canvasRect.top + rect.top - 40,
      });

      setVisible(true);
    } else {
      setVisible(false);
      setToolbarPos(null);
    }
  }, [selectedObjects, selectedObjectsType]);

  return (
    <>
      {visible && (
        <div
          className={`fixed z-[1000] bg-gray-400 text-white p-2 rounded-md`}
          style={{
            top: toolbarPos?.top,
            left: toolbarPos?.left,
          }}
        >
          Toolbar - {toolbarPos?.top} - {toolbarPos?.left}
        </div>
      )}
    </>
  );
}
