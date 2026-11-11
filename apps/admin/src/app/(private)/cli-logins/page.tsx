import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { CliLoginList, CliLoginListSkeleton } from "./cli-login-list";

export const metadata: Metadata = { title: "CLI logins" };

export default function CliLoginsPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>CLI logins</ContainerTitle>
          <ContainerDescription>
            Each row is one machine logged in with pnpm zoonk login. A login renews itself while
            it&apos;s used and ends after 30 days without use. Revoke a lost machine&apos;s login to
            end it now; the person&apos;s other machines stay logged in, and that machine can log in
            again.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<CliLoginListSkeleton />}>
          <CliLoginList />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
