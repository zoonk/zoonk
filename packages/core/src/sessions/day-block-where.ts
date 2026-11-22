import "server-only";
import { AnyNull } from "@zoonk/db";

export const DAY_BLOCK_WHERE = {
  OR: [
    { payload: { equals: AnyNull, path: ["extra"] } },
    { NOT: { payload: { equals: true, path: ["extra"] } } },
  ],
};
