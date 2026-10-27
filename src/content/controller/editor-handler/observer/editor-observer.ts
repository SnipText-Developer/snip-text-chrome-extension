import type { EditorStatus } from "../../../../core/data-types";

export interface EditorObserver {
  start(): void;
  stop(): void;
  getEditor(): HTMLElement | null | undefined;
  getEditorStatus(): Partial<EditorStatus> | null;
  checkEditor(): void;
}

export interface EditorObserverFactory {
  create(
    selector: string,
    changedCallback: () => Promise<void>,
  ): EditorObserver;
}
