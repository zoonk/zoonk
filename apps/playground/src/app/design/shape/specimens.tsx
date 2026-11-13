import { CONTROL_SIZES } from "@/design-system/shape";
import {
  ListGroup,
  ListRowBody,
  ListRowButton,
  ListRowContent,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { Input } from "@zoonk/ui/components/input";
import { BackLink } from "@zoonk/ui/components/page-top";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";
import { Specimen } from "../_components/doc";

const EDGE_GUIDE =
  "border-foreground/25 pointer-events-none absolute inset-y-0 border-l border-dashed";

function EdgeRow({ title, value }: { title: string; value: string }) {
  return (
    <ListRowButton className="min-h-11">
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{title}</ListRowTitle>
        </ListRowContent>
        <ListRowTrailing>{value}</ListRowTrailing>
      </ListRowBody>
    </ListRowButton>
  );
}

/** Dashed lines mark the column's two edges; every glyph, word and value ends on one of them. */
export function EdgesSpecimen() {
  return (
    <Specimen>
      <div className="max-w-column relative flex flex-col gap-1">
        <span aria-hidden="true" className={cn(EDGE_GUIDE, "left-0")} />
        <span aria-hidden="true" className={cn(EDGE_GUIDE, "right-0")} />

        <div className="flex items-center justify-between">
          <BackLink aria-label="Back to Profile" href="#edges">
            Profile
          </BackLink>
          <Button aria-label="More" edge="end" size="icon-bar" variant="ghost">
            <EllipsisIcon />
          </Button>
        </div>

        <p className="text-title pb-3">Settings</p>

        <ListGroup>
          {(
            [
              ["Language", "English"],
              ["Daily time", "30 min"],
            ] as const
          ).map(([title, value]) => (
            <EdgeRow key={title} title={title} value={value} />
          ))}
        </ListGroup>
      </div>
    </Specimen>
  );
}

export function ControlSizes() {
  return (
    <div className="flex flex-col">
      {CONTROL_SIZES.map((control) => (
        <div
          className="border-border grid items-start gap-x-6 gap-y-4 border-t py-5 lg:grid-cols-[14rem_minmax(0,1fr)]"
          key={control.size}
        >
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{control.height}</p>
            <code className="text-muted-foreground font-mono text-xs">{`size="${control.size}"`}</code>
            <p className="text-muted-foreground text-xs leading-normal">{control.use}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size={control.size}>Continue</Button>
            <Button size={control.size} variant="outline">
              Adjust plan
            </Button>
            {control.iconSize ? (
              <Button aria-label="More" size={control.iconSize} variant="outline">
                <EllipsisIcon />
              </Button>
            ) : (
              <Input aria-label="Email" className="w-44" placeholder="Email" />
            )}
          </div>
        </div>
      ))}

      <div className="border-border grid items-start gap-x-6 gap-y-4 border-t py-5 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">22px</p>
          <code className="text-muted-foreground font-mono text-xs">{"<Badge>"}</code>
          <p className="text-muted-foreground text-xs leading-normal">A chip. It is not pressed.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">New</Badge>
          <Badge variant="outline">Plus</Badge>
        </div>
      </div>
    </div>
  );
}
