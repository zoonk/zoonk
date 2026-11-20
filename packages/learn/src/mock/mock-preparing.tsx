import { useExtracted } from "next-intl";
import { GateWords } from "../_components/subscribe-gate";

export function useReturnToMockLine() {
  const t = useExtracted();
  return t("Come back to this page to start it.");
}

export function MockPreparingWords({ title }: { title: string }) {
  const line = useReturnToMockLine();

  return <GateWords line={line} title={title} />;
}
