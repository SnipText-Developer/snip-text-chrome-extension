import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { moduleUrl } from "./module-url.mjs";

const extension = await import(moduleUrl("../src/config/vendors.ts"));
const sidebar = await import(moduleUrl("../packages/sidebar/src/config/vendors.ts"));

for (const [name, config] of [["extension", extension], ["sidebar", sidebar]]) {
  test(name + ": 벤더 식별자와 HTTPS 도메인을 엄격하게 판별", () => {
    assert.equal(new Set(config.vendors.map((vendor) => vendor.id)).size, config.vendors.length);
    for (const vendor of config.vendors) {
      assert.equal(config.isVendorName(vendor.id), true);
      assert.equal(config.getVendorByUrl(`https://${vendor.hostname}/mail?query=value`)?.id, vendor.id);
      assert.equal(config.getVendorByUrl(`https://${vendor.hostname.toUpperCase()}/`)?.id, vendor.id);
      for (const url of [
        `http://${vendor.hostname}/`, `https://${vendor.hostname}.example.com/`,
        `https://example.com/?next=https://${vendor.hostname}/`, `https://${vendor.hostname}@example.com/`,
      ]) assert.equal(config.getVendorByUrl(url), null);
    }
    for (const value of [null, undefined, "", "google", "naver", "OTHER", "constructor", "__proto__", {}, 1]) {
      assert.equal(config.isVendorName(value), false);
    }
    for (const url of [undefined, "", "not a url", "about:blank", "https://example.com/"]) {
      assert.equal(config.getVendorByUrl(url), null);
    }
  });
}

test("extension: 작성 경로는 hostname과 pathname을 함께 확인", () => {
  const vendor = extension.vendors.find((item) => item.composePath);
  assert.ok(vendor);
  const address = `https://${vendor.hostname}${vendor.composePath}`;
  assert.equal(extension.isComposeUrl(vendor.id, address), true);
  assert.equal(extension.isComposeUrl(vendor.id, address + "/draft?x=1"), true);
  assert.equal(extension.isComposeUrl(vendor.id, address + "-other"), false);
  assert.equal(extension.isComposeUrl(vendor.id, `https://${vendor.hostname}/?next=${vendor.composePath}`), false);
  assert.equal(extension.isComposeUrl(vendor.id, undefined), false);
  assert.equal(extension.isComposeUrl(vendor.id, `https://example.com${vendor.composePath}`), false);
});

test("extension: manifest의 도메인과 콘텐츠 스크립트가 설정 및 소스와 일치", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/manifest.json", import.meta.url), "utf8"));
  for (const vendor of extension.vendors) {
    const script = manifest.content_scripts.find((item) => item.matches.includes(`https://${vendor.hostname}/*`));
    assert.ok(script);
    assert.deepEqual(script.js, [`./src/content/${vendor.script}.js`]);
    assert.ok(existsSync(new URL(`../src/content/${vendor.script}.ts`, import.meta.url)));
  }
});
