import { encodeEditorText } from "../utils/editor-text";

export function insertTextToEditor(
  editor: HTMLElement | undefined | null,
  text: string,
): { prevText: string; isInserted: boolean } {
  if (!(editor instanceof HTMLElement)) {
    return {
      prevText: "",
      isInserted: false,
    };
  }

  const prevText = editor.textContent === "," ? "" : (editor.textContent ?? "");
  const safeText = String(text ?? "");

  if (!safeText) {
    return {
      prevText,
      isInserted: false,
    };
  }

  const encodedText = encodeEditorText(safeText);

  try {
    editor.focus();
    editor.textContent = "";

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const lines = encodedText.split("\n");

    lines.forEach((line, index) => {
      if (index > 0) {
        const lineBreak = document.createElement("br");
        range.insertNode(lineBreak);
        range.setStartAfter(lineBreak);
        range.setEndAfter(lineBreak);
      }

      if (!line) {
        return;
      }

      const textNode = document.createTextNode(line);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
    });

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    return {
      prevText,
      isInserted: true,
    };
  } catch (error) {
    console.warn("Failed to insert text into editor:", error);
  }

  editor.textContent = encodedText;

  return {
    prevText,
    isInserted: true,
  };
}
