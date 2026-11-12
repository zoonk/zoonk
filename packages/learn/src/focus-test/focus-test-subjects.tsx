"use client";

import {
  type FocusRow,
  type FocusTestSubject,
} from "@zoonk/core/learner/placement/focus-test-contract";
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
  ListRowButton,
  ListRowContent,
  ListRowNumberedTitle,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { getSubjectName, useSubjectStateText } from "./use-focus-test-texts";

export function FocusSubjects({ rows }: { rows: readonly FocusRow[] }) {
  return (
    <ListGroup data-slot="focus-subjects">
      <ol>
        {rows.map((row, index) => (
          <li key={row.subject.key}>
            <ListRow>
              <ListRowContent>
                <ListRowNumberedTitle number={index + 1}>
                  {getSubjectName(row.subject)}
                </ListRowNumberedTitle>
              </ListRowContent>
            </ListRow>
          </li>
        ))}
      </ol>
    </ListGroup>
  );
}

function SubjectRow({ subject }: { subject: FocusTestSubject }) {
  const state = useSubjectStateText()(subject);

  return (
    <ListRow>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle className="font-normal">{getSubjectName(subject)}</ListRowTitle>
        </ListRowContent>
        {state && <ListRowTrailing>{state}</ListRowTrailing>}
      </ListRowBody>
    </ListRow>
  );
}

function SubjectRows({ subjects }: { subjects: readonly FocusTestSubject[] }) {
  return (
    <ListGroup>
      <ul>
        {subjects.map((subject) => (
          <li key={subject.key}>
            <SubjectRow subject={subject} />
          </li>
        ))}
      </ul>
    </ListGroup>
  );
}

export function FocusTestSubjectsSheet({ subjects }: { subjects: readonly FocusTestSubject[] }) {
  const t = useExtracted();

  return (
    <Drawer>
      <DrawerTrigger render={<ListRowButton />}>
        <ListRowContent>
          <ListRowTitle className="font-normal">
            {t({
              description:
                "Opens the list of every exam subject with how its Focus test questions went.",
              message: "See all subjects",
            })}
          </ListRowTitle>
        </ListRowContent>
      </DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{t("Subjects")}</DrawerTitle>
          <DrawerCloseButton />
        </DrawerHeader>

        <DrawerContent className="pt-1">
          <SubjectRows subjects={subjects} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}
