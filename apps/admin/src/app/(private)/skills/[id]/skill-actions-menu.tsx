"use client";

import { AdminConfirmDialog } from "@/components/admin-confirm-dialog";
import { type SkillMergeTarget } from "@/data/skills/search-merge-targets";
import { formatCount } from "@/lib/format";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { Input } from "@zoonk/ui/components/input";
import { Label } from "@zoonk/ui/components/label";
import { RadioGroup, RadioGroupItem, RadioGroupOption } from "@zoonk/ui/components/radio-group";
import { safeAsync } from "@zoonk/utils/error";
import { MergeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { mergeSkillAction } from "./_actions/merge-skill";
import { searchSkillMergeTargetsAction } from "./_actions/search-skill-merge-targets";

const SEARCH_DELAY_MS = 300;
const MIN_SEARCH_LENGTH = 2;

export function SkillActionsMenu({ skillId, skillName }: { skillId: string; skillName: string }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<SkillMergeTarget | null>(null);

  return (
    <>
      <DetailMenu label="Skill actions">
        <DropdownMenuItem onClick={() => setOpen(true)} variant="destructive">
          <MergeIcon aria-hidden="true" />
          Merge into another skill
        </DropdownMenuItem>
      </DetailMenu>

      <AdminConfirmDialog
        action={mergeSkillAction}
        confirmDisabled={!target}
        confirmLabel="Merge"
        description="Everything that uses this skill moves to the one you keep: learners' progress, lessons and practice questions. This can't be undone."
        destructive
        onOpenChange={setOpen}
        open={open}
        title={
          target
            ? `Merge "${skillName}" into "${target.name}"?`
            : `Merge "${skillName}" into another skill?`
        }
      >
        <input name="duplicateId" type="hidden" value={skillId} />
        <input name="survivorId" type="hidden" value={target?.id ?? ""} />
        <MergeTargetPicker onPick={setTarget} skillId={skillId} target={target} />
      </AdminConfirmDialog>
    </>
  );
}

type TargetSearch = { failed: boolean; query: string; targets: SkillMergeTarget[] };

function getSearchStatus({ query, search }: { query: string; search: TargetSearch }) {
  if (query.length < MIN_SEARCH_LENGTH) {
    return null;
  }

  if (search.query !== query) {
    return "Searching…";
  }

  if (search.failed) {
    return "Search couldn't load. Edit your search to retry.";
  }

  return search.targets.length === 0
    ? `No skill it can merge into matches "${query}". Both need the same language and audience.`
    : null;
}

function MergeTargetPicker({
  onPick,
  skillId,
  target,
}: {
  onPick: (target: SkillMergeTarget | null) => void;
  skillId: string;
  target: SkillMergeTarget | null;
}) {
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState<TargetSearch>({ failed: false, query: "", targets: [] });
  const query = typed.trim();

  useEffect(() => {
    if (query.length < MIN_SEARCH_LENGTH) {
      return;
    }

    let isCurrent = true;

    const timeout = globalThis.setTimeout(async () => {
      const { data, error } = await safeAsync(() =>
        searchSkillMergeTargetsAction({ duplicateId: skillId, query }),
      );

      if (isCurrent) {
        setSearch({ failed: Boolean(error), query, targets: data ?? [] });
      }
    }, SEARCH_DELAY_MS);

    return () => {
      isCurrent = false;
      globalThis.clearTimeout(timeout);
    };
  }, [query, skillId]);

  const targets = search.query === query ? search.targets : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="skillToKeep">Skill to keep</Label>
        <Input
          autoComplete="off"
          id="skillToKeep"
          maxLength={100}
          onChange={(event) => {
            setTyped(event.target.value);
            onPick(null);
          }}
          placeholder="Search skills by name…"
          type="search"
          value={typed}
        />
      </div>

      <RadioGroup
        aria-label="Matching skills"
        className="gap-0 empty:hidden"
        onValueChange={(id) => onPick(targets.find((option) => option.id === id) ?? null)}
        value={target?.id ?? ""}
      >
        {targets.map((option) => (
          <RadioGroupOption
            className="flex items-start gap-3 border-b py-2.5 font-normal last:border-b-0"
            key={option.id}
          >
            <RadioGroupItem className="mt-0.5" value={option.id} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="wrap-break-word">{option.name}</span>
              <span className="text-muted-foreground text-xs">
                {formatCount(option.learners, "learner")}
              </span>
            </span>
          </RadioGroupOption>
        ))}
      </RadioGroup>

      <p aria-live="polite" className="text-muted-foreground text-xs empty:hidden">
        {getSearchStatus({ query, search })}
      </p>
    </div>
  );
}
