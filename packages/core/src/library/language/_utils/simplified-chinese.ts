import { Converter as createConverter } from "opencc-js/t2cn";

export const toSimplifiedChinese = createConverter({ from: "t", to: "cn" });
