"use client";

import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";
import { DetailAsideSection, DetailProperties, DetailProperty } from "../_components/detail-page";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowTitle,
} from "../_components/list-group";
import { PageSectionLabel } from "../_components/page";
import { useFormatDuration } from "../_utils/time-format";
import { ChooserLastMock } from "./mock-chooser-last-mock";
import { MockLeftOutNote } from "./mock-notes";
import { useMockOptionName } from "./mock-option-labels";
import { MockSizeNote } from "./mock-size-note";

/** Where the chooser leads: to Plus, and to a finished mock's result by its id. */
export type MockChooserHrefs = { mock: (id: string) => string; plus: string };

/** A mock without a written part beside its questions. */
const NO_WRITTEN_PARTS: readonly string[] = [];

/** A picked mock's size: its questions, its time limit and about how long learners take. */
type PickedSize = { estimatedMinutes: number; minutes: number; questions: number };

/**
 * The picked mock in the page's aside from 72rem, where a narrower screen has its size on the row:
 * its questions, time limit and about how long learners take as properties, then what it asks
 * (`asks`: the subjects, or the exam's parts it sits, named as a group of its section) with the
 * written parts beside its questions.
 */
export function ChooserPicked({
  asks,
  size,
  written = NO_WRITTEN_PARTS,
}: {
  asks: { names: readonly string[]; title: string };
  size: PickedSize;
  written?: readonly string[];
}) {
  const t = useExtracted();
  const duration = useFormatDuration();

  return (
    <div className="flex flex-col gap-8" data-slot="mock-chooser-picked">
      <DetailProperties>
        <DetailProperty label={t("Questions")} mono>
          {size.questions}
        </DetailProperty>
        <DetailProperty label={t("Time limit")} mono>
          {duration(size.minutes)}
        </DetailProperty>
        <DetailProperty label={t("Usually takes")} mono>
          {t("About {time}", { time: duration(size.estimatedMinutes) })}
        </DetailProperty>
      </DetailProperties>

      {asks.names.length + written.length > 0 && (
        <section className="flex flex-col gap-1">
          <PageSectionLabel>{asks.title}</PageSectionLabel>
          <ListGroup>
            {asks.names.map((name) => (
              <ListRow key={name}>
                <ListRowContent>
                  <ListRowTitle>{name}</ListRowTitle>
                </ListRowContent>
              </ListRow>
            ))}
            {written.map((name) => (
              <ListRow key={name}>
                <ListRowContent>
                  <ListRowTitle>{name}</ListRowTitle>
                  <ListRowDescription>{t("Written part")}</ListRowDescription>
                </ListRowContent>
              </ListRow>
            ))}
          </ListGroup>
        </section>
      )}
    </div>
  );
}

/**
 * The picked mock in the page's aside: its properties and what it asks from 72rem (a narrower
 * screen has its size on the row), then where its size comes from and what it leaves out (a
 * subject's leaves out less than the whole day; half of a day already says "objective part only"
 * beside it), and how the last mock went.
 */
export function PickedMock({
  hrefs,
  option,
  severalDays,
  view,
}: {
  hrefs: MockChooserHrefs;
  option: MockOptionView;
  severalDays: boolean;
  view: MockOptionsView;
}) {
  const t = useExtracted();
  const name = useMockOptionName();

  return (
    <>
      <DetailAsideSection
        className="max-[72rem]:hidden"
        title={name({ option, severalDays })}
        titleId="mock-chooser-picked-title"
      >
        <ChooserPicked
          asks={{
            names: option.covers ?? option.areas,
            title: option.covers ? t("Parts") : t("Subjects"),
          }}
          size={option}
          written={option.written}
        />
      </DetailAsideSection>

      <div className="flex flex-col gap-1 empty:hidden">
        <MockSizeNote
          document={view.examDocument}
          size={{ minutes: option.minutes, questions: option.questions }}
          source={view.sizeSource}
        />
        <MockLeftOutNote leftOut={option.leftOut.filter((part) => part.part !== "writtenInFull")} />
      </div>

      <ChooserLastMock mock={view.lastMock} resultHref={hrefs.mock} />
    </>
  );
}
