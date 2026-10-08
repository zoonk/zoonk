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

function NamedTitle({ buddy }: { buddy: NonNullable<PlanTutor["buddy"]> }) {
  const t = useExtracted();
  const name = useBuddyName(buddy);
  return t("Something else? Tell {name}", { name });
}

function TutorRow({ tutor }: { tutor: PlanTutor }) {
  const t = useExtracted();

  return (
    <ListGroup>
      <ListRowLink href={tutor.href}>
        <ListRowIcon>
          <MessageCircleIcon />
        </ListRowIcon>
        <ListRowContent>
          <ListRowTitle>
            {tutor.buddy ? (
              <NamedTitle buddy={tutor.buddy} />
            ) : (
              t("Something else? Tell your buddy")
            )}
          </ListRowTitle>
          <ListRowDescription>
            {t(
              "In your own words, like “less on weekends”. You'll see the change before it applies.",
            )}
          </ListRowDescription>
        </ListRowContent>
      </ListRowLink>
    </ListGroup>
  );
}

/**
 * The last row of "Adjust your plan": anything the controls above don't cover ("less on
 * weekends", "a light week, I'm traveling") is said to the buddy in the conversation, which
 * proposes the change for the learner to apply. Hosts without the conversation show nothing.
 */
export function PlanEditRequest() {
  const { tutor } = usePlanScreen();
  return tutor ? <TutorRow tutor={tutor} /> : null;
}
