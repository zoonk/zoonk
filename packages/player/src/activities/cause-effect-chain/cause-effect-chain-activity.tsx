"use client";

import { useFormatNumber } from "@zoonk/learn/format-number";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ActivityCanvas,
  ActivityCanvasLabel,
  ActivityTextAlternative,
} from "../_components/activity-canvas";
import { type ActivityRendererProps } from "../activity-renderer";
import { ARC_GUTTER, CauseEffectArcs } from "./cause-effect-arcs";
import { CauseEffectLinkList } from "./cause-effect-link-list";
import { type Link, compareLinks, hasLink, orderNodes, toggleLink } from "./cause-effect-links";
import { useCardCenters } from "./use-card-centers";

type CauseEffectProps = ActivityRendererProps<"causeEffectChain">;
type ChainNode = CauseEffectProps["content"]["fields"]["nodes"][number];

function NodeCard({
  cardRef,
  disabled,
  isCandidate,
  isCause,
  node,
  onCancel,
  onPress,
  yearLabel,
}: {
  cardRef: (element: HTMLElement | null) => void;
  disabled: boolean;
  isCandidate: boolean;
  isCause: boolean;
  node: ChainNode;
  /** Escape drops a picked cause instead of leaving the lesson. Returns whether it did. */
  onCancel: () => boolean;
  onPress: () => void;
  yearLabel: string | null;
}) {
  const t = useExtracted();

  return (
    <li ref={cardRef}>
      <button
        aria-pressed={isCause}
        className={cn(
          "bg-background focus-visible:ring-ring/50 flex min-h-11 w-full flex-col items-start gap-0.5 rounded-2xl border px-3 py-2 text-left outline-none focus-visible:ring-[3px] motion-safe:transition-colors",
          isCause && "border-viz-highlight ring-viz-highlight/30 ring-2",
          isCandidate && "hover:border-viz-highlight border-dashed",
          !disabled && !isCause && !isCandidate && "hover:bg-accent",
        )}
        disabled={disabled}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key === "Escape" && onCancel()) {
            event.stopPropagation();
          }
        }}
        type="button"
      >
        {(yearLabel || isCause) && (
          <span className="text-muted-foreground flex gap-2 text-xs tabular-nums">
            {yearLabel}
            {isCause && <span className="text-viz-highlight font-semibold">{t("Cause")}</span>}
          </span>
        )}
        <span className="text-sm leading-snug font-medium">{node.label}</span>
      </button>
    </li>
  );
}

/**
 * Link causes to what they led to: the learner picks a cause, then its effect, and an arrow joins
 * them. Events are listed in time order, which never gives away the links. With a question check
 * each link is confirmed or turned down at once with why; with a links check the learner's set is
 * the answer and the check shows the right, wrong and missed links.
 */
export function CauseEffectChainActivity({
  content,
  labelId,
  onAnswerChange,
  phase,
}: CauseEffectProps) {
  const t = useExtracted();
  const format = useFormatNumber();
  const { check, fields } = content;
  const nodes = orderNodes(fields.nodes);
  const order = nodes.map((node) => node.id);
  const [links, setLinks] = useState<Link[]>([]);
  const [causeId, setCauseId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const { centers, containerRef, register } = useCardCenters();
  const isChecked = phase === "checked";
  const isGuided = check.kind === "choice";
  const labelOf = (id: string) => fields.nodes.find((node) => node.id === id)?.label ?? id;

  function update(next: Link[]) {
    setLinks(next);

    if (check.kind === "interaction") {
      onAnswerChange(next.length > 0 ? { kind: "links", links: next } : null);
    }
  }

  function linkTo(effectId: string, fromId: string) {
    const link = { from: fromId, to: effectId };
    const names = { cause: labelOf(fromId), effect: labelOf(effectId) };

    if (isGuided && !hasLink(fields.links, link)) {
      setNotice(t("{cause} didn't lead straight to {effect} here. Try another link.", names));
      return;
    }

    const isRemoving = hasLink(links, link) && !isGuided;
    update(isGuided && hasLink(links, link) ? links : toggleLink(links, link));

    setNotice(
      isRemoving
        ? t("Removed: {cause} led to {effect}.", names)
        : t("Linked: {cause} led to {effect}.", names),
    );
  }

  function handlePress(id: string) {
    if (causeId === null) {
      setCauseId(id);
      setNotice(t("{cause} picked. Now pick what it led to.", { cause: labelOf(id) }));
      return;
    }

    setCauseId(null);

    if (causeId === id) {
      setNotice("");
      return;
    }

    linkTo(id, causeId);
  }

  const results = isChecked && !isGuided ? compareLinks(links, fields.links) : null;

  const arcs =
    results ??
    links.map((link) => ({ ...link, state: isGuided ? ("correct" as const) : ("made" as const) }));

  return (
    <ActivityCanvas labelId={labelId}>
      <div className="flex items-baseline justify-between gap-3">
        <ActivityCanvasLabel className="text-sm">
          {causeId
            ? t("Now pick what {cause} led to.", { cause: labelOf(causeId) })
            : t("Pick a cause, then pick what it led to.")}
        </ActivityCanvasLabel>

        {check.kind === "interaction" && (
          <ActivityCanvasLabel className="shrink-0 tabular-nums">
            {t("{count} of {total} links", {
              count: format(links.length),
              total: format(fields.links.length),
            })}
          </ActivityCanvasLabel>
        )}
      </div>

      <div className="relative" style={{ paddingLeft: ARC_GUTTER }}>
        <CauseEffectArcs centers={centers} links={arcs} order={order} />

        <ol aria-label={t("Causes and effects")} className="flex flex-col gap-2" ref={containerRef}>
          {nodes.map((node) => (
            <NodeCard
              cardRef={register(node.id)}
              disabled={isChecked}
              isCandidate={causeId !== null && causeId !== node.id}
              isCause={causeId === node.id}
              key={node.id}
              node={node}
              onCancel={() => {
                const hadCause = causeId !== null;
                setCauseId(null);
                setNotice("");
                return hadCause;
              }}
              onPress={() => handlePress(node.id)}
              yearLabel={node.year === undefined ? null : format(node.year, { grouping: false })}
            />
          ))}
        </ol>
      </div>

      <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
        {isChecked ? "" : notice}
      </p>

      <CauseEffectLinkList
        canRemove={!isChecked && !isGuided}
        explanations={fields.links}
        labelOf={labelOf}
        links={arcs}
        onRemove={(link) => update(toggleLink(links, link))}
        showWhy={isGuided || isChecked}
      />

      <ActivityTextAlternative>
        {t("Causes and effects in time order: {nodes}.", {
          nodes: nodes.map((node) => node.label).join(", "),
        })}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}
