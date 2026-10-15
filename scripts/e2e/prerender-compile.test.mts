import { describe, expect, it } from "vitest";
import { findCompileFailures } from "./prerender-compile.mts";

const routes = ["/[lang]", "/[lang]/today"];

function event(message: object) {
  return `event: message\ndata: ${JSON.stringify(message)}\n\n`;
}

function compiled(id: number) {
  return event({
    id,
    jsonrpc: "2.0",
    result: { content: [{ text: '{"issues":[]}', type: "text" }] },
  });
}

describe("development route compilation answers", () => {
  it("accepts one successful answer per route, in any order", () => {
    expect(findCompileFailures({ body: `${compiled(1)}${compiled(0)}`, routes })).toStrictEqual([]);
  });

  it("names a route the dev server never answered", () => {
    expect(findCompileFailures({ body: compiled(0), routes })).toStrictEqual([
      "/[lang]/today: no compile_route answer",
    ]);
  });

  it("names a route whose tool call failed", () => {
    const failed = event({
      id: 1,
      jsonrpc: "2.0",
      result: { content: [{ text: '{"notFound":true}', type: "text" }], isError: true },
    });

    expect(findCompileFailures({ body: `${compiled(0)}${failed}`, routes })).toStrictEqual([
      expect.stringMatching(/^\/\[lang\]\/today: .*notFound/u),
    ]);
  });

  it("names a route rejected by the protocol", () => {
    const rejected = event({ error: { code: -32_602, message: "Invalid params" }, id: 0 });

    expect(findCompileFailures({ body: `${rejected}${compiled(1)}`, routes })).toStrictEqual([
      expect.stringMatching(/^\/\[lang\]: .*Invalid params/u),
    ]);
  });
});
