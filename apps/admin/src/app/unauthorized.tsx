import { LogoutButton } from "@/components/logout";
import { getSession } from "@zoonk/core/users/session";
import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { Suspense } from "react";

async function SignedInAs() {
  const session = await getSession();
  return session ? `You're signed in as ${session.user.email}. ` : null;
}

export default function Unauthorized() {
  return (
    <Container variant="centered">
      <ContainerHeader>
        <ContainerHeaderGroup>
          <ContainerTitle>This account can&apos;t open Admin</ContainerTitle>
          <ContainerDescription>
            <Suspense fallback={null}>
              <SignedInAs />
            </Suspense>
            Admin is for Zoonk staff.
          </ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody className="justify-end">
        <LogoutButton />
      </ContainerBody>
    </Container>
  );
}
