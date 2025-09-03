import { Canvas, FabricText } from "fabric";

const useTextParser = (canvas: Canvas | null) => {
  const chunkText = (fabricText: FabricText) => {
    const variableRegex = /\{\{(\w+)\}\}/g;
    // execute regex on textbox, checking if any variables are present
    const match = fabricText.text.match(variableRegex);
    if (match) {
      const varStrings = match.map((m) => {
        return {
          type: "variable",
          text: m,
          start: m.indexOf(m),
          end: m.indexOf(m) + m.length,
        };
      });
      const literalStrings = fabricText.text.split(variableRegex).map((str) => {
        return {
          type: "literal",
          text: str,
          start: str.indexOf(str),
          end: str.indexOf(str) + str.length,
        };
      });
      const result = [...varStrings, ...literalStrings];
      result.sort((a, b) => a.start - b.start);
      return result;
    }
    return [fabricText.text];
  };

  return {
    chunkText,
  };
};

export default useTextParser;
