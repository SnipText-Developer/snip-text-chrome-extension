import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

const modules = new Map();
export function moduleUrl(path, replacements = {}) {
  const url = path instanceof URL ? path : new URL(path, import.meta.url);
  const key = url.href + JSON.stringify(replacements);
  if (modules.has(key)) return modules.get(key);
  let source = readFileSync(url, "utf8");
  if (url.pathname.endsWith(".json")) source = "export default " + source;
  else if (url.pathname.endsWith(".css")) source = "export default " + JSON.stringify(source);
  else {
    for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(from, to);
    source = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
    }).outputText.replace(/from ["']([^"']+)["']/g, (_, specifier) => {
      if (!specifier.startsWith(".")) return "from " + JSON.stringify(import.meta.resolve(specifier));
      const relative = new URL(specifier.replace("?inline", ""), url);
      const resolved = [relative, new URL(relative.href + ".ts"), new URL(relative.href + ".tsx")].find((file) => existsSync(file));
      return "from " + JSON.stringify(moduleUrl(resolved));
    });
  }
  const result = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  modules.set(key, result);
  return result;
}
