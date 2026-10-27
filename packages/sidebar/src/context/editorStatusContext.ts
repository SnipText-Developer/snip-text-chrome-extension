import { createContext } from "react";
import type { EditorStatus, EditorVendorName } from "../core/data-types";

export type ReceivedEditorStatus = EditorStatus & {
  receivedAt: number;
  updateCount: number;
};
export interface EditorStatusState {
  latestStatus: ReceivedEditorStatus | null;
  statuses: Partial<Record<EditorVendorName, ReceivedEditorStatus>>;
}
export const EditorStatusContext = createContext<EditorStatusState | null>(null);
