import {
  BarChart3Icon,
  BookOpen,
  BrainCircuitIcon,
  CpuIcon,
  CreditCardIcon,
  FileTextIcon,
  FileWarningIcon,
  GraduationCapIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  ListChecksIcon,
  MessagesSquareIcon,
  PhoneIcon,
  ThumbsUpIcon,
  TrophyIcon,
  UserXIcon,
  Users,
} from "lucide-react";

export const adminNavigation = [
  {
    items: [
      { icon: HomeIcon, label: "Home", url: "/" },
      { icon: BarChart3Icon, label: "Stats", url: "/stats" },
      { icon: ThumbsUpIcon, label: "Feedback", url: "/feedback/messages" },
      { icon: CpuIcon, label: "AI", url: "/ai" },
      { icon: PhoneIcon, label: "Live calls", url: "/live-calls" },
    ],
    label: "Overview",
  },
  {
    items: [
      { icon: Users, label: "Users", url: "/users" },
      { icon: TrophyIcon, label: "Leaderboard", url: "/leaderboard" },
      { icon: CreditCardIcon, label: "Subscriptions", url: "/subscriptions" },
      { icon: UserXIcon, label: "Account deletions", url: "/account-deletions" },
    ],
    label: "Learners",
  },
  {
    items: [
      { icon: BookOpen, label: "Courses", url: "/courses" },
      { icon: LayersIcon, label: "Lessons", url: "/lessons" },
      { icon: MessagesSquareIcon, label: "Questions", url: "/questions" },
    ],
    label: "Content",
  },
  {
    items: [
      { icon: BrainCircuitIcon, label: "Skills", url: "/skills" },
      { icon: ListChecksIcon, label: "Items", url: "/items" },
      { icon: FileTextIcon, label: "Sources", url: "/sources" },
      { icon: GraduationCapIcon, label: "Exams", url: "/exams" },
      { icon: ImageIcon, label: "Media", url: "/media" },
      { icon: FileWarningIcon, label: "Needs review", url: "/review-flags" },
    ],
    label: "Library",
  },
] as const;
