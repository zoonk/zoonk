"use client";

import { type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRow,
  ListRowBody,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { StatusMark } from "../_components/status-mark";
import { TaskAsideSection } from "../_components/task-layout";
import { useCountOf } from "../_utils/count-of";
import { useMockScreen } from "./mock-context";
import { useMockSectionTitle } from "./mock-labels";
import { useSectionCounts } from "./mock-section-counts";

const SECTION_MARK = { current: "next", done: "done", upcoming: "todo" } as const satisfies Record<
  MockSectionView["status"],
  string
>;

function SectionTrailing({ section }: { section: MockSectionView }) {
  const t = useExtracted();
  const countOf = useCountOf();
  const { runner } = useMockScreen();
  const counts = useSectionCounts();

  if (section.status === "done") {
    return (
      <span className="font-sans">
        {t({
          description: "A part's status in the list of the mock's parts.",
          message: "Handed in",
        })}
      </span>
    );
  }

  return section.status === "current" && runner.view.current
    ? countOf(counts.answered, counts.total)
    : countOf(0, section.questions + section.essays);
}

function SectionRow({ section }: { section: MockSectionView }) {
  const title = useMockSectionTitle();

  return (
    <ListRow aria-current={section.status === "current" ? "step" : undefined}>
      <ListRowLeading>
        <StatusMark status={SECTION_MARK[section.status]} />
      </ListRowLeading>
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle className={cn(section.status !== "current" && "text-muted-foreground")}>
            {title(section)}
          </ListRowTitle>
        </ListRowContent>
        <ListRowTrailing>
          <SectionTrailing section={section} />
        </ListRowTrailing>
      </ListRowBody>
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
