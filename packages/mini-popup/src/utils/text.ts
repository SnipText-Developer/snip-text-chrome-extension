const variablePattern = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function getTemplateVariables(text: string): string[] {
  return [
    ...new Set(
      [...text.matchAll(variablePattern)].map((match) => match[1].trim()),
    ),
  ];
}

export function getTemplateContent(content: string, values: Readonly<Record<string, string>>): string {
  return content.replace(variablePattern, (placeholder, field: string) => {
    const name = field.trim();
    return Object.hasOwn(values, name) && values[name].trim() ? values[name] : placeholder;
  });
}
