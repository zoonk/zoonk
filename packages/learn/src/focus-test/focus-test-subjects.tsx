"use client";

import { type FocusTestSubject } from "@zoonk/core/learner/placement/focus-test-contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { useExtracted } from "next-intl";
import { DrawerCloseButton } from "../_components/details-drawer";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { getSubjectName, useSubjectStateText } from "./use-focus-test-texts";

/**
 * Before the first answer every quick subject would read "Not asked yet", so only what the test
 * can't check is said.
 */
function SubjectRow({ answered, subject }: { answered: boolean; subject: FocusTestSubject }) {
  const stateText = useSubjectStateText();

  return (
    <ListRow>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle className="font-normal">{getSubjectName(subject)}</ListRowTitle>
        </ListRowContent>
        {(answered || subject.state === "notChecked") && (
          <ListRowTrailing>{stateText(subject)}</ListRowTrailing>
        )}
      </ListRowBody>
    </ListRow>
  );
}

function SubjectRows({
  answered,
  subjects,
}: {
  answered: boolean;
  subjects: readonly FocusTestSubject[];
}) {
  return (
    <ListGroup>
      <ul>
        {subjects.map((subject) => (
          <li key={subject.key}>
            <SubjectRow answered={answered} subject={subject} />
          </li>
        ))}
      </ul>
    </ListGroup>
  );
}

export function FocusTestSubjectsSheet({
  answered,
  subjects,
}: {
  /** The learner has test answers, so each subject says how it went. */
  answered: boolean;
  subjects: readonly FocusTestSubject[];
}) {
  const t = useExtracted();

  return (
    <Drawer>
      <DrawerTrigger render={<Button variant="link" />}>
        {answered ? t("View all subjects") : t("View subjects")}
      </DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{t("Subjects")}</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>

        <DrawerContent className="pt-1">
          <SubjectRows answered={answered} subjects={subjects} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
