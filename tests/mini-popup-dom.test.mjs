import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("../packages/mini-popup/src/", import.meta.url));

test("mini-popup keeps imperative DOM access behind dom/index.ts", () => {
  function check(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "dom") continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { check(path); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const source = readFileSync(path, "utf8");
      const label = relative(root, path);
      assert.doesNotMatch(source, /\b(?:document|window)\s*\./, label + ": global DOM access");
      assert.doesNotMatch(source, /\.(?:querySelectorAll?|closest|getBoundingClientRect|focus|scrollIntoView|addEventListener|removeEventListener|preventDefault|stopPropagation)\s*\(/, label + ": direct DOM operation");
      assert.doesNotMatch(source, /from\s+["'][^"']*\/dom\/(?!index["'])/, label + ": internal DOM module import");
    }
  }
  check(root);
});
