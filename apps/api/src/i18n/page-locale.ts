import "server-only";
import { type SupportedLocale, isValidLocale } from "@zoonk/utils/locale";
import { notFound } from "next/navigation";
import { locale } from "next/root-params";

export async function getAuthPageLocale(): Promise<SupportedLocale> {
  const value = await locale();

  if (!isValidLocale(value)) {
    notFound();
  }

  return value;
}
