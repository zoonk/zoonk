"use client";

import { type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { TaskAsideSection } from "../_components/task-layout";
import { useMockScreen } from "./mock-context";
import { useSectionCounts } from "./mock-section-counts";

const SECTION_MARK = { current: "next", done: "done", upcoming: "todo" } as const satisfies Record<
  MockSectionView["status"],
  string
>;

function SectionTrailing({ section }: { section: MockSectionView }) {
  const t = useExtracted();
  const counts = useSectionCounts();

  if (section.status === "done") {
    return <span className="font-sans">{t("Handed in")}</span>;
  }

  const answered = section.status === "current" ? counts.answered : 0;
  return `${answered}/${section.questions + section.essays}`;
}

function SectionRow({ section }: { section: MockSectionView }) {
  const t = useExtracted();

  return (
    <ListRow aria-current={section.status === "current" ? "step" : undefined}>
      <ListRowLeading>
        <StatusMark status={SECTION_MARK[section.status]} />
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle className={cn(section.status !== "current" && "text-muted-foreground")}>
          {section.name ?? t("Section {number, number}", { number: section.index + 1 })}
        </ListRowTitle>
      </ListRowContent>
      <ListRowTrailing>
        <SectionTrailing section={section} />
      </ListRowTrailing>
    </ListRow>
  );
}

export function hasSeveralSections(sections: readonly MockSectionView[]): boolean {
  return sections.length > 1;
}

export function SheetSections({ titled = true }: { titled?: boolean }) {
  const t = useExtracted();
  const { runner } = useMockScreen();
  const { sections } = runner.view;

  if (!hasSeveralSections(sections)) {
    return null;
  }

  return (
    <TaskAsideSection title={titled ? t("Sections") : undefined}>
      <ListGroup>
        <ol>
          {sections.map((section) => (
            <li key={section.index}>
              <SectionRow section={section} />
            </li>
          ))}
        </ol>
      </ListGroup>
    </TaskAsideSection>
  );
}
