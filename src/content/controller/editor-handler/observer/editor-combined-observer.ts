import type { EditorObserver } from "./editor-observer";

export class EditorCombinedObserver implements EditorObserver {
  private selector: string;
  private currentEditor: HTMLElement | null | undefined;
  private currentText: string;
  private isEditable: boolean;
  private observer: MutationObserver;
  private editorChangedCallback: () => Promise<void>;

  /**
   * callback 중복 실행 방지
   */
  private callbackScheduled = false;

  constructor(selector: string, changedCallback: () => Promise<void>) {
    this.selector = selector;
    this.currentEditor = undefined;
    this.currentText = "";
    this.isEditable = false;
    this.editorChangedCallback = changedCallback;
    this.observer = new MutationObserver(this.handleMutations);
  }

  start() {
    document.addEventListener("focusin", this.handleFocusIn);
    document.addEventListener("input", this.handleInput);

    this.checkEditor();

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }

  stop() {
    document.removeEventListener("focusin", this.handleFocusIn);
    document.removeEventListener("input", this.handleInput);

    this.observer.disconnect();
    this.currentEditor = undefined;
    this.currentText = "";
    this.callbackScheduled = false;
  }

  getEditorStatus() {
    return {
      isEditable: this.isEditable,
      text: this.currentEditor?.textContent?.replace(/\u200B/g, "") ?? "",
    };
  }

  getEditor() {
    return this.currentEditor;
  }

  /**
   * 현재 활성화된 editor를 확인한다.
   */
  checkEditor() {
    const editor =
      this.findActiveEditor() ||
      ([...document.querySelectorAll<HTMLElement>(this.selector)].find(
        (editor) => editor.offsetParent !== null,
      ) ??
        null);
    if (editor) {
      this.isEditable = true;
    } else {
      this.isEditable = false;
    }

    const nextText = this.getEditorStatus()?.text ?? "";
    const editorChanged = editor !== this.currentEditor;
    const textChanged =
      editor !== null &&
      editor === this.currentEditor &&
      nextText !== this.currentText;

    if (!editorChanged && !textChanged) {
      return;
    }

    this.currentEditor = editor;
    this.currentText = nextText;

    this.scheduleCallback();
  }

  /**
   * 현재 focus된 요소에서 editor를 찾는다.
   */
  private findActiveEditor(): HTMLElement | null {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof HTMLElement)) {
      return null;
    }

    /*
     * 직접 editor인 경우
     *
     * <div contenteditable>
     */
    if (activeElement.matches(this.selector)) {
      return activeElement;
    }

    /*
     * editor 내부의 자식 요소에 focus가 들어가는
     * 구조까지 고려
     *
     * <div class="editor">
     *   <span>...</span>
     * </div>
     */
    const editor = activeElement.closest(this.selector);

    return editor instanceof HTMLElement ? editor : null;
  }

  /**
   * focus가 변경되었을 때 호출된다.
   *
   * 역할:
   * - 현재 사용자가 어느 editor를 선택했는지 확인
   */
  private handleFocusIn = (event: FocusEvent) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const editor = target.matches(this.selector)
      ? target
      : target.closest(this.selector);

    if (!(editor instanceof HTMLElement)) {
      return;
    }

    this.checkEditor();
  };

  /**
   * 실제 사용자 입력이 발생했을 때 호출된다.
   *
   * MutationObserver보다 먼저/직접적으로 입력을 감지한다.
   */
  private handleInput = (event: Event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const editor = target.matches(this.selector)
      ? target
      : target.closest(this.selector);

    if (!(editor instanceof HTMLElement)) {
      return;
    }

    /*
     * input 이벤트에서는 해당 editor가 확실하므로
     * 불필요하게 DOM 전체를 탐색하지 않는다.
     */
    const nextText = this.getEditorStatus()?.text ?? "";

    if (editor === this.currentEditor && nextText === this.currentText) {
      return;
    }

    this.currentEditor = editor;
    this.currentText = nextText;

    this.scheduleCallback();
  };

  /**
   * DOM 변경 감지
   *
   * input 이벤트에서 이미 상태를 갱신했다면
   * MutationObserver가 같은 변경을 다시 감지하더라도
   * checkEditor()에서 callback이 실행되지 않는다.
   */
  private handleMutations = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (this.isRelevantMutation(mutation)) {
        this.checkEditor();
        return;
      }
    }
  };

  /**
   * MutationObserver가 감지한 변경이
   * 우리가 관심 있는 변경인지 판단한다.
   */
  private isRelevantMutation(mutation: MutationRecord): boolean {
    if (mutation.type === "childList" || mutation.type === "characterData") {
      return true;
    }

    if (mutation.type === "attributes") {
      return true;
    }

    return false;
  }

  /**
   * 같은 이벤트 루프에서 발생하는 여러 변경을
   * 하나의 callback으로 합친다.
   */
  private scheduleCallback() {
    if (this.callbackScheduled) {
      return;
    }

    this.callbackScheduled = true;

    queueMicrotask(() => {
      this.callbackScheduled = false;

      void this.editorChangedCallback();
    });
  }
}
