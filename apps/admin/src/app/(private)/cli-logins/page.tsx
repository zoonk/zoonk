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
            Everyone logged in with pnpm zoonk login, and on how many machines. A login renews
            itself while it&apos;s used and ends after 30 days without use. Revoke ends all of a
            person&apos;s CLI logins at once, on every machine; they log in again on the machines
            they still have.
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
