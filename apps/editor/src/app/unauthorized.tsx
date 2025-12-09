"use client";

import { authClient } from "@zoonk/auth/client";
import { Button } from "@zoonk/ui/components/button";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { useRouter } from "next/navigation";
import { useExtracted } from "next-intl";

export default function Unauthorized() {
  const { push } = useRouter();
  const t = useExtracted();

  const logout = async () => {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => push("/login") },
    });
  };

  return (
    <Container variant="centered">
      <ContainerHeader>
        <ContainerTitle>{t("401 - Unauthorized")}</ContainerTitle>

        <ContainerDescription>
          {t(
            "You can’t edit courses for this organization. Log in with another account or switch to a different organization.",
          )}
        </ContainerDescription>
      </ContainerHeader>

      <ContainerBody className="justify-end">
        <Button onClick={logout}>{t("Logout")}</Button>
      </ContainerBody>
    </Container>
  );
}
