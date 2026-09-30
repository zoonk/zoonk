"use client";

import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { GenerationTimelineProgress } from "@zoonk/ui/components/generation-timeline";
import { useAnimatedProgress } from "@zoonk/ui/hooks/animated-progress";
import { useTakingLong } from "@zoonk/ui/hooks/taking-long";
import { EllipsisIcon, FeatherIcon, LayersIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { LessonHelpLimitNotice } from "../_components/help-limit-notice";
import { LessonBody } from "../_components/lesson-step-text";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type StepVariantKind } from "../lesson-player-types";
import { WorkedExampleContent } from "../steps/worked-example-content";
import { VARIANT_BOUNDS, type VariantState } from "./use-step-variant";

/** How long a new version usually takes to write (3 to 8 seconds on real runs): the bar's pace. */
const VARIANT_ESTIMATED_MS = 5000;
const FULL = 100;

/**
 * A version being written: the bar moves at the pace versions take and fills once it's here; one
 * that takes longer than usual says so, and the sheet shows it as soon as it arrives.
 */
function VariantWriting() {
  const t = useExtracted();
  const locale = useLocale();
  const isSlow = useTakingLong({ active: true, afterMs: VARIANT_BOUNDS.slowMs });

  const value = useAnimatedProgress({
    active: true,
    estimatedMs: VARIANT_ESTIMATED_MS,
    progress: 0,
    target: FULL,
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm" role="status">
        {isSlow
          ? t("Still writing. This is taking longer than usual.")
          : t("Writing this version for you. It takes a few seconds.")}
      </p>
      <GenerationTimelineProgress
        aria-label={t("Writing this version")}
        locale={locale}
        value={value}
      />
    </div>
  );
}

function VariantContent({ onRetry, state }: { onRetry: () => void; state: VariantState }) {
  const t = useExtracted();

  if (state.status === "loading" || state.status === "idle") {
    return <VariantWriting />;
  }

  if (state.status === "slowDown" || state.status === "limitReached") {
    return <LessonHelpLimitNotice limit={state} />;
  }

  if (state.status === "unsupported") {
    return (
      <p className="text-muted-foreground">
        {t("This screen is already as simple and as deep as it gets.")}
      </p>
    );
  }

  if (state.status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3" role="alert">
        <p className="text-muted-foreground text-base">
          {t("We couldn't write this version right now.")}
        </p>
        <Button onClick={onRetry} size="sm" variant="outline">
          {t("Try again")}
        </Button>
      </div>
    );
  }

  if ("steps" in state.content) {
    return <WorkedExampleContent content={state.content} revealed={state.content.steps.length} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {state.content.title && (
        <p className="text-muted-foreground font-medium">{state.content.title}</p>
      )}
      <LessonBody>{state.content.text}</LessonBody>
    </div>
  );
}

/**
 * The version's own "…" menu, with the same votes as the screen's, so "Not helpful" on a simpler
 * version reaches that version rather than the screen under it.
 */
function VariantMenu({ variantId }: { variantId: string }) {
  const t = useExtracted();
  const { slots } = useLessonPlayerConfig();

  if (!slots.screenMenuItems) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button className="shrink-0" size="icon" variant="ghost" />}>
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("Version options")}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        {slots.screenMenuItems({ contentId: variantId, contentKind: "stepVariant" })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The same idea, simpler or deeper, over the lesson without leaving it. Closing returns to the
 * original screen exactly where it was.
 */
export function DepthSheet({
  kind,
  onOpenChange,
  onRetry,
  state,
}: {
  kind: StepVariantKind | null;
  onOpenChange: (open: boolean) => void;
  /** Asks for the version again after it failed or took too long. */
  onRetry: () => void;
  state: VariantState;
}) {
  const t = useExtracted();
  const { skin } = useLessonPlayerConfig();

  return (
    <Drawer onOpenChange={onOpenChange} open={kind !== null}>
      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-2">
          <DrawerTitle className="flex items-center gap-2 text-lg font-semibold">
            {kind === "deeper" ? (
              <LayersIcon aria-hidden="true" className="size-5" />
            ) : (
              <FeatherIcon aria-hidden="true" className="size-5" />
            )}
            {kind === "deeper" ? t("Go deeper") : t("Simpler")}
          </DrawerTitle>

          {state.status === "ready" && <VariantMenu variantId={state.id} />}
        </DrawerHeader>

        <DrawerContent className="flex flex-col gap-6 text-lg leading-relaxed">
          <VariantContent onRetry={onRetry} state={state} />
          <Button
            className="w-full"
            onClick={() => onOpenChange(false)}
            size="lg"
            variant={skin.primaryVariant}
          >
            {t("Got it")}
          </Button>
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
