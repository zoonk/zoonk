import {
  ContainerAction,
  ContainerActions,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { getExtracted } from "next-intl/server";

export async function HomeContainerHeader({
  params,
}: {
  params: PageProps<"/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;

  const t = await getExtracted();

  return (
    <ContainerHeader>
      <ContainerHeaderGroup>
        <ContainerTitle>{t("Courses")}</ContainerTitle>
        <ContainerDescription>
          {t("Select a course to edit its content")}
        </ContainerDescription>
      </ContainerHeaderGroup>

      <ContainerActions>
        <ContainerAction
          icon={PlusIcon}
          render={<Link href={`/${orgSlug}/new-course`} prefetch={true} />}
        >
          {t("Create course")}
        </ContainerAction>
      </ContainerActions>
    </ContainerHeader>
  );
}
