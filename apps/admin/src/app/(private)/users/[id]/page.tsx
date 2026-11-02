import {
  AdminDetailBody,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { getUser } from "@/data/users/get-user";
import { formatDate } from "@/lib/format";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserAccount } from "./user-account";
import { UserActionsMenu } from "./user-actions-menu";
import { UserAiSpend } from "./user-ai-spend";
import { UserGoals } from "./user-goals";
import { UserLearnerSkills } from "./user-learner-skills";
import { UserLearningProfile } from "./user-learning-profile";
import { UserLesson } from "./user-lesson";
import { UserMemorySection } from "./user-memory";
import { UserStudySessions } from "./user-study-sessions";
import { UserSubscription } from "./user-subscription";

export async function generateMetadata({ params }: PageProps<"/users/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getUser(id);

  if (!record) {
    notFound();
  }

  return { title: record.name || record.username || record.email };
}

const USER_PARENTS = [{ href: "/users", label: "Users" }];

export default function UserDetailPage({ params }: PageProps<"/users/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<UserDetailSkeleton />}>
        <UserDetailContent params={params} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function UserDetailContent({ params }: Pick<PageProps<"/users/[id]">, "params">) {
  const { id: userId } = await params;

  if (!isUuid(userId)) {
    notFound();
  }

  return (
    <>
      <Suspense fallback={<AdminDetailHeaderSkeleton actions="menu" parents={USER_PARENTS} />}>
        <UserHeader userId={userId} />
      </Suspense>

      <AdminDetailBody>
        <Suspense fallback={<AdminSectionSkeleton rows={7} />}>
          <UserAccount userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton rows={3} />}>
          <UserSubscription userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton rows={8} />}>
          <UserLesson userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton rows={5} />}>
          <UserLearningProfile userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserGoals userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserStudySessions userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <UserLearnerSkills userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <UserMemorySection userId={userId} />
        </Suspense>

        <Suspense fallback={<AdminSectionSkeleton description />}>
          <UserAiSpend userId={userId} />
        </Suspense>
      </AdminDetailBody>
    </>
  );
}

async function UserHeader({ userId }: { userId: string }) {
  "use cache: private";

  const user = await getUser(userId);

  if (!user) {
    notFound();
  }

  const name = user.name || user.username || user.email;

  return (
    <AdminDetailHeader
      menu={<UserActionsMenu banned={user.banned ?? false} userId={user.id} userName={name} />}
      alert={user.banned ? "Banned" : null}
      facts={[
        name !== user.email && user.email,
        user.username && name !== user.username && `@${user.username}`,
        user.role === "admin" && "Admin",
        `Joined ${formatDate(user.createdAt)}`,
      ]}
      parents={USER_PARENTS}
      title={name}
    />
  );
}

function UserDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="menu" parents={USER_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={7} />
        <AdminSectionSkeleton rows={3} />
        <AdminSectionSkeleton rows={8} />
      </AdminDetailBody>
    </>
  );
}
