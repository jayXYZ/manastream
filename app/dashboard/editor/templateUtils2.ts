interface ProcessTextResult {
  text: string;
  styles: TextStyleRange[];
}

interface TextStyleRange {
  start: number;
  end: number;
  style: any;
}

export function processTextWithVariables(
  text: string,
  styles: TextStyleRange[],
  variables: Record<string, string>,
): ProcessTextResult {
  // Step 1: Find all variable placeholders and their replacements
  const variablePattern = /\{\{(\w+)\}\}/g;
  const replacements: Array<{
    start: number;
    end: number;
    placeholder: string;
    variableName: string;
    replacement: string;
    firstCharIndex: number; // Index of first character of variable name
  }> = [];

  let match;
  while ((match = variablePattern.exec(text)) !== null) {
    const placeholder = match[0]; // "{{variable}}"
    const variableName = match[1]; // "variable"
    const replacement = variables[variableName] || "VAR NOT FOUND";
    const firstCharIndex = match.index + 2; // Index of first char after "{{"

    replacements.push({
      start: match.index,
      end: match.index + placeholder.length,
      placeholder,
      variableName,
      replacement,
      firstCharIndex,
    });
  }

  // Step 2: Process replacements from right to left to avoid index shifting
  replacements.sort((a, b) => b.start - a.start);

  let processedText = text;
  let processedStyles = [...styles];

  for (const replacement of replacements) {
    const lengthDifference =
      replacement.replacement.length - replacement.placeholder.length;

    // Step 3: Find the style that applies to the first character of variable name
    const firstCharStyle = processedStyles.find(
      (style) =>
        style.start <= replacement.firstCharIndex &&
        style.end > replacement.firstCharIndex,
    );

    // Step 4: Replace the text
    processedText =
      processedText.slice(0, replacement.start) +
      replacement.replacement +
      processedText.slice(replacement.end);

    // Step 5: Update all styles that come after this replacement
    processedStyles = processedStyles
      .map((style) => {
        // If style is completely after the replacement, shift it
        if (style.start >= replacement.end) {
          return {
            ...style,
            start: style.start + lengthDifference,
            end: style.end + lengthDifference,
          };
        }
        // If style is completely before the replacement, keep it unchanged
        else if (style.end <= replacement.start) {
          return style;
        }
        // If style overlaps with the replacement area, we need to handle it
        else {
          // Style starts before replacement and ends within/after replacement
          if (
            style.start < replacement.start &&
            style.end > replacement.start
          ) {
            // If it ends within the replacement, truncate it
            if (style.end <= replacement.end) {
              return {
                ...style,
                end: replacement.start,
              };
            }
            // If it extends beyond the replacement, split it
            else {
              // This creates the part after the replacement
              // We'll handle the before part by truncating this style
              return {
                ...style,
                start: replacement.start + replacement.replacement.length,
                end: style.end + lengthDifference,
              };
            }
          }
          // Style is completely within the replacement area - remove it
          else if (
            style.start >= replacement.start &&
            style.end <= replacement.end
          ) {
            return null; // Will be filtered out
          }
          // Style starts within replacement and extends beyond
          else if (
            style.start >= replacement.start &&
            style.start < replacement.end &&
            style.end > replacement.end
          ) {
            return {
              ...style,
              start: replacement.start + replacement.replacement.length,
              end: style.end + lengthDifference,
            };
          }
        }
        return style;
      })
      .filter((style): style is TextStyleRange => style !== null);

    // Step 6: Handle the case where we need to split a style that spans across the replacement
    const stylesToAdd: TextStyleRange[] = [];
    for (const style of styles) {
      if (style.start < replacement.start && style.end > replacement.end) {
        // Add the part before the replacement
        stylesToAdd.push({
          ...style,
          end: replacement.start,
        });
        // The part after the replacement is already handled in the map above
      }
    }
    processedStyles.push(...stylesToAdd);

    // Step 7: Add new style for the replacement text if we found a style for the first char
    if (firstCharStyle && replacement.replacement.length > 0) {
      processedStyles.push({
        start: replacement.start,
        end: replacement.start + replacement.replacement.length,
        style: { ...firstCharStyle.style },
      });
    }
  }

  // Step 8: Sort styles by start position for cleaner output
  processedStyles.sort((a, b) => a.start - b.start);

  return {
    text: processedText,
    styles: processedStyles,
  };
}

