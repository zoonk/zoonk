import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { Suspense } from "react";
import UserList from "./user-list";
import { UserSearch } from "./user-search";

export const metadata: Metadata = {
  title: "Users",
};

export default function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>Users</ContainerTitle>
        <ContainerDescription>
          Manage all users in the system.
        </ContainerDescription>
      </ContainerHeader>

      <div className="mb-4">
        <Suspense fallback={<div className="h-10" />}>
          <UserSearch />
        </Suspense>
      </div>

      <Suspense>
        <UserList searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
