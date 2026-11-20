import { useExtracted } from "next-intl";
import { GateWords } from "../_components/subscribe-gate";

export function MockPreparingWords({ title }: { title: string }) {
  const t = useExtracted();

  return (
    <GateWords
      line={t({
        description:
          "Shown right under a line saying the mock exam is being prepared; 'it' is the mock exam, so don't repeat the noun.",
        message: "Come back to this page to start it.",
      })}
      title={title}
    />
  );
}
