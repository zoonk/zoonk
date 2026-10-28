"use client";

import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { Button } from "@zoonk/ui/components/button";
import { CrosshairIcon, FastForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
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
import { OfferCard, OfferLink, OfferTile } from "./tutor-offer-card";

/** `startConversation` resolves to false when the call didn't start. */
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
      tile={
        <OfferTile>
          <FastForwardIcon />
        </OfferTile>
      }
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
      tile={
        <OfferTile>
          <CrosshairIcon />
        </OfferTile>
      }
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
      tile={
        <OfferTile>
          <KindDot kind="conversation" />
        </OfferTile>
      }
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

function MockExamOffer({
  href,
  offer,
}: {
  href: string;
  offer: Extract<TutorToolOffer, { kind: "mockExam" }>;
}) {
  const t = useExtracted();
  const locked = offer.access === "plusRequired";

  const description = useMockEntryDescription({ bySubject: offer.subjects.length > 0 });

  return (
    <OfferCard
      description={description}
      locked={locked}
      tile={
        <OfferTile>
          <KindDot kind="mock" />
        </OfferTile>
      }
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
