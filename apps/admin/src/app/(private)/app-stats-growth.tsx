import { Stats } from "@/components/stats";
import { StatsSection } from "@/components/stats-section";
import { countSubscribersByPlan } from "@/data/stats/count-subscribers-by-plan";
import { countUsers } from "@/data/stats/count-users";
import { getActivationRate } from "@/data/stats/get-activation-rate";
import { getConversionRate } from "@/data/stats/get-conversion-rate";
import { CreditCardIcon, TargetIcon, UsersIcon } from "lucide-react";
import { connection } from "next/server";

export async function GrowthStats() {
  await connection();

  const [totalUsers, subscribersByPlan, activation, conversion] = await Promise.all([
    countUsers(),
    countSubscribersByPlan(),
    getActivationRate(),
    getConversionRate(),
  ]);

  return (
    <StatsSection subtitle="Platform growth and revenue health" title="Growth & Sustainability">
      <Stats
        help="All registered accounts"
        href="/users"
        icon={<UsersIcon />}
        title="Total Users"
        value={totalUsers.toLocaleString()}
      />

      <Stats
        description={`${activation.activated.toLocaleString()} of ${activation.total.toLocaleString()} users`}
        help="Users who completed at least 1 lesson"
        href="/stats/growth"
        icon={<TargetIcon />}
        title="Activation Rate"
        value={`${activation.rate.toFixed(1)}%`}
      />

      <Stats
        description={`${conversion.paid.toLocaleString()} paid of ${conversion.total.toLocaleString()} total`}
        help="Active paid subscribers vs all users"
        href="/stats/growth"
        icon={<CreditCardIcon />}
        title="Free-to-Paid"
        value={`${conversion.rate.toFixed(1)}%`}
      />

      {subscribersByPlan.map((sub) => (
        <Stats
          help={`Active subscribers on ${sub.plan} plan`}
          icon={<CreditCardIcon />}
          key={sub.plan}
          title={`${sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1)} Subscribers`}
          value={sub.count.toLocaleString()}
        />
      ))}
    </StatsSection>
  );
}
