import { getSession } from "@zoonk/core/users/session/get";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import Link from "next/link";
import { getExtracted } from "next-intl/server";

export default async function Unauthorized() {
  const t = await getExtracted();

  const session = await getSession();

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
        {session ? (
          <Link className={buttonVariants()} href="/logout" prefetch={false}>
            {t("Logout")}
          </Link>
        ) : (
          <Link className={buttonVariants()} href="/login" prefetch={true}>
            {t("Login")}
          </Link>
        )}
      </ContainerBody>
    </Container>
  );
}
