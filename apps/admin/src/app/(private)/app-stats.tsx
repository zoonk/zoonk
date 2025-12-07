import { countUsers } from "@zoonk/core/users";
import { UsersIcon } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { Stats, StatsSkeleton } from "@/components/stats";

export async function AppStats() {
  "use cache";
  cacheLife("hours");
  cacheTag("stats");

  const totalUsers = await countUsers();

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
