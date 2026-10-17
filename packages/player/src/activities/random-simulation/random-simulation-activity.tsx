"use client";

import { type ActivityRendererProps } from "../activity-renderer";
import { ChanceSimulation } from "./chance-simulation";
import { SamplingSimulation } from "./sampling-simulation";

type RandomSimulationProps = ActivityRendererProps<"randomSimulation">;

/**
 * Something random run hundreds of times: how often a hit comes up (guess first, then watch the
 * runs settle near the exact chance), or how the results of samples spread less as samples grow.
 */
export function RandomSimulationActivity({ content, ...props }: RandomSimulationProps) {
  const { fields } = content;

  if (fields.mode === "chance") {
    return <ChanceSimulation {...props} content={{ ...content, fields }} />;
  }

  return <SamplingSimulation {...props} content={{ ...content, fields }} />;
}
