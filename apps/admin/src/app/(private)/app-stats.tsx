import { prisma } from "@zoonk/db";
import { UsersIcon } from "lucide-react";
import { Stats, StatsSkeleton } from "@/components/stats";

export async function AppStats() {
  const totalUsers = await prisma.user.count();

  return (
    <div className="flex items-center">
      <div className="grid w-full grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
        <Stats icon={<UsersIcon />} title="Users" value={totalUsers} />
      </div>
    </div>
  );
}

export function AppStatsFallback() {
  return (
    <div className="flex items-center">
      <div className="grid w-full grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-4">
        <StatsSkeleton />
        <StatsSkeleton />
        <StatsSkeleton />
        <StatsSkeleton />
      </div>
    </div>
  );
}
