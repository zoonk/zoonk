"use client";

import { type FocusTestOffer } from "@zoonk/core/learner/placement/focus-test-contract";
import { useExtracted } from "next-intl";
import { TestOutcome } from "../onboarding/test-outcome";
import { useTestOfferTexts } from "../placement-test/placement-test-offers";
import { TestOffer, type TestPressed } from "../placement-test/test-offer";
import { type FocusTestHost } from "./focus-test-result";
import { useFocusTestLine, useFocusTestTitle, useSeeResultLabel } from "./use-focus-test-texts";

type OfferChoice = "firstLesson" | "focusTest";

/** Onboarding offers the test beside a first lesson; the Plan offers the test alone. */
export function FocusTestInvitation({
  failed,
  firstLesson,
  host,
  next,
  onShown,
  onSkip,
  onStart,
  pressed,
  suggestsFocus,
}: {
  failed: boolean;
  /** Onboarding's first lesson by its name, where it's known. */
  firstLesson: string | null;
  host: FocusTestHost;
  next: FocusTestOffer;
  onShown: () => void;
  onSkip: () => void;
  onStart: () => void;
  pressed: TestPressed;
  suggestsFocus: boolean;
}) {
  const t = useExtracted();
  const title = useFocusTestTitle();
  const line = useFocusTestLine();
  const texts = useTestOfferTexts();

  const test = texts.test<OfferChoice>({
    label: t("Focus test"),
    minutes: next.minutes,
    questions: next.questions,
    value: "focusTest",
  });

  if (host === "plan") {
    return (
      <TestOffer<OfferChoice>
        cards={[test]}
        description={line.offer(suggestsFocus)}
        failed={failed}
        initial="focusTest"
        onShown={onShown}
        onStart={onStart}
        other={{ label: t("Not now"), onPress: onSkip }}
        pressed={pressed}
        title={title(suggestsFocus)}
      />
    );
  }

  return (
    <TestOffer<OfferChoice>
      cards={[test, texts.firstLesson(firstLesson)]}
      description={line.offer(suggestsFocus)}
      failed={failed}
      initial="focusTest"
      mainLabel={(choice) => (choice === "firstLesson" ? t("Continue") : t("Start"))}
      onShown={onShown}
      onStart={(choice) => (choice === "firstLesson" ? onSkip() : onStart())}
      pressed={pressed}
      title={texts.startTitle}
    />
  );
}

/** A sitting that's over and not closed yet: the learner came back to it, or closing it failed. */
export function FocusTestEnded({
  failed,
  onFinish,
  pending,
}: {
  failed: boolean;
  onFinish: () => void;
  pending: boolean;
}) {
  const t = useExtracted();
  const seeResult = useSeeResultLabel();

  return (
    <TestOutcome
      busy={pending}
      continueLabel={seeResult}
      failed={failed}
      onContinue={onFinish}
      subject={t("Focus test")}
      title={t("Your answers are saved")}
    />
  );
}
