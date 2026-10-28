import { useMemo } from "react";

export function useTemplateContent(
  content: string,
  values: Readonly<Record<string, string>>,
): string {
  return useMemo(() => content.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (placeholder, field: string) => {
      const name = field.trim();
      return Object.hasOwn(values, name) ? values[name] : placeholder;
    },
  ), [content, values]);
}
