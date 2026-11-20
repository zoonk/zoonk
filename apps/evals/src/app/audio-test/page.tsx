import { EVALS_HOME, EvalPageTop } from "@/components/eval-page-top";
import { ContainerBody } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { AudioTestForm } from "./form";

export const metadata: Metadata = { title: "Audio test" };

export default function AudioTestPage() {
  return (
    <main className="flex min-h-dvh flex-col gap-4">
      <EvalPageTop parent={EVALS_HOME} title="Audio test" />

      <ContainerBody className="sm:flex-1">
        <AudioTestForm />
      </ContainerBody>
    </main>
  );
}
