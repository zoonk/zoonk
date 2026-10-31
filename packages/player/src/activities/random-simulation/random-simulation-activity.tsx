"use client";

import { type ActivityRendererProps } from "../activity-renderer";
import { ChanceSimulation } from "./chance-simulation";
import { SamplingSimulation } from "./sampling-simulation";

type RandomSimulationProps = ActivityRendererProps<"randomSimulation">;

export function RandomSimulationActivity({ content, ...props }: RandomSimulationProps) {
  const { fields } = content;

  if (fields.mode === "chance") {
    return <ChanceSimulation {...props} content={{ ...content, fields }} />;
  }

  return <SamplingSimulation {...props} content={{ ...content, fields }} />;
}
