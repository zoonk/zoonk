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
    default:
      return question satisfies never;
  }
}

export function useProfileQuestionDescription(question: ProfileQuestion): string {
  const t = useExtracted();

  switch (question) {
    case "work":
      return t("We'll use situations from your day in your examples.");
    case "tools":
      return t("Pick up to 3. We'll use them in your examples.");
    case "studies":
      return t("Past or present, finished or not. It can be different from your work.");
    case "conditions":
      return t(
        "Optional. What you pick is saved to your profile so your buddy can adapt to you. You can remove it anytime in Settings.",
      );
    case "learningSupport":
      return t("Pick anything that helps. No label or diagnosis needed.");
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
