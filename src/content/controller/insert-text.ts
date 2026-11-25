import { encodeEditorText, readEditorText } from "../utils/editor-text";

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

  const previous = readEditorText(editor);
  const prevText = previous === "," ? "" : previous;
  const safeText = String(text ?? "");

  if (!safeText) {
    return {
      prevText,
      isInserted: false,
    };
  }

  const doc = editor.ownerDocument;
  const content = doc.createDocumentFragment();
  encodeEditorText(safeText).split("\n").forEach((line, index) => {
    if (index > 0) content.append(doc.createElement("br"));
    if (line) content.append(doc.createTextNode(line));
  });
  const fallback = content.cloneNode(true);

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

    range.insertNode(content);
    range.selectNodeContents(editor);
    range.collapse(false);

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

  editor.replaceChildren(fallback);

  return {
    prevText,
    isInserted: true,
  };
}
