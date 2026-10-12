const variablePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function getTemplateVariables(text: string): string[] {
  return [...new Set([...text.matchAll(variablePattern)].map(match => match[1].trim()))];
}

export function renderSmartTemplate(text: string, values: ReadonlyMap<string, string>): string {
  return text.replace(variablePattern, (placeholder, field: string) =>
    values.get(field.trim()) ?? placeholder);
}
