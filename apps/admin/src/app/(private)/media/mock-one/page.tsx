import dump from "@/app/(private)/_mock/data/media-asset.json";
import { type Dump, Facts, FactsFrom, MockRows, field, readView } from "@/app/(private)/_mock/kit";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { MockLink } from "../../_mock/parts";

const asset = dump as Dump;

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Written by", value: "written" },
  { label: "Details", value: "details" },
] as const;

const KEY = "image:v2:pt:a9136367e873c225b7ba9583bc8de4e0a2d1f479";
const lines = asset.text.split("\n").map((line) => line.trim());
const prompt = lines[lines.indexOf("Prompt") + 2] ?? "";

export default async function MediaAssetMockPage({ searchParams }: PageProps<"/media/mock-one">) {
  const tab = readView((await searchParams).tab) || "overview";
  const uses = asset.tables[0]?.rows ?? [];

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        facts={["Image", "Portuguese", "Used on 2 screens", "Made Oct 9, 2026"]}
        parents={[{ href: "/media", label: "Media" }]}
        title="Picture in Distância real a partir da escala"
      />

      <AdminDetailBody>
        <AdminTabs current={tab as "overview"} label="Picture" path="/media/mock-one" tabs={TABS} />

        {tab === "written" ? (
          <div className="grid gap-8 md:grid-cols-2">
            <AdminSection title="Prompt">
              <p className="text-sm leading-6">{prompt}</p>
              <a className="text-muted-foreground text-xs font-medium" href="#">
                Scene
              </a>
            </AdminSection>
            <AdminSection title="Written by">
              <FactsFrom dump={asset} section="Provenance" />
            </AdminSection>
          </div>
        ) : null}

        {tab === "details" ? (
          <AdminSection title="Details">
            <Facts
              rows={[
                ["Key", KEY],
                ["URL", field(asset, "URL")],
                ["Language", "Portuguese"],
                ["Size", field(asset, "Size")],
                ["Style version", field(asset, "Style version")],
                ["Palette", field(asset, "Palette")],
                ["Open to", "Everyone"],
                ["Created", field(asset, "Created")],
              ]}
            />
          </AdminSection>
        ) : null}

        {tab === "overview" ? (
          <AdminDetailColumns
            aside={
              <AdminSection title="Used on 2 screens">
                <MockRows
                  columns={[{ label: "Lesson" }, { label: "Screen" }, { label: "Kind" }]}
                  rows={uses.map((row) => [
                    <MockLink key="lesson">{row[0]?.text}</MockLink>,
                    row[1]?.text,
                    row[2]?.text,
                  ])}
                />
              </AdminSection>
            }
          >
            {/* oxlint-disable-next-line next/no-img-element -- A static mock. */}
            <img
              alt=""
              className="bg-muted w-full max-w-sm rounded-xl border"
              src={field(asset, "URL")}
            />
          </AdminDetailColumns>
        ) : null}
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
