import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Suspense } from "react";
import UserList from "./user-list";
import { UserSearch } from "./user-search";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Users</ContainerTitle>
          <ContainerDescription>Manage all users in the system.</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<div className="h-10" />}>
          <UserSearch />
        </Suspense>

        <Suspense>
          <UserList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
