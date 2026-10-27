import type { ReactNode } from "react";
import { useMessageListener } from "../customHook/useMessageListener";
import { EditorStatusContext } from "./editorStatusContext";

export function EditorStatusProvider({ children }: { children: ReactNode }) {
  const editorState = useMessageListener();

  return (
    <EditorStatusContext.Provider value={editorState}>
      {children}
    </EditorStatusContext.Provider>
  );
}
