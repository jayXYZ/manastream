import { Canvas, IText, Text, Group, Object as FabricObject } from "fabric";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function ObjectProperties({
  canvas,
}: {
  canvas: Canvas | null;
}) {
  const [selectedObject, setSelectedObject] = useState<FabricObject | null>(
    null,
  );
  const [properties, setProperties] = useState({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
    scaleX: 1,
    scaleY: 1,
    angle: 0,
    opacity: 1,
    fill: "#000000",
    stroke: "",
    strokeWidth: 0,
    fontSize: 16,
    fontFamily: "Arial",
    fontWeight: "normal",
    fontStyle: "normal",
    textAlign: "left",
    underline: false,
    linethrough: false,
    backgroundColor: "",
    textBackgroundColor: "",
  });

  useEffect(() => {
    if (!canvas) return;

    const handleSelection = () => {
      const activeObject = canvas.getActiveObject();
      if (activeObject) {
        setSelectedObject(activeObject);
        updatePropertiesFromObject(activeObject);
      } else {
        setSelectedObject(null);
        setProperties({
          width: 0,
          height: 0,
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1,
          angle: 0,
          opacity: 1,
          fill: "#000000",
          stroke: "",
          strokeWidth: 0,
          fontSize: 16,
          fontFamily: "Arial",
          fontWeight: "normal",
          fontStyle: "normal",
          textAlign: "left",
          underline: false,
          linethrough: false,
          backgroundColor: "",
          textBackgroundColor: "",
        });
      }
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
    };
  }, [canvas]);

  const updatePropertiesFromObject = (obj: FabricObject) => {
    const isText = obj instanceof IText || obj instanceof Text;

    setProperties({
      width: Math.round(obj.width || 0),
      height: Math.round(obj.height || 0),
      left: Math.round(obj.left || 0),
      top: Math.round(obj.top || 0),
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      angle: obj.angle || 0,
      opacity: obj.opacity || 1,
      fill: String(obj.fill || "#000000"),
      stroke: String(obj.stroke || ""),
      strokeWidth: obj.strokeWidth || 0,
      fontSize: isText ? Number((obj as IText).fontSize) || 16 : 16,
      fontFamily: isText ? (obj as IText).fontFamily || "Arial" : "Arial",
      fontWeight: isText
        ? String((obj as IText).fontWeight || "normal")
        : "normal",
      fontStyle: isText ? (obj as IText).fontStyle || "normal" : "normal",
      textAlign: isText ? (obj as IText).textAlign || "left" : "left",
      underline: isText ? (obj as IText).underline || false : false,
      linethrough: isText ? (obj as IText).linethrough || false : false,
      backgroundColor: String(obj.backgroundColor || ""),
      textBackgroundColor: isText
        ? String((obj as IText).textBackgroundColor || "")
        : "",
    });
  };

  const updateObjectProperty = (property: string, value: any) => {
    if (!selectedObject || !canvas) return;

    const isText =
      selectedObject instanceof IText || selectedObject instanceof Text;

    // Update the property
    (selectedObject as any)[property] = value;

    // Handle special cases
    if (property === "width" || property === "height") {
      selectedObject.setCoords();
    }

    if (property === "textAlign" && isText) {
      (selectedObject as IText).set("textAlign", value);
    }

    if (property === "fontSize" && isText) {
      (selectedObject as IText).set("fontSize", parseInt(value));
    }

    if (property === "fontFamily" && isText) {
      (selectedObject as IText).set("fontFamily", value);
    }

    if (property === "fontWeight" && isText) {
      (selectedObject as IText).set("fontWeight", value);
    }

    if (property === "fontStyle" && isText) {
      (selectedObject as IText).set("fontStyle", value);
    }

    if (property === "underline" && isText) {
      (selectedObject as IText).set("underline", value);
    }

    if (property === "linethrough" && isText) {
      (selectedObject as IText).set("linethrough", value);
    }

    // Update the canvas
    canvas.requestRenderAll();

    // Update local state
    setProperties((prev) => ({ ...prev, [property]: value }));
  };

  if (!selectedObject) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">
          Select an object to edit its properties
        </div>
      </div>
    );
  }

  const isText =
    selectedObject instanceof IText || selectedObject instanceof Text;

  return (
    <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Object Properties</h3>
        <p className="text-xs text-muted-foreground">{selectedObject.type}</p>
      </div>

      <Separator />

      {/* Position & Size */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Position & Size</h4>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="width" className="text-xs">
              Width
            </Label>
            <Input
              id="width"
              type="number"
              value={properties.width}
              onChange={(e) =>
                updateObjectProperty("width", parseInt(e.target.value) || 0)
              }
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="height" className="text-xs">
              Height
            </Label>
            <Input
              id="height"
              type="number"
              value={properties.height}
              onChange={(e) =>
                updateObjectProperty("height", parseInt(e.target.value) || 0)
              }
              className="h-8"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="left" className="text-xs">
              X Position
            </Label>
            <Input
              id="left"
              type="number"
              value={properties.left}
              onChange={(e) =>
                updateObjectProperty("left", parseInt(e.target.value) || 0)
              }
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="top" className="text-xs">
              Y Position
            </Label>
            <Input
              id="top"
              type="number"
              value={properties.top}
              onChange={(e) =>
                updateObjectProperty("top", parseInt(e.target.value) || 0)
              }
              className="h-8"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="scaleX" className="text-xs">
              Scale X
            </Label>
            <Input
              id="scaleX"
              type="number"
              step="0.1"
              value={properties.scaleX}
              onChange={(e) =>
                updateObjectProperty("scaleX", parseFloat(e.target.value) || 1)
              }
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="scaleY" className="text-xs">
              Scale Y
            </Label>
            <Input
              id="scaleY"
              type="number"
              step="0.1"
              value={properties.scaleY}
              onChange={(e) =>
                updateObjectProperty("scaleY", parseFloat(e.target.value) || 1)
              }
              className="h-8"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="angle" className="text-xs">
            Rotation (degrees)
          </Label>
          <Input
            id="angle"
            type="number"
            value={properties.angle}
            onChange={(e) =>
              updateObjectProperty("angle", parseInt(e.target.value) || 0)
            }
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="opacity" className="text-xs">
            Opacity
          </Label>
          <Input
            id="opacity"
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={properties.opacity}
            onChange={(e) =>
              updateObjectProperty("opacity", parseFloat(e.target.value) || 1)
            }
            className="h-8"
          />
        </div>
      </div>

      <Separator />

      {/* Colors */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Colors</h4>

        <div className="space-y-1">
          <Label htmlFor="fill" className="text-xs">
            Fill Color
          </Label>
          <div className="flex gap-2">
            <Input
              id="fill"
              type="color"
              value={properties.fill}
              onChange={(e) => updateObjectProperty("fill", e.target.value)}
              className="h-8 w-12 p-1"
            />
            <Input
              type="text"
              value={properties.fill}
              onChange={(e) => updateObjectProperty("fill", e.target.value)}
              className="h-8 flex-1"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="stroke" className="text-xs">
            Stroke Color
          </Label>
          <div className="flex gap-2">
            <Input
              id="stroke"
              type="color"
              value={properties.stroke}
              onChange={(e) => updateObjectProperty("stroke", e.target.value)}
              className="h-8 w-12 p-1"
            />
            <Input
              type="text"
              value={properties.stroke}
              onChange={(e) => updateObjectProperty("stroke", e.target.value)}
              className="h-8 flex-1"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="strokeWidth" className="text-xs">
            Stroke Width
          </Label>
          <Input
            id="strokeWidth"
            type="number"
            min="0"
            value={properties.strokeWidth}
            onChange={(e) =>
              updateObjectProperty("strokeWidth", parseInt(e.target.value) || 0)
            }
            className="h-8"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="backgroundColor" className="text-xs">
            Background Color
          </Label>
          <div className="flex gap-2">
            <Input
              id="backgroundColor"
              type="color"
              value={properties.backgroundColor}
              onChange={(e) =>
                updateObjectProperty("backgroundColor", e.target.value)
              }
              className="h-8 w-12 p-1"
            />
            <Input
              type="text"
              value={properties.backgroundColor}
              onChange={(e) =>
                updateObjectProperty("backgroundColor", e.target.value)
              }
              className="h-8 flex-1"
            />
          </div>
        </div>
      </div>

      {/* Text Properties - Only show for text objects */}
      {isText && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Text Properties</h4>

            <div className="space-y-1">
              <Label htmlFor="fontSize" className="text-xs">
                Font Size
              </Label>
              <Input
                id="fontSize"
                type="number"
                min="1"
                value={properties.fontSize}
                onChange={(e) =>
                  updateObjectProperty(
                    "fontSize",
                    parseInt(e.target.value) || 16,
                  )
                }
                className="h-8"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="fontFamily" className="text-xs">
                Font Family
              </Label>
              <Select
                value={properties.fontFamily}
                onValueChange={(value) =>
                  updateObjectProperty("fontFamily", value)
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Helvetica">Helvetica</SelectItem>
                  <SelectItem value="Times New Roman">
                    Times New Roman
                  </SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Verdana">Verdana</SelectItem>
                  <SelectItem value="Courier New">Courier New</SelectItem>
                  <SelectItem value="Impact">Impact</SelectItem>
                  <SelectItem value="Comic Sans MS">Comic Sans MS</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fontWeight" className="text-xs">
                Font Weight
              </Label>
              <Select
                value={properties.fontWeight}
                onValueChange={(value) =>
                  updateObjectProperty("fontWeight", value)
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="300">300</SelectItem>
                  <SelectItem value="400">400</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                  <SelectItem value="600">600</SelectItem>
                  <SelectItem value="700">700</SelectItem>
                  <SelectItem value="800">800</SelectItem>
                  <SelectItem value="900">900</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="fontStyle" className="text-xs">
                Font Style
              </Label>
              <Select
                value={properties.fontStyle}
                onValueChange={(value) =>
                  updateObjectProperty("fontStyle", value)
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="italic">Italic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="textAlign" className="text-xs">
                Text Alignment
              </Label>
              <Select
                value={properties.textAlign}
                onValueChange={(value) =>
                  updateObjectProperty("textAlign", value)
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="justify">Justify</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="textBackgroundColor" className="text-xs">
                Text Background
              </Label>
              <div className="flex gap-2">
                <Input
                  id="textBackgroundColor"
                  type="color"
                  value={properties.textBackgroundColor}
                  onChange={(e) =>
                    updateObjectProperty("textBackgroundColor", e.target.value)
                  }
                  className="h-8 w-12 p-1"
                />
                <Input
                  type="text"
                  value={properties.textBackgroundColor}
                  onChange={(e) =>
                    updateObjectProperty("textBackgroundColor", e.target.value)
                  }
                  className="h-8 flex-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="underline" className="text-xs">
                Underline
              </Label>
              <Switch
                id="underline"
                checked={properties.underline}
                onCheckedChange={(checked) =>
                  updateObjectProperty("underline", checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="linethrough" className="text-xs">
                Strikethrough
              </Label>
              <Switch
                id="linethrough"
                checked={properties.linethrough}
                onCheckedChange={(checked) =>
                  updateObjectProperty("linethrough", checked)
                }
              />
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Actions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Actions</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedObject && canvas) {
                canvas.remove(selectedObject);
                canvas.requestRenderAll();
                setSelectedObject(null);
              }
            }}
          >
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedObject && canvas) {
                canvas.bringObjectToFront(selectedObject);
                canvas.requestRenderAll();
              }
            }}
          >
            Bring to Front
          </Button>
        </div>
      </div>
    </div>
  );
}
