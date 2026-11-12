import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminNotice } from "@/components/admin-notice";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { DetailField, DetailFields } from "@/components/detail-field";
import { MockLink, type MockOption, MockOptions } from "../../_mock/parts";

const TABS = [
  { label: "Question", value: "question" },
  { label: "Details", value: "details" },
  { label: "Written by", value: "written" },
] as const;

const OPTIONS: MockOption[] = [
  {
    reason: "Inverte o sentido do movimento da água.",
    text: "A água sai das células, e a diminuição pode prejudicar seu funcionamento.",
  },
  {
    reason: "Relaciona a entrada de água ao aumento das células.",
    right: true,
    text: "A água entra nas células, e o inchaço pode prejudicar seu funcionamento.",
  },
  {
    reason: "Separa o tamanho da célula de seu funcionamento.",
    text: "A água entra nas células, mas o aumento não afeta seu funcionamento.",
  },
  {
    reason: "Atribui o inchaço à entrada de sal.",
    text: "O sal entra nas células, e a entrada de sal provoca o inchaço.",
  },
];

export default function ItemMockPage() {
  return (
    <AdminDetailPage>
      <AdminDetailHeader
        facts={["Multiple choice", "Portuguese", "No answers yet"]}
        parents={[{ href: "/items", label: "Practice questions" }]}
        title="O que explica essa mudança e por que ela pode ser prejudicial?"
      />

      <AdminDetailBody>
        <AdminNotice title="A source this question was built on changed after it was written.">
          <MockLink>See the source change</MockLink>
        </AdminNotice>

        <AdminTabs current="question" label="Practice question" path="/items/mock" tabs={TABS} />

        <AdminDetailColumns
          aside={
            <>
              <AdminSection title="Answers">
                <AdminSectionEmpty>No learner has answered it yet.</AdminSectionEmpty>
              </AdminSection>

              <AdminSection title="About">
                <DetailFields>
                  <DetailField label="Skill">
                    <MockLink>Relacionar água e equilíbrio celular</MockLink>
                  </DetailField>
                  <DetailField label="Difficulty">Easier than most (−1.00)</DetailField>
                  <DetailField label="Written">Oct 26, 2026</DetailField>
                </DetailFields>
              </AdminSection>
            </>
          }
        >
          <AdminSection title="What the learner sees">
            <div className="flex max-w-2xl flex-col gap-4 text-sm leading-6">
              <p className="text-muted-foreground">
                Em uma aula de laboratório, Iara observa que células do sangue colocadas em água
                destilada ficam maiores.
              </p>
              <p className="font-medium">
                O que explica essa mudança e por que ela pode ser prejudicial?
              </p>
              <MockOptions options={OPTIONS} />
              <a
                className="text-muted-foreground hover:text-foreground text-xs font-medium"
                href="#"
              >
                Show JSON
              </a>
            </div>
          </AdminSection>
        </AdminDetailColumns>
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
