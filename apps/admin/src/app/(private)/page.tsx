import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Suspense } from "react";
import { AppStats, AppStatsFallback } from "./app-stats";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zoonk Admin",
};

export default function Home() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Admin Dashboard</ContainerTitle>
          <ContainerDescription>Manage users and system settings</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AppStatsFallback />}>
          <AppStats />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
