import { auth } from "@zoonk/auth";
import { toNextJsHandler } from "@zoonk/auth/next";

export const { POST, GET } = toNextJsHandler(auth);
