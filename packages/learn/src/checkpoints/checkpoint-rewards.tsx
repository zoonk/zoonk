"use client";

import { BrainIcon, FlagIcon, GlassesIcon, SearchCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BuddyGlassesName } from "../buddies/buddy-labels";
import { useBuddyName } from "../buddies/use-buddy-name";
import { useCheckpointScreen } from "./checkpoint-context";
import { phaseNumber, usePhaseLabel } from "./checkpoint-labels";

type RewardItem = { detail: string; icon: React.ReactNode; key: string; title: React.ReactNode };

const ICON_CLASS = "size-5";

/**
 * What a checkpoint is worth, said before it starts and shown again when it's won: Brain Power,
 * the phase it checks off, the "Trap hunter" badge and, the first time, glasses for the buddy.
 */
function useRewardItems(): RewardItem[] {
  const t = useExtracted();
  const format = useFormatter();
  const { checkpoint, buddy } = useCheckpointScreen();
  const { reward } = checkpoint;
  const phase = phaseNumber(checkpoint);
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  const phaseLabel = usePhaseLabel();

  const brainPower: RewardItem = {
    detail: t("Brain Power"),
    icon: <BrainIcon aria-hidden="true" className={ICON_CLASS} />,
    key: "brainPower",
    title: t("+{points}", { points: format.number(reward.brainPower) }),
  };

  const phaseItem: RewardItem | null = reward.phaseComplete
    ? {
        detail: checkpoint.nextPhase
          ? t("Next: {phase}", { phase: phaseLabel(checkpoint.nextPhase) })
          : t("The plan's last phase"),
        icon: <FlagIcon aria-hidden="true" className={ICON_CLASS} />,
        key: "phase",
        title: phase ? t("Phase {phase} complete", { phase }) : t("Phase complete"),
      }
    : null;

  const badge: RewardItem | null = reward.badge
    ? {
        detail: t("in your logbook"),
        icon: <SearchCheckIcon aria-hidden="true" className={ICON_CLASS} />,
        key: "badge",
        title: t("Trap hunter badge"),
      }
    : null;

  const glasses: RewardItem | null =
    reward.glasses && buddy
      ? {
          detail: t("Glasses for {buddy}", { buddy: buddyName }),
          icon: <GlassesIcon aria-hidden="true" className={ICON_CLASS} />,
          key: "glasses",
          title: <BuddyGlassesName glasses={reward.glasses} />,
        }
      : null;

  return [brainPower, phaseItem, badge, glasses].filter((item) => item !== null);
}

/** Fun's "If you win" tiles before a boss, or the rewards as rows once it's won. */
export function CheckpointRewards({
  layout,
  withBrainPower = true,
}: {
  layout: "rows" | "tiles";
  /** The result shows the Brain Power actually earned on its own, answers included. */
  withBrainPower?: boolean;
}) {
  const items = useRewardItems().filter((item) => withBrainPower || item.key !== "brainPower");

  if (items.length === 0) {
    return null;
  }

  if (layout === "tiles") {
    return (
      <ul className="grid auto-cols-fr grid-flow-col gap-2" data-slot="checkpoint-rewards">
        {items.map((item) => (
          <li
            className="flex min-w-0 flex-col items-center gap-1 text-center wrap-break-word hyphens-auto"
            key={item.key}
          >
            <span className="bg-fun-soft text-fun-accent-violet flex size-10 items-center justify-center rounded-full">
              {item.icon}
            </span>
            <span className="font-fun-display text-xs font-semibold sm:text-sm">{item.title}</span>
            <span className="text-fun-fg2 text-xs">{item.detail}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col" data-slot="checkpoint-rewards">
      {items.map((item) => (
        <li
          className="border-border flex items-start gap-3 border-b py-3 last:border-b-0"
          key={item.key}
        >
          <span className="bg-muted text-foreground in-data-[mode=fun]:text-fun-accent-violet flex size-10 shrink-0 items-center justify-center rounded-full">
            {item.icon}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="in-data-[mode=fun]:font-fun-display font-semibold">{item.title}</span>
            <span className="text-muted-foreground text-sm">{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
