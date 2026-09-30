"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { BotIcon, CalendarClockIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "../../_components/lesson-rich-text";
import { type StepOf } from "../lesson-step-view-props";
import { type ChallengeNames } from "./use-challenge-names";

type ChallengeContent = StepOf<"challenge">["content"];
type ChallengePanel = ChallengeContent["panels"][number];
type ChallengeMessage = ChallengeContent["nodes"][number]["messages"][number];
type ChallengeSlot = ChallengeContent["team"][number];

/** A small label above a group, like "Your mission" or "Your team"; a heading when it names one. */
export function ChallengeLabel({
  as: Tag = "p",
  children,
  className,
  id,
}: {
  as?: "h3" | "p";
  children: string;
  className?: string;
  id?: string;
}) {
  return (
    <Tag
      className={cn("text-muted-foreground text-xs font-medium tracking-wide uppercase", className)}
      id={id}
    >
      {children}
    </Tag>
  );
}

/** A colleague's initial, or a robot for the AI assistant. */
export function ChallengeAvatar({ name, slot }: { name: string; slot: ChallengeSlot | undefined }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        slot?.ai ? "bg-foreground text-background" : "bg-muted text-foreground",
      )}
    >
      {slot?.ai ? <BotIcon className="size-4" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** The numbers a decision rests on: labeled values with an optional line under them. */
export function ChallengePanelView({
  fill,
  panel,
}: {
  fill: (text: string) => string;
  panel: ChallengePanel;
}) {
  return (
    <div
      className="border-border flex w-full flex-col gap-3 rounded-2xl border p-4"
      data-slot="challenge-panel"
    >
      {panel.title && <ChallengeLabel>{fill(panel.title)}</ChallengeLabel>}

      <dl className={cn("grid gap-4", panel.metrics.length > 1 && "grid-cols-2")}>
        {panel.metrics.map((metric) => (
          <div className="flex min-w-0 flex-col gap-0.5" key={metric.label}>
            <dt className="text-muted-foreground text-xs">{fill(metric.label)}</dt>
            {/* A note sits beside a short value and moves under a long one ("4 rolos de 12 m"). */}
            <dd className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="text-foreground text-2xl font-semibold text-balance tabular-nums">
                {metric.value}
              </span>
              {metric.note && (
                <span className="text-muted-foreground text-xs">{fill(metric.note)}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      {panel.note && (
        <p className="text-muted-foreground text-xs leading-relaxed">
          <LessonRichText text={fill(panel.note)} />
        </p>
      )}
    </div>
  );
}

/** One line from a colleague, with who said it and their role. */
export function ChallengeMessageView({
  message,
  names,
  slots,
}: {
  message: ChallengeMessage;
  names: ChallengeNames;
  slots: readonly ChallengeSlot[];
}) {
  const slot = slots.find((item) => item.id === message.from);
  const name = names.names[message.from] ?? message.from;
  const role = slot && !slot.ai ? names.fill(slot.role) : null;

  return (
    <li className="flex gap-3" data-slot="challenge-message">
      <ChallengeAvatar name={name} slot={slot} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm">
          <span className="text-foreground font-semibold">{name}</span>
          {role && (
            <span className="text-muted-foreground before:mx-1 before:content-['·']">{role}</span>
          )}
        </p>
        <p className="text-foreground text-base leading-relaxed">
          <LessonRichText text={names.fill(message.text)} />
        </p>
      </div>
    </li>
  );
}

/** What the learner decided, as their reply in the conversation. */
export function ChallengePickView({ text }: { text: string }) {
  const t = useExtracted();

  return (
    <li className="flex justify-end" data-slot="challenge-pick">
      <p className="bg-primary text-primary-foreground max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-relaxed">
        <span className="sr-only">{`${t("You:")} `}</span>
        <LessonRichText text={text} />
      </p>
    </li>
  );
}

/** Time passes in the case: "One week later", with the new numbers. */
export function ChallengeTimeJump({
  fill,
  jump,
}: {
  fill: (text: string) => string;
  jump: NonNullable<ChallengeContent["nodes"][number]["choices"][number]["timeJump"]>;
}) {
  return (
    <li className="flex flex-col gap-3" data-slot="challenge-time-jump">
      <p className="text-muted-foreground before:bg-border after:bg-border flex items-center gap-3 text-sm before:h-px before:flex-1 after:h-px after:flex-1">
        <CalendarClockIcon aria-hidden="true" className="size-4" />
        {fill(jump.label)}
      </p>
      {jump.panel && <ChallengePanelView fill={fill} panel={jump.panel} />}
    </li>
  );
}
