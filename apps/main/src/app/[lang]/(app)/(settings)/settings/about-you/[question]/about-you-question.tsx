"use client";

import { useRouter } from "@/i18n/navigation";
import { getPageLanguage } from "@/i18n/page-language";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { type ProfileQuestionView } from "@zoonk/core/profile/questions/contract";
import { AboutYouQuestionScreen } from "@zoonk/learn/about-you/question";
import { answerProfileQuestionAction } from "../actions";

export function AboutYouQuestion(props: { memoryEnabled: boolean; question: ProfileQuestionView }) {
  const router = useRouter();

  return (
    <AboutYouQuestionScreen
      {...props}
      onSave={async (input) => {
        const answered = await answerHere(
          answerProfileQuestionAction(input, getPageLanguage()),
          openingHere(),
        );

        if (typeof answered === "string") {
          return answered === "left";
        }

        const saved = answered.answer;

        if (saved) {
          router.push("/settings/about-you");
        }

        return saved;
      }}
    />
  );
}
