import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AppStats, AppStatsFallback } from "./app-stats";

export const metadata: Metadata = {
  title: "Zoonk Admin",
};

export default function Home() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerTitle>Admin Dashboard</ContainerTitle>
        <ContainerDescription>
          Manage users and system settings
        </ContainerDescription>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<AppStatsFallback />}>
          <AppStats />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
