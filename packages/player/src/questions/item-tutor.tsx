"use client";

import { type TutorItem } from "@zoonk/learn/question-tutor";
import { useTaskAsideShown } from "@zoonk/learn/task-header";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { type LessonQuestionContext } from "./lesson-question-context";
import { type LessonQuestionNavigation } from "./lesson-question-navigation";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { TutorBuddyProvider } from "./tutor-buddy";

/**
 * The question asked about, quoted as the drawer's first line, so it stays in view: "About “…”",
 * or "About your answer to “…”" once it's checked.
 */
function ItemQuote({ item }: { item: TutorItem }) {
  const t = useExtracted();
  const question = () => item.text;

  return (
    <p
      className="text-muted-foreground border-input mx-4 mt-3.5 line-clamp-2 border-l-2 pl-2.5 text-xs leading-relaxed"
      data-slot="tutor-quote"
    >
      {item.answered
        ? t.rich("About your answer to “<question></question>”", { question })
        : t.rich("About “<question></question>”", { question })}
    </p>
  );
}

/**
 * The buddy about the question in view, by its place in the run, so a question asked again later
 * opens fresh. After a missed answer, before anything was asked about it, the aside offers two
 * questions to send in one tap.
 */
function ItemBuddy({
  children,
  context,
  identity,
  item,
  navigation,
}: {
  children: React.ReactNode;
  context: LessonQuestionContext;
  identity: TutorIdentity;
  item: TutorItem | null;
  navigation: LessonQuestionNavigation;
}) {
  const { questions } = useLessonQuestionController().state;
  const missed = item?.missed ?? false;

  return (
    <TutorBuddyProvider
      context={item && context}
      identity={identity}
      missed={missed}
      navigation={navigation}
      quote={item && <ItemQuote item={item} />}
      suggests={missed && questions.length === 0}
      visit={item ? `${item.position}:${item.itemId}` : ""}
    >
      {children}
    </TutorBuddyProvider>
  );
}

/**
 * The learner's buddy for a run of questions (a session's block, mistakes practice), about the
 * question in view: a drawer that quotes it on phones and tablets in portrait, docked in the aside
 * from `lg` (`TutorDock`). Opening it reads the question's conversation, and from `lg`, where its
 * composer waits in the aside, it's read ahead, as a lesson's screen's is; only what the learner
 * sends is answered. Between questions (`item` null) nothing asks.
 */
export function ItemTutor({
  children,
  item,
  tutor,
}: {
  children: React.ReactNode;
  item: TutorItem | null;
  tutor: LessonTutorConfig;
}) {
  const identity = useTutorIdentity(tutor.buddy);
  const asideShown = useTaskAsideShown();
  const itemId = item?.itemId ?? "";
  const target = useMemo(() => ({ itemId, kind: "item" as const }), [itemId]);

  const activeContext = useMemo<LessonQuestionContext>(
    () => ({
      answered: item?.answered ?? false,
      blockId: item?.blockId ?? null,
      itemId,
      kind: "item",
    }),
    [item?.answered, item?.blockId, itemId],
  );

  return (
    <LessonQuestionHostProvider
      connection={tutor.connection}
      host={{
        activeContext,
        canAskQuestions: tutor.canAsk && item !== null,
        lessonStepIds: [],
        preload: asideShown,
      }}
      target={target}
    >
      <ItemBuddy
        context={activeContext}
        identity={identity}
        item={item}
        navigation={tutor.navigation}
      >
        {children}
      </ItemBuddy>
    </LessonQuestionHostProvider>
  );
}
