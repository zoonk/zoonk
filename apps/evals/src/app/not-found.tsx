import { EvalPageTop } from "@/components/eval-page-top";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ContainerBody, ContainerDescription } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-col gap-4">
      <EvalPageTop title="Page not found">
        <ContainerDescription>No task or model has this address.</ContainerDescription>
      </EvalPageTop>

      <ContainerBody>
        <Link className={buttonVariants({ className: "self-start", variant: "outline" })} href="/">
          See all tasks
        </Link>
      </ContainerBody>
    </main>
  );
}
