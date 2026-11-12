"use client";

import { useExtracted } from "next-intl";
import { type ProfileQuestion } from "./profile-draft";

export function useProfileQuestionTitle(question: ProfileQuestion): string {
  const t = useExtracted();

  switch (question) {
    case "work":
      return t("What do you do now?");
    case "tools":
      return t("Which apps and tools do you use most?");
    case "studies":
      return t("What have you studied?");
    case "watch":
      return t({
        description: "Shows, films, sports or videos. Translate as a natural question.",
        message: "What do you like to watch?",
      });
    case "listen":
      return t({
        description: "Music, podcasts or audiobooks. Translate as a natural question.",
        message: "What do you like to listen to?",
      });
    case "play":
      return t({
        description:
          "Sports and games, not instruments: music has its own option elsewhere. Translate as a natural question.",
        message: "What do you like to play?",
      });
    case "read":
      return t({
        description: "Books, news, comics or sites. Translate as a natural question.",
        message: "What do you like to read?",
      });
    case "activities":
      return t({
        description:
          "Hobbies and things the learner does for fun. Translate as a natural question.",
        message: "What do you like to do?",
      });
    case "conditions":
      return t({
        description: "Asks about health conditions or disabilities that affect learning.",
        message: "Do any of these apply to you?",
      });
    case "learningSupport":
      return t("What helps you learn?");
    case "addressForm":
      return t({
        description:
          "Asks which grammatical forms (feminine, masculine or neutral wording) the app should use for words about the learner, such as 'you're right'. Not a question about pronouns or identity. Translate as a natural, friendly question.",
        message: "How should we address you?",
      });
    default:
      return question satisfies never;
  }
}

export function useProfileQuestionDescription({
  nextIsSupport = false,
  question,
}: {
  nextIsSupport?: boolean;
  question: ProfileQuestion;
}): string {
  const t = useExtracted();

  switch (question) {
    case "work":
      return t("We'll use situations from your day in your examples.");
    case "tools":
      return t("Pick up to 3. We'll use them in your examples.");
    case "studies":
      return t("Past or present, finished or not. It can be different from your work.");
    case "conditions":
      return nextIsSupport
        ? t(
            "Optional. We'll suggest what often helps on the next screen. Nothing here is saved unless you choose to.",
          )
        : t("Optional. Nothing here is saved unless you choose to.");
    case "learningSupport":
      return t("Pick anything that helps. No label or diagnosis needed.");
    case "addressForm":
      return t("Your buddy and your feedback will talk to you this way. Lessons stay the same.");
    case "watch":
    case "listen":
    case "play":
    case "read":
    case "activities":
      return t("Pick up to 3. We'll use them for examples in your lessons.");
    default:
      return question satisfies never;
  }
}
