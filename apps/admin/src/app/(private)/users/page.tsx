import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { Suspense } from "react";
import UserList from "./user-list";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>Users</ContainerTitle>
        <ContainerDescription>
          Manage all users in the system.
        </ContainerDescription>
      </ContainerHeader>

      <Suspense>
        <UserList searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
