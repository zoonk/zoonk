import {
  BookOpenTextIcon,
  Brain,
  ChartNoAxesColumnIncreasingIcon,
  Gem,
  GraduationCapIcon,
  Home,
  IdCardLanyard,
  Languages,
  LayoutGrid,
  LifeBuoy,
  LogIn,
  Newspaper,
  PlusIcon,
  Search,
  Settings,
  TargetIcon,
  ZapIcon,
} from "lucide-react";

const menu = {
  activity: { icon: ChartNoAxesColumnIncreasingIcon, url: "/activity" },
  blog: { icon: Newspaper, url: "/blog" },
  courses: { icon: LayoutGrid, url: "/courses" },
  energy: { icon: ZapIcon, url: "/energy" },
  home: { icon: Home, url: "/" },
  language: { icon: Languages, url: "/language" },
  level: { icon: Brain, url: "/level" },
  login: { icon: LogIn, url: "/login" },
  myCourses: { icon: LayoutGrid, url: "/my" },
  profile: { icon: IdCardLanyard, url: "/profile" },
  score: { icon: TargetIcon, url: "/score" },
  search: { icon: Search, url: "/search" },
  settings: { icon: Settings, url: "/settings" },
  start: { icon: PlusIcon, url: "/start" },
  startExam: { icon: GraduationCapIcon, url: "/start/exam" },
  startLearn: { icon: BookOpenTextIcon, url: "/start/learn" },
  startSpeak: { icon: Languages, url: "/start/speak" },
  subscription: { icon: Gem, url: "/subscription" },
  support: { icon: LifeBuoy, url: "/support" },
} as const;

export function getMenu<Key extends keyof typeof menu>(key: Key) {
  return menu[key];
}
