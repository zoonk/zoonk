import { getSession } from "@/data/users/get-session";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../_components/protected-section";
import { ProfileForm, ProfileFormSkeleton } from "./profile-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();

  return { description: t("Update your name and username on Zoonk."), title: t("Profile") };
}

async function ProfileContent() {
  const session = await getSession();

  return (
    <ProtectedSection>
      <ProfileForm
        defaultName={session?.user.name ?? ""}
        defaultUsername={session?.user.username ?? ""}
      />
    </ProtectedSection>
  );
}

export default async function ProfilePage() {
  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("Profile")}</ContainerTitle>
          <ContainerDescription>
            {t("Your name and username as they appear to others.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <Suspense fallback={<ProfileFormSkeleton />}>
          <ProfileContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
