import { vi } from "vitest";
import { type ProgramSandbox } from "../sandbox-driver";

const done = () => Promise.resolve();

type FakeStage = { exitCode?: number; stderr?: string; stdout?: string };

export function scriptedSandbox({
  compile = {},
  run = {},
}: { compile?: FakeStage; run?: FakeStage } = {}) {
  const stages = { compile, run };

  const commands = {
    read: vi.fn((path: string) => {
      const stage =
        path.endsWith("compile.stdout") || path.endsWith("compile.stderr")
          ? stages.compile
          : stages.run;

      return Promise.resolve(
        path.endsWith(".stdout") ? (stage.stdout ?? "") : (stage.stderr ?? ""),
      );
    }),
    run: vi.fn<ProgramSandbox["run"]>(({ args: [phase] }) => {
      const stage = phase === "compile" || phase === "run" ? stages[phase] : null;
      return Promise.resolve(stage?.exitCode ?? 0);
    }),
    stop: vi.fn<ProgramSandbox["stop"]>(done),
    write: vi.fn<ProgramSandbox["write"]>(done),
  };

  return commands;
}
