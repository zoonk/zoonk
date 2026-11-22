"use client";

import { type SuggestedDailyTime } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import {
  SuggestionAction,
  SuggestionActions,
  SuggestionDescription,
  SuggestionLinkAction,
} from "../_components/suggestion";
import { useSharedMark, useSharedState } from "./layout-shared";
import { usePlanScreen } from "./plan-context";
import { useFocusTestOfferHref, useTakeFocusTestLabel } from "./plan-focus-test";
import {
  CheckingChange,
  type CoverageOffer,
  type Intent,
  OfferPreview,
  OtherOptions,
  getGoalDateMove,
  useApplyPreview,
  useDateOffer,
  useSuggestedTimeOffer,
} from "./plan-offer-preview";
import { currentPlanPreview } from "./plan-preview-state";
import {
  PlanChangeSuggestion,
  type SlotItem,
  type SlotPreview,
  usePlanSuggestionSlot,
} from "./plan-suggestion-context";
import { useTimeToCover, useTimeToCoverTexts } from "./use-time-to-cover";

/** Moving the date is asked for (it plans the goal many times), so only its answer is waited on. */
function useDateAsk(intent: Intent) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const dateOffer = useDateOffer();
  const finder = useTimeToCover();
  const { status } = finder.state;
  const asked = intent === "date";
  const offer = asked && finder.answered ? dateOffer(finder.answered) : null;
  const retry = asked && (status === "failed" || status === "building");
  const noDate = asked && finder.answered !== null && offer === null;
  const failed = status === "building" ? texts.building : t("We couldn't check what changes.");

  return {
    /** No date covers everything once asked, so the menu stops offering it. */
    dateless: finder.answered !== null && finder.answered.fittingDate === null,
    offer,
    pending: asked && status === "pending",
    retry,
    status: (retry && failed) || (noDate && texts.noDate) || "",
  };
}

function CoverageBody({
  ask,
  canMoveDate,
  offer,
  onApply,
  onStop,
  pending,
  preview,
  retry,
}: {
  ask: () => void;
  canMoveDate: boolean;
  offer: CoverageOffer | null;
  onApply: () => void;
  onStop: () => void;
  pending: { applying: boolean; asking: boolean };
  preview: SlotPreview;
  retry: boolean;
}) {
  const t = useExtracted();
  const texts = useTimeToCoverTexts();
  const { plan } = usePlanScreen();
  const { requestPreview } = usePlanSuggestionSlot();
  const focusTestHref = useFocusTestOfferHref();
  const takeFocusTest = useTakeFocusTestLabel();

  if (preview.status !== "idle" && offer) {
    return (
      <OfferPreview
        goalDate={getGoalDateMove({
          operations: offer.operations,
          targetDate: plan.schedule.targetDate,
        })}
        onApply={onApply}
        onRetry={() => void requestPreview(offer.operations)}
        pending={pending.applying}
        preview={preview}
      />
    );
  }

  if (pending.asking) {
    return <CheckingChange onCancel={onStop} />;
  }

  return (
    <SuggestionActions
      main={
        // One key for the main action in every state, so the button pressed keeps the keyboard.
        retry ? (
          <SuggestionAction action={ask} key="find">
            {texts.tryAgain}
          </SuggestionAction>
        ) : (
          offer && (
            <SuggestionAction action={() => void requestPreview(offer.operations)} key="find">
              {texts.seeChanges}
            </SuggestionAction>
          )
        )
      }
      menu={<OtherOptions onMoveDate={canMoveDate ? ask : null} />}
    >
      {focusTestHref && (
        <div className="flex flex-col gap-1">
          <SuggestionLinkAction href={focusTestHref} variant="outline">
            {takeFocusTest}
          </SuggestionLinkAction>
          <p className="text-muted-foreground text-sm">
            {t("The Focus test shows what to study most.")}
          </p>
        </div>
      )}
    </SuggestionActions>
  );
}

/** The time the plan suggests, shown only while the learner's own time is below it. */
function SuggestedTimeCard({ suggested }: { suggested: SuggestedDailyTime }) {
  const suggestedTimeOffer = useSuggestedTimeOffer();
  const { goal, plan } = usePlanScreen();
  const finder = useTimeToCover();
  const { preview: storedPreview, requestPreview, setPreview } = usePlanSuggestionSlot();
  const [intent, setIntent] = useSharedState<Intent>("intent", "time");
  const asking = useSharedMark<Intent | null>("asking", null);
  const dateOffer = useDateOffer();
  const date = useDateAsk(intent);
  const timeOffer = suggestedTimeOffer(suggested);
  const shown = date.offer ?? timeOffer;
  const offer = date.retry || date.pending ? null : shown;
  const item: SlotItem = { key: "coverage", kind: "coverage" };
  const { apply, isPending } = useApplyPreview(item);

  const preview = currentPlanPreview({
    operations: offer?.operations ?? [],
    plan,
    state: storedPreview,
  });

  const askDate = async () => {
    asking.write("date");
    setIntent("date");
    setPreview();
    const outcome = await finder.find();
    const asked = outcome.status === "answered" ? dateOffer(outcome.time) : null;

    if (asked && asking.read() === "date") {
      void requestPreview(asked.operations);
    }
  };

  const stopAsking = () => {
    asking.write(null);
    setIntent("time");
  };

  return (
    <PlanChangeSuggestion item={item} title={shown.title}>
      {shown.description.map((line) => (
        <SuggestionDescription key={line}>{line}</SuggestionDescription>
      ))}

      {/* Seen here, heard from the live line under it: said once. */}
      {date.status && (
        <SuggestionDescription aria-hidden="true">{date.status}</SuggestionDescription>
      )}

      {/* Always there, so that what moving the date couldn't find is announced. */}
      <p aria-live="polite" className="sr-only">
        {date.status}
      </p>

      <CoverageBody
        ask={() => void askDate()}
        canMoveDate={goal.kind !== "exam" && !date.dateless && intent === "time"}
        offer={offer}
        onApply={() => apply(preview)}
        onStop={stopAsking}
        pending={{ applying: isPending, asking: date.pending }}
        preview={preview}
        retry={date.retry}
      />
    </PlanChangeSuggestion>
  );
}

export function CoverageSuggestion() {
  const { plan } = usePlanScreen();
  return plan.suggestedTime && <SuggestedTimeCard suggested={plan.suggestedTime} />;
}
