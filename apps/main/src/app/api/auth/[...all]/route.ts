import { toNextJsHandler } from "@zoonk/auth/next";
import { auth } from "@/lib/auth";

export const { POST, GET } = toNextJsHandler(auth);
