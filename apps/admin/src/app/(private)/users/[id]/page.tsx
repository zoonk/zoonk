import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailHeaderSkeleton,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminNotice } from "@/components/admin-notice";
import { AdminSectionSkeleton } from "@/components/admin-section";
import { AdminRecordTabs, readAdminTab } from "@/components/admin-tabs";
import { AdminUserAvatar } from "@/components/admin-user-avatar";
import { getUser } from "@/data/users/get-user";
import { getUserSubscriptions } from "@/data/users/get-user-subscriptions";
import { capitalize, formatDate } from "@/lib/format";
import { getLearnerLabel } from "@/lib/learner-label";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserAccount } from "./user-account";
import { UserActionsMenu } from "./user-actions-menu";
import { UserActivity, UserActivitySkeleton } from "./user-activity";
import { UserAiSpend } from "./user-ai-spend";
import { UserGoals, UserPlans } from "./user-goals";
import { UserLearnerSkills } from "./user-learner-skills";
import { UserLessonKinds } from "./user-learning";
import { UserMemorySection } from "./user-memory";
import { UserMessages } from "./user-messages";
import { UserReminders, UserSettings } from "./user-settings";
import { UserStudyChart } from "./user-study-chart";
import { OVERVIEW_DAYS, UserStudySessions } from "./user-study-sessions";
import { UserSubscription } from "./user-subscription";
import { UserSummary, UserSummarySkeleton } from "./user-summary";
import { USER_TABS, type UserTab } from "./user-tabs";

export async function generateMetadata({ params }: PageProps<"/users/[id]">): Promise<Metadata> {
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const record = await getUser(id);

  if (!record) {
    notFound();
  }

  return { title: getLearnerLabel(record) };
}

const USER_PARENTS = [{ href: "/users", label: "Users" }];

export default function UserDetailPage({ params, searchParams }: PageProps<"/users/[id]">) {
  return (
    <AdminDetailPage>
      <Suspense fallback={<UserDetailSkeleton />}>
        <UserDetailContent params={params} searchParams={searchParams} />
      </Suspense>
    </AdminDetailPage>
  );
}

async function UserDetailContent({ params, searchParams }: PageProps<"/users/[id]">) {
  const [{ id: userId }, { tab: requestedTab }] = await Promise.all([params, searchParams]);

  if (!isUuid(userId)) {
    notFound();
  }

  const tab = readAdminTab({ tabs: USER_TABS, value: requestedTab });

  return (
    <>
      <Suspense fallback={<AdminDetailHeaderSkeleton actions="menu" parents={USER_PARENTS} />}>
        <UserHeader userId={userId} />
      </Suspense>

      <AdminDetailBody>
        <Suspense fallback={null}>
          <UserBanNotice userId={userId} />
        </Suspense>
        <AdminRecordTabs current={tab} label="User" path={`/users/${userId}`} tabs={USER_TABS} />
        <UserTabContent tab={tab} userId={userId} />
      </AdminDetailBody>
    </>
  );
}

function UserTabContent({ tab, userId }: { tab: UserTab | undefined; userId: string }) {
  if (tab === "plan") {
    return (
      <Suspense fallback={<AdminSectionSkeleton />}>
        <UserPlans userId={userId} />
      </Suspense>
    );
  }

  if (tab === "learning") {
    return (
      <>
        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserLearnerSkills userId={userId} />
        </Suspense>
        <Suspense
          fallback={
            <AdminSectionSkeleton>
              <UserActivitySkeleton />
            </AdminSectionSkeleton>
          }
        >
          <UserActivity userId={userId} />
        </Suspense>
        <Suspense fallback={<AdminSectionSkeleton rows={2} />}>
          <UserLessonKinds userId={userId} />
        </Suspense>
        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserStudySessions userId={userId} />
        </Suspense>
      </>
    );
  }

  if (tab === "memory") {
    return (
      <Suspense fallback={<AdminSectionSkeleton />}>
        <UserMemorySection userId={userId} />
      </Suspense>
    );
  }

  if (tab === "account") {
    return (
      <>
        <div className="grid gap-8 xl:grid-cols-2 xl:gap-10">
          <Suspense fallback={<AdminSectionSkeleton rows={5} />}>
            <UserAccount userId={userId} />
          </Suspense>
          <div className="flex min-w-0 flex-col gap-8">
            <Suspense fallback={<AdminSectionSkeleton rows={3} />}>
              <UserSettings userId={userId} />
            </Suspense>
            <Suspense fallback={<AdminSectionSkeleton rows={3} />}>
              <UserReminders userId={userId} />
            </Suspense>
          </div>
        </div>
        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserAiSpend userId={userId} />
        </Suspense>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={<UserSummarySkeleton />}>
        <UserSummary userId={userId} />
      </Suspense>

      <AdminDetailColumns
        aside={
          <>
            <Suspense fallback={<AdminSectionSkeleton rows={2} />}>
              <UserSubscription userId={userId} />
            </Suspense>
            <Suspense fallback={<AdminSectionSkeleton rows={2} />}>
              <UserMessages userId={userId} />
            </Suspense>
          </>
        }
      >
        <Suspense fallback={<AdminSectionSkeleton rows={2} />}>
          <UserGoals userId={userId} />
        </Suspense>
        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserStudyChart userId={userId} />
        </Suspense>
        <Suspense fallback={<AdminSectionSkeleton />}>
          <UserStudySessions limit={OVERVIEW_DAYS} userId={userId} />
        </Suspense>
      </AdminDetailColumns>
    </>
  );
}

async function UserHeader({ userId }: { userId: string }) {
  "use cache: private";

  const [user, subscriptions] = await Promise.all([getUser(userId), getUserSubscriptions(userId)]);

  if (!user) {
    notFound();
  }

  const name = getLearnerLabel(user);
  const lastActive = user.progress?.lastActiveAt;

  return (
    <AdminDetailHeader
      alert={user.banned ? "Banned" : null}
      facts={[
        name !== user.email && user.email,
        user.role === "admin" && "Admin",
        capitalize(subscriptions.active?.plan ?? "free"),
        lastActive && `Active ${formatDate(lastActive)}`,
        `Joined ${formatDate(user.createdAt)}`,
      ]}
      mark={<AdminUserAvatar size="default" user={user} />}
      menu={
        <UserActionsMenu
          analyticsDisabled={user.analyticsDisabled}
          banned={user.banned ?? false}
          userId={user.id}
          userName={name}
        />
      }
      parents={USER_PARENTS}
      title={name}
    />
  );
}

async function UserBanNotice({ userId }: { userId: string }) {
  "use cache: private";

  const user = await getUser(userId);

  if (!user?.banned) {
    return null;
  }

  return (
    <AdminNotice
      title={
        user.banExpires ? `Banned until ${formatDate(user.banExpires)}` : "Banned, no end date"
      }
      tone="destructive"
    >
      {user.banReason}
    </AdminNotice>
  );
}

function UserDetailSkeleton() {
  return (
    <>
      <AdminDetailHeaderSkeleton actions="menu" parents={USER_PARENTS} />

      <AdminDetailBody>
        <AdminSectionSkeleton rows={2} />
        <AdminSectionSkeleton />
      </AdminDetailBody>
    </>
  );
}
