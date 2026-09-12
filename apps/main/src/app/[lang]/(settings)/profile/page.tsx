import { Link } from "@/i18n/navigation";
import { getSession } from "@zoonk/core/users/session";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { ChevronRightIcon } from "lucide-react";
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
        <Link
          className="hover:bg-muted mt-8 flex min-h-16 max-w-md items-center justify-between gap-4 rounded-xl border p-4"
          href="/profile/interests"
        >
          <span>
            <span className="block font-medium">{t("Interests")}</span>
            <span className="text-muted-foreground text-sm">
              {t("Choose familiar contexts for personal examples.")}
            </span>
          </span>
          <ChevronRightIcon className="size-4 shrink-0" />
        </Link>
      </ContainerBody>
    </Container>
  );
}
