"use client";

import { type MapArea } from "@zoonk/core/view-models/map/contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ChevronDownIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";
import { useExperienceMode } from "../mode-provider";
import { FunMoon } from "../plan/fun-moon";
import { useFieldMap } from "./field-map-context";
import { type MapGroup } from "./map-grouping";
import { SkillDetail } from "./skill-detail";
import { SkillMap } from "./skill-map";

function useSkillCount() {
  const t = useExtracted();

  return (counts: MapArea["counts"]) =>
    [
      t("{count, plural, one {# skill} other {# skills}}", { count: counts.total }),
      counts.mastered > 0 && t("{mastered, number} mastered", { mastered: counts.mastered }),
      counts.fading > 0 && t("{fading, number} fading", { fading: counts.fading }),
    ]
      .filter(Boolean)
      .join(" · ");
}

function ChapterLink({ chapterId }: { chapterId: string }) {
  const t = useExtracted();
  const { hrefs } = useFieldMap();

  return (
    <LearnLink
      className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
      href={`${hrefs.chapterBasePath}/${chapterId}`}
    >
      {t("Open chapter")}
    </LearnLink>
  );
}

/** One chapter on the map: its skills around it, where the learner is, and a way in. */
function AreaCluster({ area }: { area: MapArea }) {
  const t = useExtracted();
  const skillCount = useSkillCount();

  return (
    <li
      className="flex flex-col gap-3 border-b pb-6 last:border-b-0 last:pb-0"
      data-current={area.current}
    >
      <h3 className="sr-only">{area.title}</h3>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <div className="flex items-center gap-2">
          {area.current && (
            <span className="bg-foreground text-background in-data-[mode=fun]:bg-fun-accent-lime rounded-full px-2.5 py-0.5 text-xs font-semibold in-data-[mode=fun]:text-(--fun-inv-fg)">
              {t("You are here")}
            </span>
          )}
          <span className="text-muted-foreground text-xs">{skillCount(area.counts)}</span>
        </div>
        {area.chapterId && <ChapterLink chapterId={area.chapterId} />}
      </div>

      {area.skills.length > 0 ? (
        <SkillMap
          label={t("Skills in {chapter}", { chapter: area.title })}
          renderDetail={(skill) => (
            <SkillDetail skill={skill}>
              {area.chapterId && <ChapterLink chapterId={area.chapterId} />}
            </SkillDetail>
          )}
          rootTitle={area.title}
          skills={area.skills}
        />
      ) : (
        <p className="text-sm">
          <span className="font-medium">{area.title}</span>
          <span className="text-muted-foreground block">
            {t("Its skills show up once its lessons are written.")}
          </span>
        </p>
      )}
    </li>
  );
}

function GroupMarker({ group }: { group: MapGroup }) {
  const mode = useExperienceMode();

  if (mode === "fun") {
    return <FunMoon index={group.index} size={group.state === "current" ? "md" : "sm"} />;
  }

  return (
    <span
      aria-hidden="true"
      className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
    >
      {group.index + 1}
    </span>
  );
}

function useGroupState() {
  const t = useExtracted();

  return (state: MapGroup["state"]) => {
    if (state === "done") {
      return t("Done");
    }

    return state === "current" ? t("You are here") : t("Coming up");
  };
}

function MapGroupSection({ defaultOpen, group }: { defaultOpen: boolean; group: MapGroup }) {
  const groupState = useGroupState();
  const skillCount = useSkillCount();

  return (
    <Collapsible
      className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-glass rounded-3xl ring-1 in-data-[mode=fun]:ring-0"
      defaultOpen={defaultOpen}
    >
      <CollapsibleTrigger className="group/map focus-visible:ring-ring/50 flex min-h-16 w-full items-start gap-3 rounded-3xl p-4 text-left outline-none focus-visible:ring-[3px]">
        {/* The marker and chevron sit on the title's first line when a long title wraps. */}
        <LineMarker>
          <GroupMarker group={group} />
        </LineMarker>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="in-data-[mode=fun]:font-fun-display font-semibold">{group.title}</span>
          <span className="text-muted-foreground text-xs">
            {[groupState(group.state), skillCount(group.counts)].join(" · ")}
          </span>
        </span>
        <LineMarker aria-hidden="true">
          <ChevronDownIcon className="text-muted-foreground size-4 transition-transform group-data-panel-open/map:rotate-180 motion-reduce:transition-none" />
        </LineMarker>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="flex flex-col gap-6 px-4 pb-6">
          {group.areas.map((area) => (
            <AreaCluster area={area} key={area.areaId} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The map's groups (phases, or courses), each a section that opens to its chapters. Only the
 * group the learner is in starts open (the first one once everything is done), so even a goal of
 * hundreds of skills stays calm.
 */
export function MapGroups({ groups, label }: { groups: MapGroup[]; label: string }) {
  const openKey = (groups.find((group) => group.state === "current") ?? groups[0])?.key;

  return (
    <ol aria-label={label} className="flex flex-col gap-3">
      {groups.map((group) => (
        <li key={group.key}>
          <MapGroupSection defaultOpen={group.key === openKey} group={group} />
        </li>
      ))}
    </ol>
  );
}
