import { Canvas, IText, Rect } from "fabric";

const useCreateToolbar = (canvas: Canvas | null) => {
  const createRectangle = () => {
    if (!canvas) return;
    const rect = new Rect({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      fill: "red",
    });
    canvas.add(rect);
  };

  const createText = () => {
    if (!canvas) return;
    const text = new IText("Hello, world!", {
      left: 100,
      top: 100,
    });
    canvas.add(text);
  };
  return {
    createRectangle,
    createText,
  };
};

export default useCreateToolbar;
