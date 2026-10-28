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

export interface StartPopupOptions {
  selector: string;
  getTemplates: () => Promise<Template[]>;
  insertText: (text: string) => Promise<void>;
  correctTone?: (tone: string) => Promise<string>;
  getEditorText?: () => Promise<string>;
}

export interface PopupConnection {
  vendorName: string;
  getEditorStatus: () => { text?: string; isEditable?: boolean } | null;
}

export interface ConnectedPopupOptions extends PopupConnection {
  selector: string;
}
