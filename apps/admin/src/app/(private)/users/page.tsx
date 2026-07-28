import { AdminSearch, AdminSearchSkeleton } from "@/components/admin-search";
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
import { UserList, UserListSkeleton } from "./user-list";

export const metadata: Metadata = { title: "Users" };

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
        <Suspense fallback={<AdminSearchSkeleton />}>
          <AdminSearch placeholder="Search by name, username, or email..." />
        </Suspense>

        <Suspense fallback={<UserListSkeleton />}>
          <UserList searchParams={searchParams} />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
