"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { Button } from "@zoonk/ui/components/button";
import { CrosshairIcon, FastForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import { PlusNotice } from "../_components/plus-lock";
import {
  type TestOutStart,
  TestOutStartStatus,
  useTestOutStart,
} from "../_components/test-out-start-link";
import { PracticeConversation } from "../language/unit/practice-conversation";
import { useMockEntryDescription } from "../mock/mock-entry";
import {
  EssayOffer,
  MistakesOffer,
  PlaceOffer,
  PlusOffer,
  PronunciationOffer,
  StartGoalOffer,
} from "./tutor-feature-offers";
import { OfferCard, OfferLink } from "./tutor-offer-card";

/**
 * How the host opens the features the buddy offers: where each one lives (a new goal with the
 * learner's words, a catalog course, a written test's subject page), and the two that start in
 * place: a chapter's test (asking for its questions, then opening it) and a unit's practice call
 * (false when it didn't start). Plus opens the host's `upgrade` route.
 */
export type TutorToolActions = {
  hrefs: {
    chooseFocus: string;
    chooseMock: string;
    course: (course: { brandSlug: string; slug: string }) => string;
    logbook: string;
    memory: string;
    mistakes: string;
    pronunciation: string;
    startGoal: (goal: string) => string;
    stats: string;
    subject: (key: string) => string;
  };
  startConversation: (input: {
    chapterId: string;
    goalId: string;
    minutes: number;
  }) => Promise<boolean>;
  startTestOut: (input: { chapterId: string; goalId: string }) => Promise<TestOutStart>;
};

function ChapterTestOffer({
  actions,
  offer,
}: {
  actions: TutorToolActions;
  offer: Extract<TutorToolOffer, { kind: "chapterTest" }>;
}) {
  const t = useExtracted();
  const { chapterId, goalId } = offer;
  const test = useTestOutStart(() => actions.startTestOut({ chapterId, goalId }));

  return (
    <OfferCard
      description={t(
        "{lessons, plural, one {Pass it to skip # lesson you already know.} other {Pass it to skip up to # lessons you already know.}}",
        { lessons: offer.lessonsLeft },
      )}
      tile={<KindTile icon={FastForwardIcon} kind="challenge" size="sm" />}
      title={t("Test: {chapter}", { chapter: offer.chapterTitle })}
    >
      <Button
        className="self-start"
        disabled={test.opening}
        focusableWhenDisabled
        onClick={test.start}
        variant="outline"
      >
        {test.opening ? t("Opening the test…") : t("Take the test")}
      </Button>
      <TestOutStartStatus isPending={test.isPending} result={test.result} />
    </OfferCard>
  );
}

function ChooseFocusOffer({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <OfferCard
      description={t(
        "Pick the subjects that get more depth, or take a short test that picks them.",
      )}
      tile={<KindTile icon={CrosshairIcon} kind="challenge" size="sm" />}
      title={t("Choose where to focus")}
    >
      <OfferLink href={href}>{t("Choose")}</OfferLink>
    </OfferCard>
  );
}

function ConversationCallOffer({
  actions,
  offer,
}: {
  actions: TutorToolActions;
  offer: Extract<TutorToolOffer, { kind: "conversationCall" }>;
}) {
  const t = useExtracted();
  const { character } = offer.call;

  return (
    <OfferCard
      description={
        character
          ? t("A short call out loud with {name}, {role}.", {
              name: character.name,
              role: character.role,
            })
          : t("A short call out loud, at your level.")
      }
      tile={<KindTile kind="conversation" size="sm" />}
      title={offer.unitTitle}
    >
      <PracticeConversation
        conversation={offer.call}
        onStart={(minutes) =>
          actions.startConversation({ chapterId: offer.chapterId, goalId: offer.goalId, minutes })
        }
      />
    </OfferCard>
  );
}

/** Choosing a mock to take now; for a plan without mock exams, the same card with Plus's notice. */
function MockExamOffer({
  href,
  offer,
}: {
  href: string;
  offer: Extract<TutorToolOffer, { kind: "mockExam" }>;
}) {
  const t = useExtracted();
  const locked = offer.access === "plusRequired";

  // What the mocks are, the same for every plan; the notice says what it takes.
  const description = useMockEntryDescription({ bySubject: offer.subjects.length > 0 });

  return (
    <OfferCard
      description={description}
      locked={locked}
      tile={<KindTile kind="mock" size="sm" />}
      title={t("Take a mock exam")}
    >
      {locked ? (
        <PlusNotice inset>
          {t("Mock exams come with Plus: whenever you want, and every week in your plan.")}
        </PlusNotice>
      ) : (
        <OfferLink href={href}>{t("Choose")}</OfferLink>
      )}
    </OfferCard>
  );
}

/**
 * One of the app's own features the buddy offered under its answer, as a card with the button
 * that opens it, or locked with Plus's notice when the learner's plan doesn't include it: starting
 * a new goal (with the catalog's course for it), a chapter's test, choosing where the plan's depth
 * goes, a mock exam, the exam's written test, the mistakes notebook, a practice call, words to say
 * again, statistics, the week in review, memory, or Plus.
 */
export function TutorToolOfferCard({
  actions,
  offer,
}: {
  actions: TutorToolActions;
  offer: TutorToolOffer;
}) {
  const { hrefs } = actions;

  switch (offer.kind) {
    case "startGoal":
      return (
        <StartGoalOffer
          hrefs={{ course: hrefs.course, start: hrefs.startGoal(offer.goal) }}
          offer={offer}
        />
      );
    case "chapterTest":
      return <ChapterTestOffer actions={actions} offer={offer} />;
    case "chooseFocus":
      return <ChooseFocusOffer href={hrefs.chooseFocus} />;
    case "mockExam":
      return <MockExamOffer href={hrefs.chooseMock} offer={offer} />;
    case "essay":
      return <EssayOffer href={hrefs.subject(offer.subjectKey)} offer={offer} />;
    case "mistakes":
      return <MistakesOffer href={hrefs.mistakes} offer={offer} />;
    case "conversationCall":
      return <ConversationCallOffer actions={actions} offer={offer} />;
    case "pronunciation":
      return <PronunciationOffer href={hrefs.pronunciation} offer={offer} />;
    case "stats":
    case "logbook":
    case "memory":
      return <PlaceOffer href={hrefs[offer.kind]} kind={offer.kind} />;
    case "plus":
      return <PlusOffer offer={offer} />;
    default:
      return offer satisfies never;
  }
}
