import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zoonk/ui/components/card";
import {
  Container,
  ContainerDescription,
  ContainerHeader,
  ContainerTitle,
} from "@zoonk/ui/components/container";
import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Zoonk Admin",
};

const adminItems = [
  {
    description: "View and manage all users in the system",
    href: "/users",
    icon: UsersIcon,
    title: "Users",
  },
] as const;

export default function Home() {
  return (
    <Container>
      <ContainerHeader>
        <ContainerTitle>Admin Dashboard</ContainerTitle>
        <ContainerDescription>
          Manage users and system settings
        </ContainerDescription>
      </ContainerHeader>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link href={item.href} key={item.href}>
              <Card className="transition-colors hover:border-primary">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </Container>
  );
}
