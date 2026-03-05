import {
  Container,
  ContainerBody,
  ContainerDescription,
  ContainerHeader,
  ContainerHeaderGroup,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { ActivityIcon, ArrowRightIcon, BookOpenIcon, TrendingUpIcon } from "lucide-react";
import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stats",
};

const sections = [
  {
    description: "New signups, activation rate, free-to-paid conversion, and subscriber breakdown.",
    href: "/stats/growth",
    icon: TrendingUpIcon,
    title: "Growth & Sustainability",
  },
  {
    description:
      "Active learners, accuracy rate, time per activity, learning time trends, and activity breakdown.",
    href: "/stats/engagement",
    icon: ActivityIcon,
    title: "Engagement & Learning",
  },
  {
    description: "New courses and lessons, content creation trends, and content totals.",
    href: "/stats/content",
    icon: BookOpenIcon,
    title: "Content & Operations",
  },
] as const;

export default function StatsPage() {
  return (
    <Container>
      <ContainerHeader variant="sidebar">
        <ContainerHeaderGroup>
          <ContainerTitle>Stats</ContainerTitle>
          <ContainerDescription>Detailed analytics for your platform.</ContainerDescription>
        </ContainerHeaderGroup>
      </ContainerHeader>

      <ContainerBody>
        <ItemGroup>
          {sections.map((section) => (
            <Item key={section.href} render={<Link href={section.href} />}>
              <ItemMedia variant="icon">
                <section.icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{section.title}</ItemTitle>
                <ItemDescription>{section.description}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <ArrowRightIcon aria-hidden className="text-muted-foreground/50 size-4" />
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </ContainerBody>
    </Container>
  );
}
