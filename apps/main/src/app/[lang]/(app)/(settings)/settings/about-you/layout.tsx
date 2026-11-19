import { AboutYouList } from "./about-you-list";
import { AboutYouSplit } from "./about-you-split";

export default function AboutYouLayout({ children }: LayoutProps<"/[lang]/settings/about-you">) {
  return <AboutYouSplit list={<AboutYouList />}>{children}</AboutYouSplit>;
}
