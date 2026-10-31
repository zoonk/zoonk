import { isJsonObject } from "@zoonk/utils/json";
import { GOOGLE_PLAY_PACKAGE_NAME, callGoogleApi } from "../google/service-account";

const DECODE_URL = `https://playintegrity.googleapis.com/v1/${GOOGLE_PLAY_PACKAGE_NAME}:decodeIntegrityToken`;

/** Null when Google refuses the token. */
export async function decodePlayIntegrityToken(token: string): Promise<unknown> {
  const response = await callGoogleApi(DECODE_URL, { integrity_token: token });

  if (!response.ok) {
    return null;
  }

  const body: unknown = await response.json();

  return isJsonObject(body) ? body.tokenPayloadExternal : null;
}
