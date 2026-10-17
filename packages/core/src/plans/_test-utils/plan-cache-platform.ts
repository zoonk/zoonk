import { createRequire } from "node:module";
import { isJsonObject } from "@zoonk/utils/json";

const require = createRequire(import.meta.url);

type RscEncoder = (value: unknown) => Promise<string | FormData>;
const HEX_RADIX = 16;

function loadEncoder(): RscEncoder {
  const rscModule: unknown = require("next/dist/compiled/react-server-dom-webpack/client.edge");

  if (!isJsonObject(rscModule) || typeof rscModule.encodeReply !== "function") {
    throw new Error("Installed Next must provide its RSC argument encoder");
  }

  const encode = rscModule.encodeReply;

  return async (value) => {
    const encoded: unknown = await Reflect.apply(encode, undefined, [value]);

    if (typeof encoded === "string" || encoded instanceof FormData) {
      return encoded;
    }

    throw new Error("Installed RSC must encode to its string or form data");
  };
}

const encodeReply = loadEncoder();

/** Installed RSC encoding and Next's full form-data key framing for our nonbinary planner data. */
export async function planCacheKey(value: unknown): Promise<string> {
  const encoded = await encodeReply(value);

  if (typeof encoded === "string") {
    return encoded;
  }

  return [...encoded]
    .map(([key, entry]) => {
      if (typeof entry !== "string") {
        throw new TypeError("The planner input must not contain binary request data");
      }

      return `${key.length.toString(HEX_RADIX)}:${key}${entry.length.toString(HEX_RADIX)}:${entry}`;
    })
    .join("");
}
