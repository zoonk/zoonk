"use client";

import { type LanguageReasonView } from "@zoonk/core/language/aims";
import { useExtracted } from "next-intl";

export function useReasonCopy() {
  const t = useExtracted();

  return (
    view: Pick<LanguageReasonView, "aim" | "reason">,
  ): { description: string; label: string } => {
    switch (view.reason) {
      case "travel":
        return {
          description: t("Get by on trips: order, ask the way, small talk"),
          label: t({ description: "A reason to learn a language: to travel.", message: "Travel" }),
        };
      case "talk":
        return {
          description: t("Everyday conversations, at home or abroad"),
          label: t("Talk with people"),
        };
      case "work":
        return {
          description: t("Meetings, interviews and classes"),
          label: t("Work or study in it"),
        };
      case "fluent":
        return {
          description: t("Talk about almost anything with ease"),
          label: t("Speak it fluently"),
        };
      case "certificate":
        return { description: t("IELTS, DELE, CELI and others"), label: t("Pass a certificate") };
      case "other":
        return {
          description: t("In your own words. Aims for {level}", { level: view.aim ?? "" }),
          label: t("Something else"),
        };
      default:
        return view.reason satisfies never;
    }
  };
}
