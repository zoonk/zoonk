"use client";

import { Button } from "@zoonk/ui/components/button";
import { LanguagesIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../../_components/list-group";
import { ChangeSaveError } from "../../_components/save-error";
import { useFormatDuration } from "../../_utils/time-format";

export type AlphabetLink = { href: string; minutes: number; pending: boolean; title: string };

export function AlphabetRow({
  alphabet,
  onSkip,
}: {
  alphabet: AlphabetLink;
  /** Resolves false when the skip couldn't be saved. */
  onSkip: () => Promise<boolean>;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const skip = () =>
    startTransition(async () => {
      setFailed(!(await onSkip()));
    });

  return (
    <div className="flex flex-col gap-2">
      <ListGroup>
        <ListRowLink href={alphabet.href}>
          <ListRowLeading>
            <ListRowIcon>
              <LanguagesIcon />
            </ListRowIcon>
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle>{alphabet.title}</ListRowTitle>
            <ListRowDescription>
              {alphabet.pending
                ? t("First in your next session · {time}", {
                    time: formatDuration(alphabet.minutes),
                  })
                : t("Practice anytime · {time}", { time: formatDuration(alphabet.minutes) })}
            </ListRowDescription>
          </ListRowContent>
        </ListRowLink>
      </ListGroup>

      {alphabet.pending && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={isPending} onClick={skip} size="sm" variant="outline">
            {t("I can already read it")}
          </Button>
          {failed && <ChangeSaveError />}
        </div>
      )}
    </div>
  );
}
