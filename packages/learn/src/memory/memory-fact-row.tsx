"use client";

import { type MemoryFactView } from "@zoonk/core/memory/contract";
import { MAX_MEMORY_STATEMENT_LENGTH } from "@zoonk/core/memory/memory-limits";
import { isProfileQuestion } from "@zoonk/core/profile/questions/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { EditTextDialog } from "../_components/edit-text-dialog";
import { LearnLink } from "../learn-link";
import { aboutYouQuestionHref } from "../profile-questions/about-you-screen";
import { MemoryFactSource } from "./memory-labels";

/** A fact from About you is changed there, where its answer lives; with memory off only the list opens. */
function getAboutYouHref({
  fact,
  memoryEnabled,
}: {
  fact: MemoryFactView;
  memoryEnabled: boolean;
}): string | null {
  const question = fact.source?.kind === "profile" ? fact.source.id : null;

  if (!question || !isProfileQuestion(question)) {
    return null;
  }

  return memoryEnabled || question === "learningSupport"
    ? aboutYouQuestionHref(question)
    : "/settings/about-you";
}

export function MemoryFactRow({
  fact,
  memoryEnabled,
  onDelete,
  onEdit,
}: {
  fact: MemoryFactView;
  memoryEnabled: boolean;
  onDelete: () => void;
  onEdit: (statement: string) => void;
}) {
  const t = useExtracted();
  const [isEditing, setIsEditing] = useState(false);
  const aboutYouHref = getAboutYouHref({ fact, memoryEnabled });

  return (
    <li className="flex items-start gap-3 py-2.75" data-slot="memory-fact">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-reading leading-snug">{fact.statement}</p>
        <p className="text-muted-foreground text-compact leading-snug">
          <MemoryFactSource fact={fact} />
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("Options for “{fact}”", { fact: fact.statement })}
              className="text-muted-foreground -my-2 shrink-0"
              edge="end"
              size="icon"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          {aboutYouHref ? (
            <DropdownMenuItem render={<LearnLink href={aboutYouHref} />}>
              <PencilIcon aria-hidden="true" />
              {t("Edit")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setIsEditing(true)}>
              <PencilIcon aria-hidden="true" />
              {t("Edit")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            <Trash2Icon aria-hidden="true" />
            {t("Delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isEditing && (
        <EditTextDialog
          description={t({
            description: '"It" is the note Zoonk keeps about the learner, edited in this dialog.',
            message: "Say it the way it's true for you.",
          })}
          label={t("What Zoonk remembers")}
          maxLength={MAX_MEMORY_STATEMENT_LENGTH}
          multiline
          onClose={() => setIsEditing(false)}
          onSave={(statement) => {
            setIsEditing(false);
            onEdit(statement);
          }}
          title={t({
            description: "A memory is one fact Zoonk remembers about the learner.",
            message: "Edit memory",
          })}
          value={fact.statement}
        />
      )}
    </li>
  );
}
