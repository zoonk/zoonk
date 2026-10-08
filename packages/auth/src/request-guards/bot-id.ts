import { isLocalhostSupported } from "@zoonk/utils/environment";
import { checkBotId } from "botid/server";

/** Local and E2E auth accepts requests without BotID proof; avoid the SDK's missing-challenge warning. */
export async function getBotIdVerification() {
  if (isLocalhostSupported()) {
    return { bypassed: true, isBot: false, isHuman: true, isVerifiedBot: false };
  }

  return checkBotId();
}
