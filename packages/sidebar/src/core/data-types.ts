import type { VendorName } from "../config/vendors";

export interface EditorStatus {
  isEditable: boolean;
  text: string;
  prevTexts: string[];
  vendorName: EditorVendorName;
}

export type EditorVendorName = VendorName;


export interface Template {
  templateId: number;
  title: string;
  shortcut: string;
  content: string;
  variables: string[];
  lastUsedAt: string;
  createdAt: string;
  editedAt: string;
}
