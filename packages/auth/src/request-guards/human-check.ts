import { getBotIdVerification } from "./bot-id";

export async function isHumanRequest(): Promise<boolean> {
  const { isBot } = await getBotIdVerification();

  return !isBot;
}
