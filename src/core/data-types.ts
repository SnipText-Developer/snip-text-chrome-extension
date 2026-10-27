export interface EditorStatus {
  isEditable: boolean;
  text: string;
  prevTexts: string[];
  vendorName: EditorVendorName;
}

export type EditorVendorName = "GOOGLE" | "NAVER";

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
