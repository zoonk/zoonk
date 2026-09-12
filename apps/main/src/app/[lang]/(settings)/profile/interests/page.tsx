import { Link } from "@/i18n/navigation";
import { getCurrentUserLearningProfile } from "@zoonk/core/users/learning-profile";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { ProtectedSection } from "../../_components/protected-section";
import { InterestsForm } from "./interests-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Interests") };
}

async function InterestsContent() {
  const result = await getCurrentUserLearningProfile();

  return (
    <ProtectedSection>
      {result.status === "ready" && <InterestsForm interests={result.profile.interests} />}
    </ProtectedSection>
  );
}

export default async function InterestsPage() {
  const t = await getExtracted();

  return (
    <Container>
      <ContainerHeader>
        <ContainerHeaderGroup>
          <Link
            className="text-muted-foreground mb-3 inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4"
            href="/profile"
          >
            {t("Back to profile")}
          </Link>
          <ContainerTitle>{t("Interests")}</ContainerTitle>
          <ContainerDescription>
            {t("Learn through examples that feel familiar.")}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>
      <ContainerBody>
        <Suspense fallback={<Skeleton className="h-60 w-full max-w-md" />}>
          <InterestsContent />
        </Suspense>
      </ContainerBody>
    </Container>
  );
}
