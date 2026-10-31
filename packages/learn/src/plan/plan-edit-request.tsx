"use client";

import { MessageCircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { useBuddyName } from "../buddies/use-buddy-name";
import { type PlanTutor, usePlanScreen } from "./plan-context";

function NamedTitle({ buddy }: { buddy: PlanTutor["buddy"] }) {
  const t = useExtracted();
  const name = useBuddyName(buddy);
  return t("Something else? Tell {name}", { name });
}

function TutorRow({ tutor }: { tutor: PlanTutor }) {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();
  const hasModules = goal.kind === "learn" && plan.areas.length > 1;

  return (
    <ListGroup>
      <ListRowLink href={tutor.href}>
        <ListRowIcon>
          <MessageCircleIcon />
        </ListRowIcon>
        <ListRowContent>
          <ListRowTitle>
            <NamedTitle buddy={tutor.buddy} />
          </ListRowTitle>
          <ListRowDescription>
            {hasModules
              ? t(
                  "In your own words, like “skip a module” or “less on weekends”. You'll see the change before it applies.",
                )
              : t(
                  "In your own words, like “less on weekends”. You'll see the change before it applies.",
                )}
          </ListRowDescription>
        </ListRowContent>
      </ListRowLink>
    </ListGroup>
  );
}

export function PlanEditRequest() {
  const { tutor } = usePlanScreen();
  return tutor ? <TutorRow tutor={tutor} /> : null;
}
