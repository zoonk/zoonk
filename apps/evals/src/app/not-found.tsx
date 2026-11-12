import { AppBreadcrumb, HomeLinkBreadcrumb } from "@/components/breadcrumb";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-col gap-4">
      <AppBreadcrumb>
        <HomeLinkBreadcrumb />
      </AppBreadcrumb>

      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>Page not found</ContainerTitle>
          <ContainerDescription>No task or model has this address.</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Link className={buttonVariants({ className: "self-start", variant: "outline" })} href="/">
          See all tasks
        </Link>
      </ContainerBody>
    </main>
  );
}
