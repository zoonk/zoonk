import { describe, expect, it } from "vitest";
import { isFileNameTitle } from "./file-name-title";

describe(isFileNameTitle, () => {
  it("knows a title that only repeats its page's file name", () => {
    expect(
      isFileNameTitle({
        title: "L9784",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l9784.htm",
      }),
    ).toBe(true);

    expect(
      isFileNameTitle({
        title: "l12813.htm",
        url: "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/L12813.htm",
      }),
    ).toBe(true);
  });

  it("keeps a document's own name, even one without spaces", () => {
    expect(
      isFileNameTitle({
        title: "2024年全国硕士研究生招生工作管理规定",
        url: "https://www.moe.gov.cn/srcsite/A15/moe_778/s3113/202309/t20230915_1080603.html",
      }),
    ).toBe(false);

    expect(isFileNameTitle({ title: "CS50", url: "https://cs50.harvard.edu/x/" })).toBe(false);

    expect(
      isFileNameTitle({
        title: "Lei nº 9.784, de 29 de janeiro de 1999",
        url: "https://www.planalto.gov.br/ccivil_03/leis/l9784.htm",
      }),
    ).toBe(false);

    expect(isFileNameTitle({ title: "L9784", url: null })).toBe(false);
  });
});
