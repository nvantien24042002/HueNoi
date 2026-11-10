import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const homeUrl = new URL("../app/page.tsx", import.meta.url);
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url !== homeUrl.href) return nextLoad(url, context);

    const { outputText } = ts.transpileModule(readFileSync(homeUrl, "utf8"), {
      fileName: "page.tsx",
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
      },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});
const { default: Home } = await import(homeUrl.href);
hooks.deregister();

test("trang chủ hiển thị tiêu đề và mô tả tiếng Việt", () => {
  const html = renderToStaticMarkup(createElement(Home));

  assert.match(html, /<h1\b[^>]*>HueNoi-FAIL<\/h1>/);
  assert.match(html, /<p\b[^>]*>Học tiếng Huế<\/p>/);
});
