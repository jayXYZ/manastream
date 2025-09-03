import { FabricText } from "fabric";

export function hasVariables(text: string) {
  return /\{\{\w+\}\}/.test(text);
}

export function extractVariables(text: string) {
  const variableRegex = /\{\{(\w+)\}\}/g;
  const variables = [];
  let match;

  while ((match = variableRegex.exec(text)) !== null) {
    variables.push({
      name: match[1],
      placeholder: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return variables;
}

export class JsonStyleProcessor {
  styles: any[];
  constructor(styles: any[]) {
    this.styles = JSON.parse(JSON.stringify(styles || {}));
  }

  substituteVariable(variable: any, value: string) {
    const styleChunks = this.styles || [];
    const oldLength = variable.end - variable.start;
    const newLength = value.length;
    const lengthDiff = newLength - oldLength;

    console.log("styleChunks", styleChunks);

    // Extract and remove styles from variable range
    const variableStyles = styleChunks.find((chunk: any) => {
      return (
        chunk.start === variable.start + 2 && chunk.end === variable.end - 2
      );
    });
    console.log("variableStyles", variableStyles);

    if (variableStyles) {

    // // Apply unified style to substituted value
    // const unifiedStyle = variableStyles[0] || {};
    // for (let i = 0; i < newLength; i++) {
    //   if (Object.keys(unifiedStyle).length > 0) {
    //     lineStyles[variable.start + i] = { ...unifiedStyle };
    //   }
    // }

    // // Shift subsequent styles
    // if (lengthDiff !== 0) {
    //   const stylesToShift: any = {};
    //   Object.keys(lineStyles).forEach((index) => {
    //     const idx = parseInt(index);
    //     if (idx >= variable.end) {
    //       stylesToShift[idx + lengthDiff] = lineStyles[idx];
    //       delete lineStyles[idx];
    //     }
    //   });

    //   Object.assign(lineStyles, stylesToShift);
    // }

    // // Clean up empty line styles
    // if (Object.keys(lineStyles).length === 0) {
    //   delete this.styles[0];
    // }
  }

  getProcessedStyles(): any {
    return this.styles;
  }
}

export function processTextObject(textObj: FabricText, variableData: any) {
  console.log("processTextObject input:", textObj.text, variableData);
  const variables = extractVariables(textObj.text);

  if (variables.length === 0) {
    return textObj; // No variables, return as-is
  }

  let newText = textObj.text;
  const styleProcessor = new JsonStyleProcessor(textObj.styles || {});

  // Process variables right to left to avoid index shifting
  const sortedVariables = [...variables].sort((a, b) => b.start - a.start);

  sortedVariables.forEach((variable) => {
    const value = variableData[variable.name] || "VAR NOT FOUND";

    // Update text
    newText =
      newText.substring(0, variable.start) +
      value +
      newText.substring(variable.end);

    // Update styles
    styleProcessor.substituteVariable(variable, value);
  });

  return {
    ...textObj,
    text: newText,
    styles: styleProcessor.getProcessedStyles(),
  };
}

