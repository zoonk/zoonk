import { type InboxQueueName } from "@/data/inbox/get-inbox";
import {
  BarChart3Icon,
  BookOpenIcon,
  BrainCircuitIcon,
  CpuIcon,
  CreditCardIcon,
  FilePenLineIcon,
  FileTextIcon,
  FileWarningIcon,
  GraduationCapIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  type LucideIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  MicOffIcon,
  TargetIcon,
  TerminalIcon,
  TrophyIcon,
  UserXIcon,
  UsersIcon,
} from "lucide-react";
import { type Route } from "next";

type AdminNavItem = {
  icon: LucideIcon;
  label: string;
  /** The Inbox queue whose waiting count follows the label. */
  queue?: InboxQueueName;
  url: Route;
};

/**
 * The sidebar, grouped by the job staff come to do: work a queue, help a learner, look at content,
 * check the numbers. One name per thing: every page, link and palette entry uses these labels.
 */
export const adminNavigation: { items: AdminNavItem[]; label?: string }[] = [
  { items: [{ icon: HomeIcon, label: "Home", url: "/" }] },
  {
    items: [
      {
        icon: MessageSquareTextIcon,
        label: "Feedback",
        queue: "feedback",
        url: "/feedback/messages",
      },
      {
        icon: FilePenLineIcon,
        label: "Content fixes",
        queue: "contentFixes",
        url: "/content-fixes",
      },
      {
        icon: FileWarningIcon,
        label: "Source changes",
        queue: "sourceChanges",
        url: "/review-flags",
      },
      {
        icon: UserXIcon,
        label: "Account deletions",
        queue: "accountDeletions",
        url: "/account-deletions",
      },
    ],
    label: "Inbox",
  },
  {
    items: [
      { icon: UsersIcon, label: "Users", url: "/users" },
      { icon: CreditCardIcon, label: "Subscriptions", url: "/subscriptions" },
      { icon: TargetIcon, label: "Goal prompts", url: "/prompts" },
      { icon: MessagesSquareIcon, label: "Tutor questions", url: "/questions" },
    ],
    label: "Learners",
  },
  {
    items: [
      { icon: BookOpenIcon, label: "Courses", url: "/courses" },
      { icon: LayersIcon, label: "Lessons", url: "/lessons" },
      { icon: ListChecksIcon, label: "Practice questions", url: "/items" },
      { icon: BrainCircuitIcon, label: "Skills", url: "/skills" },
      { icon: GraduationCapIcon, label: "Exams", url: "/exams" },
      { icon: FileTextIcon, label: "Sources", url: "/sources" },
      { icon: ImageIcon, label: "Media", url: "/media" },
    ],
    label: "Library",
  },
  {
    items: [
      { icon: BarChart3Icon, label: "Stats", url: "/stats" },
      { icon: TrophyIcon, label: "Leaderboard", url: "/leaderboard" },
      { icon: CpuIcon, label: "AI", url: "/ai" },
    ],
    label: "Numbers",
  },
];

/** Pages the sidebar doesn't list: each is one click from its place, and the palette finds them. */
export const CLI_LOGINS_PAGE: AdminNavItem = {
  icon: TerminalIcon,
  label: "CLI logins",
  url: "/cli-logins",
};

const MISSING_AUDIO_PAGE: AdminNavItem = {
  icon: MicOffIcon,
  label: "Missing audio",
  url: "/media/missing-audio",
};

export const adminPages: AdminNavItem[] = [
  ...adminNavigation.flatMap((group) => group.items),
  MISSING_AUDIO_PAGE,
  CLI_LOGINS_PAGE,
];
