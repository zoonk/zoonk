import { AdminBreadcrumb } from "@/components/admin-breadcrumb";
import { AdminHeader } from "@/components/admin-header";
import { AdminPage, AdminPageBody } from "@/components/admin-page";
import { ContainerDescription, ContainerTitle } from "@zoonk/ui/components/container";
import { type Metadata } from "next";
import { Suspense } from "react";
import { MissingAudioList, MissingAudioListSkeleton } from "./missing-audio-list";

export const metadata: Metadata = { title: "Missing audio" };

export default function MissingAudioPage() {
  return (
    <AdminPage>
      <AdminHeader
        crumb={
          <AdminBreadcrumb current="Missing audio" parents={[{ href: "/media", label: "Media" }]} />
        }
        title={<ContainerTitle>Missing audio</ContainerTitle>}
      >
        <ContainerDescription className="max-w-column">
          Words and sentences in Library lessons without audio. Audio is shared per language, so one
          upload fixes every lesson that uses it.
        </ContainerDescription>
      </AdminHeader>

      <AdminPageBody>
        <Suspense fallback={<MissingAudioListSkeleton />}>
          <MissingAudioList />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
