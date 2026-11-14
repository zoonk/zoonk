"use client";

import { LayersIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import {
  ListGroup,
  ListRowButton,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "../_components/list-group";
import { PlanBasesSheet } from "./plan-bases-sheet";
import { usePlanBases, useSummaryText } from "./use-bases-texts";

export function PlanChoices() {
  const t = useExtracted();
  const bases = usePlanBases();
  const summaryText = useSummaryText();
  const [basesOpen, setBasesOpen] = useState(false);

  if (!bases) {
    return null;
  }

  return (
    <ListGroup aria-label={t("Your choices")} role="group">
      <ListRowButton aria-haspopup="dialog" onClick={() => setBasesOpen(true)}>
        <ListRowLeading>
          <ListRowIcon>
            <LayersIcon />
          </ListRowIcon>
        </ListRowLeading>
        <ListRowContent>
          <ListRowTitle>{summaryText(bases)}</ListRowTitle>
        </ListRowContent>
      </ListRowButton>

      <PlanBasesSheet bases={bases} onOpenChange={setBasesOpen} open={basesOpen} />
    </ListGroup>
  );
}
