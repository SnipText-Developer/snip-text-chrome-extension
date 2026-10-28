import { useMemo } from "react";
import { getTemplateContent } from "../utils/text";

export function useTemplateContent(
  content: string,
  values: Readonly<Record<string, string>>,
): string {
  return useMemo(() => getTemplateContent(content, values), [content, values]);
}