// Test cases
function runTests() {
  console.log("Running tests...\n");

  // Test 1: Basic variable replacement with style
  console.log("Test 1: Basic variable replacement");
  const result1 = processTextWithVariables(
    "Hello {{name}}!",
    [
      { start: 0, end: 5, style: { fontWeight: "bold" } }, // "Hello"
      { start: 6, end: 14, style: { color: "red" } }, // "{{name}}"
    ],
    { name: "Bob" },
  );
  console.log("Input: 'Hello {{name}}!'");
  console.log("Expected: 'Hello Bob!'");
  console.log("Actual:", result1.text);
  console.log("Styles:", result1.styles);
  console.log();

  // Test 2: Variable longer than placeholder
  console.log("Test 2: Variable longer than placeholder");
  const result2 = processTextWithVariables(
    "Hi {{x}}!",
    [{ start: 3, end: 7, style: { fontStyle: "italic" } }], // "{{x}}"
    { x: "Alexander" },
  );
  console.log("Input: 'Hi {{x}}!'");
  console.log("Expected: 'Hi Alexander!'");
  console.log("Actual:", result2.text);
  console.log("Styles:", result2.styles);
  console.log();

  // Test 3: Variable shorter than placeholder
  console.log("Test 3: Variable shorter than placeholder");
  const result3 = processTextWithVariables(
    "Hello {{username}} world",
    [
      { start: 0, end: 5, style: { fontWeight: "bold" } }, // "Hello"
      { start: 6, end: 18, style: { color: "blue" } }, // "{{username}}"
      { start: 19, end: 24, style: { textDecoration: "underline" } }, // "world"
    ],
    { username: "Al" },
  );
  console.log("Input: 'Hello {{username}} world'");
  console.log("Expected: 'Hello Al world'");
  console.log("Actual:", result3.text);
  console.log("Styles:", result3.styles);
  console.log();

  // Test 4: Missing variable
  console.log("Test 4: Missing variable");
  const result4 = processTextWithVariables(
    "Hello {{missing}}!",
    [{ start: 6, end: 17, style: { color: "red" } }],
    {},
  );
  console.log("Input: 'Hello {{missing}}!'");
  console.log("Expected: 'Hello VAR NOT FOUND!'");
  console.log("Actual:", result4.text);
  console.log("Styles:", result4.styles);
  console.log();

  // Test 5: Multiple variables
  console.log("Test 5: Multiple variables");
  const result5 = processTextWithVariables(
    "{{greeting}} {{name}}, you are {{age}} years old!",
    [
      { start: 0, end: 13, style: { fontWeight: "bold" } }, // "{{greeting}}"
      { start: 14, end: 22, style: { color: "red" } }, // "{{name}}"
      { start: 32, end: 39, style: { fontStyle: "italic" } }, // "{{age}}"
    ],
    { greeting: "Hi", name: "Alice", age: "25" },
  );
  console.log("Input: '{{greeting}} {{name}}, you are {{age}} years old!'");
  console.log("Expected: 'Hi Alice, you are 25 years old!'");
  console.log("Actual:", result5.text);
  console.log("Styles:", result5.styles);
  console.log();

  // Test 6: Style spanning across replacement boundary
  console.log("Test 6: Style spanning across replacement");
  const result6 = processTextWithVariables(
    "Hello {{name}} world",
    [{ start: 3, end: 15, style: { backgroundColor: "yellow" } }], // "lo {{name}} wo"
    { name: "Bob" },
  );
  console.log("Input: 'Hello {{name}} world'");
  console.log("Expected: 'Hello Bob world'");
  console.log("Actual:", result6.text);
  console.log("Styles:", result6.styles);
  console.log();
}
