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
import { AccountDeletionList, AccountDeletionListSkeleton } from "./account-deletion-list";

export const metadata: Metadata = { title: "Account deletions" };

/** An account's analytics stay in PostHog until an admin deletes that person by hand. */
export default function AccountDeletionsPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Account deletions</ContainerTitle>
          <ContainerDescription>
            Accounts learners deleted whose analytics are still in PostHog. In PostHog, open
            Persons, search for the distinct id, and delete the person with their events and
            recordings. Then mark it here.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AccountDeletionListSkeleton />}>
          <AccountDeletionList />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
