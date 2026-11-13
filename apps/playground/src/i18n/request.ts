import { learnMessages } from "@zoonk/learn/messages";
import { playerMessages } from "@zoonk/player/messages";
import { getRequestConfig } from "next-intl/server";

/** The playground shows the player and learn screens in English, from their own catalogs. */
export default getRequestConfig(async () => {
  const [player, learn] = await Promise.all([playerMessages("en"), learnMessages("en")]);
  return { locale: "en", messages: { ...player, ...learn }, timeZone: "UTC" };
});
