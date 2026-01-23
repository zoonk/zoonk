import {
  ContainerAction,
  ContainerActions,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { PlusIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

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
        <ContainerTitle>{t("Draft courses")}</ContainerTitle>
        <ContainerDescription>{t("Courses that are not published yet")}</ContainerDescription>
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
