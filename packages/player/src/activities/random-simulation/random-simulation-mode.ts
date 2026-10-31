import { type ActivityRendererProps } from "../activity-renderer";

type RandomSimulationProps = ActivityRendererProps<"randomSimulation">;
type Content = RandomSimulationProps["content"];

export type RandomSimulationMode<TMode extends Content["fields"]["mode"]> = Omit<
  RandomSimulationProps,
  "content"
> & { content: Content & { fields: Extract<Content["fields"], { mode: TMode }> } };
