import { auth } from "@zoonk/core/auth";
import { toNextJsHandler } from "@zoonk/core/auth/next";

export const { POST, GET } = toNextJsHandler(auth);
