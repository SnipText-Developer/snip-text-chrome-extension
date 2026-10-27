import type { EditorObserver } from "./editor-observer";

export class EditorMutationObserver implements EditorObserver {
  private selector: string;
  private currentEditor: HTMLElement | null | undefined;
  private currentText: string;
  private isEditable: boolean;
  private observer: MutationObserver;
  private editorChangedCallback: () => Promise<void>;

  constructor(selector: string, changedCallback: () => Promise<void>) {
    this.selector = selector;
    this.currentEditor = undefined;
    this.currentText = "";
    this.isEditable = false;
    this.editorChangedCallback = changedCallback;

    this.observer = new MutationObserver(() => {
      this.checkEditor();
    });
  }

  start() {
    this.checkEditor();
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }

  stop() {
    this.observer.disconnect();
  }

  getEditorStatus() {
    return {
      isEditable: this.isEditable,
      text: this.currentEditor?.textContent?.replace(/\u200B/g, "") ?? "",
    };
  }

  checkEditor() {
    const editors = document.querySelectorAll<HTMLElement>(this.selector);
    const editor =
      [...editors].find((editor) => editor.offsetParent !== null) ?? null;
    if (editor) {
      this.isEditable = true;
    } else {
      this.isEditable = false;
    }

    const nextText = this.getEditorStatus()?.text ?? "";
    const textChanged =
      editor !== null &&
      editor === this.currentEditor &&
      nextText !== this.currentText;

    if (editor !== this.currentEditor || textChanged) {
      this.currentEditor = editor;
      this.currentText = nextText;

      this.editorChangedCallback();
    }
  }

  getEditor() {
    return this.currentEditor;
  }
}
