"use client";

import { type MockOptionView } from "@zoonk/core/exams/mocks/contract";
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
import { useMockOptionName } from "./mock-option-labels";

export type MockChooserHrefs = { mock: (id: string) => string };

const NO_WRITTEN_PARTS: readonly string[] = [];

type PickedSize = { estimatedMinutes: number; minutes: number; questions: number };

function ChooserPicked({
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

export function PickedMock({
  option,
  severalDays,
}: {
  option: MockOptionView;
  severalDays: boolean;
}) {
  const t = useExtracted();
  const name = useMockOptionName();

  return (
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
  );
}
