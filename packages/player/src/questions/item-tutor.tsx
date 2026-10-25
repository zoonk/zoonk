"use client";

import { type TutorItem } from "@zoonk/learn/question-tutor";
import { useTaskAsideShown } from "@zoonk/learn/task-header";
import { type TutorIdentity, useTutorIdentity } from "@zoonk/learn/tutor-identity";
import { Button } from "@zoonk/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { MessageCircleQuestionIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { createContext, use, useMemo, useState } from "react";
import { type LessonTutorConfig } from "../lesson/tutor/lesson-tutor-context";
import { type LessonQuestionContext } from "./lesson-question-context";
import { type LessonQuestionNavigation } from "./lesson-question-navigation";
import { LessonQuestionDrawer } from "./lesson-question-panel";
import {
  LessonQuestionHostProvider,
  useLessonQuestionController,
} from "./lesson-question-provider";
import { type OfferedSuggestion } from "./lesson-question-state";
import { isSameDraftContext } from "./lesson-question-state-helpers";

/** The learner's buddy for the question in view, and ways to ask it about the question. */
export type ItemBuddy = {
  /** Sends a question from the aside's composer or a suggestion, and shows the conversation there. */
  ask: (question: OfferedSuggestion) => void;
  close: () => void;
  context: Extract<LessonQuestionContext, { kind: "item" }>;
  /** The conversation shows in the aside, beside the question; a drawer covers part of it instead. */
  docked: boolean;
  identity: TutorIdentity;
  item: TutorItem;
  navigation: LessonQuestionNavigation;
  /** Opens the conversation: docked in the aside on a wide screen, in a drawer otherwise. */
  open: () => void;
};

const ItemTutorContext = createContext<ItemBuddy | null>(null);

/** The buddy for the question in view; null between questions, or without a tutor. */
export function useItemBuddy(): ItemBuddy | null {
  return use(ItemTutorContext);
}

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

/** Where the conversation shows, chosen when it opens: docked in the aside from `lg`, or a drawer. */
type ItemTutorPresentation = "dock" | "drawer";

function ItemTutorInteraction({
  children,
  identity,
  item,
  navigation,
}: {
  children: React.ReactNode;
  identity: TutorIdentity;
  item: TutorItem | null;
  navigation: LessonQuestionNavigation;
}) {
  const controller = useLessonQuestionController();
  const asideShown = useTaskAsideShown();
  const [presentation, setPresentation] = useState<ItemTutorPresentation>("drawer");
  const { close, open, state } = controller;
  const askAbout = controller.ask;
  const docked = state.isOpen && presentation === "dock";
  const inDrawer = state.isOpen && presentation === "drawer";

  const buddy = useMemo<ItemBuddy | null>(() => {
    if (!item) {
      return null;
    }

    const context = {
      answered: item.answered,
      blockId: item.blockId,
      itemId: item.itemId,
      kind: "item" as const,
    };

    return {
      ask: ({ question, suggestion }) => {
        // A draft in the aside's composer is the learner's, so it stays until it's sent.
        if (!docked || !isSameDraftContext({ current: state.context, next: context })) {
          setPresentation("dock");
          open(context, { keepDraft: true });
        }

        void askAbout({ context, question, suggestion });
      },
      close,
      context,
      docked,
      identity,
      item,
      navigation,
      open: () => {
        setPresentation(asideShown ? "dock" : "drawer");
        open(context, { keepDraft: asideShown });
      },
    };
  }, [askAbout, asideShown, close, docked, identity, item, navigation, open, state.context]);

  return (
    <ItemTutorContext value={buddy}>
      {children}
      {item && (
        <LessonQuestionDrawer
          identity={identity}
          navigation={navigation}
          open={inDrawer}
          quote={<ItemQuote item={item} />}
        />
      )}
    </ItemTutorContext>
  );
}

/**
 * The learner's buddy for a run of questions (a session's block, mistakes practice), about the
 * question in view: a drawer that quotes it on phones and tablets in portrait, docked in the aside
 * from `lg`. Opening it reads the question's conversation, and from `lg`, where its composer waits
 * in the aside, it's read ahead, as a lesson's screen's is; only what the learner sends is
 * answered. Between questions (`item` null) nothing asks.
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
      <ItemTutorInteraction identity={identity} item={item} navigation={tutor.navigation}>
        {children}
      </ItemTutorInteraction>
    </LessonQuestionHostProvider>
  );
}

/**
 * One quiet way to ask the buddy about the question in view, beside the run's main action: an icon,
 * and "Ask {buddy}" in words after a missed answer, when asking helps most. From `lg` the buddy's
 * composer is in the aside, so the bar leaves it out.
 */
export function ItemAskButton() {
  const t = useExtracted();
  const buddy = useItemBuddy();

  if (!buddy) {
    return null;
  }

  const label = t("Ask {name}", { name: buddy.identity.name });

  if (buddy.item.missed) {
    return (
      <Button className="lg:hidden" onClick={buddy.open} size="lg" type="button" variant="outline">
        <MessageCircleQuestionIcon aria-hidden="true" />
        {label}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        onClick={buddy.open}
        render={
          <Button
            className="size-11 shrink-0 lg:hidden"
            size="icon"
            type="button"
            variant="outline"
          />
        }
      >
        <MessageCircleQuestionIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
