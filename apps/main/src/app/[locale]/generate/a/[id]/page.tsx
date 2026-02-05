import { Suspense } from "react";
import { GenerateActivityContent, GenerateActivityFallback } from "./generate-activity-content";

export default function GenerateActivityPage(props: PageProps<"/[locale]/generate/a/[id]">) {
  return (
    <Suspense fallback={<GenerateActivityFallback />}>
      <GenerateActivityContent params={props.params} />
    </Suspense>
  );
}
