import lessons from "@/app/(private)/_mock/data/media-lessons.json";
import dump from "@/app/(private)/_mock/data/media.json";
import {
  type Dump,
  MockList,
  MockSelect,
  MockViews,
  day,
  language,
} from "@/app/(private)/_mock/kit";
import { Button } from "@zoonk/ui/components/button";
import { AudioLinesIcon } from "lucide-react";

const COLUMNS = [
  { label: "Picture or clip" },
  { label: "Kind" },
  { label: "Used in" },
  { label: "Made" },
];

type Use = { course: string | null; lesson: string; screen: number };

export default function MediaMockPage() {
  const rows = ((dump as Dump).tables[0]?.rows ?? []).slice(0, 10);
  const uses = lessons as Record<string, Use>;

  return (
    <MockList
      actions={
        <Button size="sm" variant="outline">
          <AudioLinesIcon aria-hidden="true" />
          Missing audio
          <span className="text-muted-foreground font-mono text-xs tabular-nums">9</span>
        </Button>
      }
      columns={COLUMNS}
      rows={rows.map((row) => {
        const use = uses[(row[1]?.href ?? "").replace("/media/", "")];

        return [
          <a className="flex items-center gap-4" data-slot="table-row-link" href="#" key="lead">
            {/* oxlint-disable-next-line next/no-img-element -- A static mock. */}
            <img
              alt=""
              className="bg-muted h-20 w-16 shrink-0 rounded-md border object-cover"
              src={row[0]?.img}
            />
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{use ? use.lesson : "Not used in a lesson"}</span>
              <span className="text-muted-foreground text-xs">
                {[use?.course, use ? `Screen ${use.screen}` : null].filter(Boolean).join(" · ")}
              </span>
            </span>
          </a>,
          [row[2]?.text, row[3]?.text === "—" ? "Any language" : language(row[3]?.text)].join(
            " · ",
          ),
          row[7]?.text.replace("step", "screen"),
          day(row[9]?.text),
        ];
      })}
      title="Media"
      toolbar={
        <>
          <MockViews
            label="Kind"
            views={[{ active: true, label: "All media" }, { label: "Images" }, { label: "Audio" }]}
          />
          <MockSelect>Public and private</MockSelect>
        </>
      }
    />
  );
}
