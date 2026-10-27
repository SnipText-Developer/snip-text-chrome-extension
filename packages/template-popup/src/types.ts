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
}
