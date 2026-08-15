import { getString, isJsonObject } from "@zoonk/utils/json";

export type NativeAppleSession = { token: string; user: { id: string } };

export function isNativeAppleSession(response: unknown): response is NativeAppleSession {
  return (
    isJsonObject(response) &&
    Boolean(getString(response, "token") && getString(response.user, "id"))
  );
}
