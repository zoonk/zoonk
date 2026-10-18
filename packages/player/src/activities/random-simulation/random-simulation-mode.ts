import { type ActivityRendererProps } from "../activity-renderer";

type RandomSimulationProps = ActivityRendererProps<"randomSimulation">;
type Content = RandomSimulationProps["content"];

/** A random simulation's props narrowed to one mode, so its fields are typed for that mode. */
export type RandomSimulationMode<TMode extends Content["fields"]["mode"]> = Omit<
  RandomSimulationProps,
  "content"
> & { content: Content & { fields: Extract<Content["fields"], { mode: TMode }> } };
