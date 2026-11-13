import { AdminPage, AdminPageBody, AdminPageHeader } from "@/components/admin-page";
import { type Metadata } from "next";
import { Suspense } from "react";
import { MissingAudioList, MissingAudioListSkeleton } from "./missing-audio-list";

export const metadata: Metadata = { title: "Missing audio" };

export default function MissingAudioPage() {
  return (
    <AdminPage>
      <AdminPageHeader parent={{ href: "/media", label: "Media" }} title="Missing audio">
        Words and sentences in Library lessons without audio. Audio is shared per language, so one
        upload fixes every lesson that uses it.
      </AdminPageHeader>

      <AdminPageBody>
        <Suspense fallback={<MissingAudioListSkeleton />}>
          <MissingAudioList />
        </Suspense>
      </AdminPageBody>
    </AdminPage>
  );
}
