import { Canvas, IText, Rect } from "fabric";
import { useEffect, useState } from "react";

const useToolbar = (canvas: Canvas | null) => {
  const [selectedObjects, setSelectedObjects] = useState<any[]>([]);
  const [selectedObjectsType, setSelectedObjectsType] = useState<string>("");
  const [objectProperties, setObjectProperties] = useState<any>({});

  useEffect(() => {
    if (!canvas) return;
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelectionCleared);
    canvas.on("object:modified", handleModification);
    canvas.on("object:moving", handleModification);
    canvas.on("object:scaling", handleModification);
    canvas.on("text:selection:changed", handleTextSelection);
    canvas.on("text:changed", handleModification);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelectionCleared);
      canvas.off("object:modified", handleModification);
      canvas.off("object:moving", handleModification);
      canvas.off("object:scaling", handleModification);
      canvas.off("text:selection:changed", handleTextSelection);
      canvas.off("text:changed", handleModification);
    };
  }, [canvas]);

  // handlers
  const handleSelection = (e: any) => {
    const objects = e.selected;
    console.log("objects selected", objects);
    console.log("objects targeted", e.target);
    console.log("active object", canvas?.getActiveObject());
    setSelectedObjects(objects);

    const activeObject = canvas?.getActiveObject();
    if (activeObject && activeObject.type === "activeselection") {
      setSelectedObjectsType("group");
      setObjectProperties({
        width: activeObject.width * activeObject.scaleX,
        height: activeObject.height * activeObject.scaleY,
      });
    } else if (objects.length === 1) {
      setSelectedObjectsType(objects[0].type);
      console.log("type", objects[0].type);
      handleProperties(objects[0]);
    } else {
      setSelectedObjectsType("");
      setObjectProperties({});
    }
  };

  const handleSelectionCleared = () => {
    setSelectedObjects([]);
    setSelectedObjectsType("");
    setObjectProperties({});
  };

  const handleModification = (e: any) => {
    const target = e.target;
    if (target.type === "activeselection") {
      setSelectedObjectsType("group");
      setObjectProperties({
        width: target.width * target.scaleX,
        height: target.height * target.scaleY,
      });
    } else {
      setSelectedObjectsType(target.type);
      handleProperties(target);
    }
  };

  const handleTextSelection = (e: any) => {
    const target = e.target;
    setSelectedObjects([target]);
    setSelectedObjectsType(target.type);
    handleProperties(target);
  };

  const handleProperties = (object: any) => {
    const type = object.type;
    if (type === "rect") {
      setObjectProperties({
        left: object.left,
        top: object.top,
        width: object.width * object.scaleX,
        height: object.height * object.scaleY,
        fill: object.fill,
        stroke: object.stroke,
        strokeWidth: object.strokeWidth,
      });
    } else if (type === "i-text" || type === "IText") {
      setObjectProperties({
        left: object.left,
        top: object.top,
        text: object.text,
        fontSize: object.fontSize,
        fontFamily: object.fontFamily,
        fontWeight: object.fontWeight,
        fontStyle: object.fontStyle,
        textAlign: object.textAlign,
        textBaseline: object.textBaseline,
      });
    } else return;
  };
  return {
    selectedObjects,
    selectedObjectsType,
    objectProperties,
  };
};

export default useToolbar;
