import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerBody,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { cn } from "@zoonk/ui/lib/utils";
import { ProtectedSection } from "@zoonk/ui/patterns/auth/protected";
import { getExtracted } from "next-intl/server";

export async function LoginRequired({ title }: { title: string }) {
  const t = await getExtracted();

  return (
    <Container variant="narrow">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{title}</ContainerTitle>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ProtectedSection
          actions={
            <Link className={cn(buttonVariants(), "w-max")} href="/login">
              {t("Login")}
            </Link>
          }
          alertTitle={t("You need to be logged in to access this page.")}
          centered
          state="unauthenticated"
        />
      </ContainerBody>
    </Container>
  );
}
