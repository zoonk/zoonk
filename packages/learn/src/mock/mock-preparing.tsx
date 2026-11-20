import { useExtracted } from "next-intl";
import { GateWords } from "../_components/subscribe-gate";

export function MockPreparingWords() {
  const t = useExtracted();

  return (
    <GateWords
      line={t("Come back to this page to start it.")}
      title={t("Your mock exam is being prepared")}
    />
  );
}
