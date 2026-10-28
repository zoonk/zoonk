import { type MistakeSnapshot } from "@zoonk/core/mistakes/snapshot";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemSupport } from "../questions/item-text";

export function MistakeStimulus({
  continued = false,
  snapshot,
}: {
  continued?: boolean;
  snapshot: MistakeSnapshot;
}) {
  return (
    <>
      {snapshot.set && <ItemSetStimulus continued={continued} practice set={snapshot.set} />}
      <ItemSupport
        className="text-muted-foreground text-sm leading-relaxed"
        context={snapshot.context ?? null}
        image={snapshot.image ?? null}
        visual={snapshot.visual ?? null}
      />
    </>
  );
}
