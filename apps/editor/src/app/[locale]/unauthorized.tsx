import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { getExtracted } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function Unauthorized() {
  const t = await getExtracted();

  return (
    <Container variant="centered">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>{t("401 - Unauthorized")}</ContainerTitle>

          <ContainerDescription>
            {t(
              "You can't edit courses for this organization. Log in with another account or switch to a different organization.",
            )}
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="justify-end">
        <Link className={buttonVariants()} href="/logout" prefetch={false}>
          {t("Logout")}
        </Link>
      </ContainerBody>
    </Container>
  );
}
