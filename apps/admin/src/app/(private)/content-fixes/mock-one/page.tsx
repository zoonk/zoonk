import { Facts, readView } from "@/app/(private)/_mock/kit";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminDisclosure } from "@/components/admin-json";
import { AdminSection } from "@/components/admin-section";
import { Button } from "@zoonk/ui/components/button";
import { MockLink } from "../../_mock/parts";

const BEFORE =
  "Lia opens her broker app: a share of the bakery chain shows $20.10. A second later it shows $20.12. Nobody at the company did anything. So who just changed the price?";

const AFTER =
  "Lia opens her broker app: a share of the bakery chain shows $20.10. A second later it shows $20.12. Nobody at the company did anything. So who changed the price?";

export default async function ContentFixMockPage({
  searchParams,
}: PageProps<"/content-fixes/mock-one">) {
  const technical = readView((await searchParams).view) === "technical";

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        actions={
          <>
            <Button size="sm" variant="outline">
              Reject
            </Button>
            <Button size="sm">Add a passkey to approve</Button>
          </>
        }
        facts={["Waiting for review", "Proposed Nov 12, 2026, 4:16 AM by Admin User in the CLI"]}
        parents={[{ href: "/content-fixes", label: "Content fixes" }]}
        title="Fix to Where a price comes from"
      />

      <AdminDetailBody>
        <AdminDetailColumns
          aside={
            <>
              <AdminSection title="Where">
                <Facts
                  rows={[
                    ["Lesson", <MockLink key="lesson">Where a price comes from</MockLink>],
                    ["Chapter", "How trading works"],
                    ["Course", "How the stock market works"],
                    ["Language", "English"],
                    ["In Zoonk", <MockLink key="see">See it as learners do</MockLink>],
                  ]}
                />
              </AdminSection>

              <AdminDisclosure label="Technical details" open={technical}>
                <div className="pb-2 text-sm">
                  <Facts
                    rows={[
                      ["Environment", "Development · main.zoonk.localhost:1355"],
                      ["Screen id", "1f91e170-d8e7-84e8-8815-35d53647aa0e"],
                      ["Field", "content.text"],
                    ]}
                  />
                </div>
              </AdminDisclosure>
            </>
          }
        >
          <AdminSection title="Why">
            <p className="max-w-2xl text-sm leading-6">
              The hook says the price moved from $20.10 to $20.12 &quot;a second later&quot;, but
              the worked example on screen 4 starts from $20.12 as the cheapest ask. A learner
              reported the numbers do not line up.
            </p>
          </AdminSection>

          <AdminSection title="Changes: screen 1, the hook">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">Before</span>
                <p className="bg-muted rounded-lg p-3 text-sm leading-6">
                  {BEFORE.split("just ")[0]}
                  <span className="bg-destructive/15 text-destructive-text rounded px-0.5">
                    just
                  </span>{" "}
                  {BEFORE.split("just ")[1]}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">After</span>
                <p className="bg-muted rounded-lg p-3 text-sm leading-6">{AFTER}</p>
              </div>
            </div>
            <span className="flex gap-4">
              <a className="text-muted-foreground text-xs font-medium" href="#">
                Whole screen before
              </a>
              <a className="text-muted-foreground text-xs font-medium" href="#">
                Whole screen after
              </a>
            </span>
          </AdminSection>

          <AdminSection title="What else approving does">
            <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
              <li>Learners who open the lesson next get the fixed version.</li>
              <li>The lesson&apos;s idea marks, icons and maps stay as they were drawn.</li>
            </ul>
          </AdminSection>

          <p className="text-muted-foreground text-compact max-w-2xl">
            Approving takes a passkey, so only you can apply a fix. Add one in your Zoonk settings,
            then come back to this page.
          </p>
        </AdminDetailColumns>
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
