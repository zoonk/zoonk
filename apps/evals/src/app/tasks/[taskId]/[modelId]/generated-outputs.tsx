import { type TaskModelOutputResults } from "@/lib/types";
import { Accordion } from "@zoonk/ui/components/accordion";
import { ContainerDescription } from "@zoonk/ui/components/container";
import { OutputTestCase } from "./test-case";

export function GeneratedOutputs({ outputs }: { outputs: TaskModelOutputResults }) {
  if (outputs.outputs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Generated Outputs</h2>
        <ContainerDescription>Saved outputs that have not been evaluated yet.</ContainerDescription>
      </div>

      <Accordion className="w-full">
        {outputs.outputs.map((output, index) => (
          <OutputTestCase index={index} key={output.testCaseId} output={output} />
        ))}
      </Accordion>
    </div>
  );
}
