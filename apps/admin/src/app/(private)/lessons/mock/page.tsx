import dump from "@/app/(private)/_mock/data/lesson.json";
import { type Dump, FactsFrom, TableFrom, readView } from "@/app/(private)/_mock/kit";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { DetailField, DetailFields } from "@/components/detail-field";
import { MockLink, type MockOption, MockOptions } from "../../_mock/parts";

const lesson = dump as Dump;

const TABS = [
  { label: "Screens", value: "screens" },
  { label: "Details", value: "details" },
  { label: "Written by", value: "written" },
] as const;

function Screen({
  answers,
  children,
  kind,
  number,
}: {
  answers?: string;
  children: React.ReactNode;
  kind: string;
  number: number;
}) {
  return (
    <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-4 py-5 first:pt-0">
      <span className="text-muted-foreground font-mono text-xs leading-5 tabular-nums">
        {number}
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground text-xs leading-5 font-medium">{kind}</span>
          <span className="text-muted-foreground shrink-0 text-xs">{answers}</span>
        </div>
        <div className="max-w-column flex flex-col gap-3 text-sm leading-6">{children}</div>
      </div>
    </li>
  );
}

const GUESS: MockOption[] = [
  { text: "$20.12 too" },
  { right: true, text: "The next ask, $20.15" },
  { text: "Nothing until a new seller shows up" },
];

const CHECK_ONE: MockOption[] = [
  { right: true, text: "$20.12" },
  { text: "$20.10" },
  { text: "$20.11" },
];

const CHECK_TWO: MockOption[] = [
  { right: true, text: "Investors expected even better results" },
  { text: "The exchange lowers the price of very profitable companies" },
  { text: "Record profits always make prices fall" },
];

const CHECK_THREE: MockOption[] = [
  { right: true, text: "Buyers now expect less from it, so trades close at lower prices" },
  { text: "The company lowered the price of its shares" },
  { text: "The exchange resets prices every morning" },
];

function Sum({ children }: { children: string }) {
  return <span className="font-mono text-[0.8125rem]">{children}</span>;
}

function Screens({ json }: { json: boolean }) {
  return (
    <AdminDetailColumns
      aside={
        <>
          <AdminSection title="About">
            <DetailFields>
              <DetailField label="Teaches">
                <span className="flex flex-col gap-1">
                  <MockLink>Read an order book</MockLink>
                  <MockLink>Explain where a stock&apos;s price comes from</MockLink>
                </span>
              </DetailField>
              <DetailField label="Chapter">
                <span className="flex flex-col">
                  <MockLink>How trading works</MockLink>
                  <span className="text-muted-foreground text-xs">How the stock market works</span>
                </span>
              </DetailField>
              <DetailField label="Open to">Everyone</DetailField>
            </DetailFields>
          </AdminSection>

          <AdminSection title="Learners">
            <DetailFields>
              <DetailField label="In plans">3 plans · 5 sessions</DetailField>
              <DetailField label="Buddy questions">0</DetailField>
            </DetailFields>
          </AdminSection>
        </>
      }
    >
      <div className="flex flex-col">
        <ol className="divide-y">
          <Screen kind="Hook" number={1}>
            <p>
              Lia opens her broker app: a share of the bakery chain shows $20.10. A second later it
              shows $20.12. Nobody at the company did anything. So who just changed the price?
            </p>
            {json ? (
              <pre className="bg-muted overflow-x-auto rounded-lg p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
                {HOOK_JSON}
              </pre>
            ) : null}
          </Screen>

          <Screen kind="Explanation" number={2}>
            <p className="font-medium">Two lines of people</p>
            <p>
              At every moment, buyers post the most they&apos;ll pay, called <strong>bids</strong>,
              and sellers post the least they&apos;ll accept, called <strong>asks</strong>. Together
              they form the <strong>order book</strong>.
            </p>
            <p>
              While the best bid is below the best ask, nothing happens. A trade happens only when
              someone accepts the other side&apos;s price.
            </p>
          </Screen>

          <Screen answers="No answers yet" kind="Hook · Guess" number={3}>
            <p>
              Lia buys 300 shares at the market price, but only 200 are for sale at $20.12. What
              does she pay for the other 100?
            </p>
            <MockOptions options={GUESS} />
          </Screen>

          <Screen kind="Worked example" number={4}>
            <p className="font-medium">Buying more than the first seller has</p>
            <p>
              The order book has 200 shares for sale at <strong>$20.12</strong> and 500 at{" "}
              <strong>$20.15</strong>. You buy 300 shares at the market price. How much do you pay?
            </p>
            <ol className="text-muted-foreground flex flex-col gap-1">
              <li>
                The first 200 come from the cheapest seller: <Sum>200 × 20.12 = 4,024</Sum>
              </li>
              <li>
                The other 100 come from the next one: <Sum>100 × 20.15 = 2,015</Sum>
              </li>
              <li>
                Add them up: <Sum>4,024 + 2,015 = 6,039</Sum>
              </li>
              <li>
                The average price per share: <Sum>6,039 ÷ 300 = 20.13</Sum>
              </li>
            </ol>
            <p>
              $6,039 in total, an average of $20.13 per share. And your own order moved the last
              price up to $20.15.
            </p>
          </Screen>

          <Screen answers="No answers yet" kind="Check" number={5}>
            <p>
              The best bid is $20.10 and the best ask is $20.12. You want to buy right now. What do
              you pay per share?
            </p>
            <MockOptions options={CHECK_ONE} />
          </Screen>

          <Screen kind="Explanation" number={6}>
            <p className="font-medium">Why the price moves</p>
            <p>
              The price changes whenever the balance changes. If more people want to buy than sell
              at today&apos;s price, buyers raise their bids and trades happen higher. If sellers
              rush out, they accept lower bids and the price falls.
            </p>
          </Screen>

          <Screen answers="No answers yet" kind="Activity · Chart reader" number={7}>
            <p>By what percent did the price move in the hour after the results?</p>
            <p className="text-muted-foreground">
              A price chart from 10:00 to 15:00, with the hour after the results marked. Answer:{" "}
              <span className="text-foreground font-medium">11.88%</span> (0.1 either way counts).
            </p>
          </Screen>

          <Screen answers="No answers yet" kind="Check" number={8}>
            <p>
              A company reports record profits, and its share price falls. How is that possible?
            </p>
            <MockOptions options={CHECK_TWO} />
          </Screen>

          <Screen answers="No answers yet" kind="Check" number={9}>
            <p className="text-muted-foreground">
              A company&apos;s share price dropped this morning, but nothing at the company changed:
              same sales, same plans, no news from it.
            </p>
            <p>Why did the price drop?</p>
            <MockOptions options={CHECK_THREE} />
          </Screen>

          <Screen kind="Summary" number={10}>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>Bids are what buyers offer; asks are what sellers accept.</li>
              <li>A trade happens when one side accepts the other&apos;s price.</li>
              <li>The price on the screen is just the last trade.</li>
              <li>Prices move with expectations, so good news can still sink a stock.</li>
            </ul>
          </Screen>
        </ol>
        <a
          className="text-muted-foreground hover:text-foreground flex min-h-11 items-center self-start text-xs font-medium"
          href="#"
        >
          {json ? "Hide JSON" : "Show JSON"}
        </a>
      </div>
    </AdminDetailColumns>
  );
}

function Details() {
  return (
    <AdminSection title="Details">
      <FactsFrom
        dump={lesson}
        omit={["Held back", "Spec", "Skills", "Chapters", "Visibility", "In plans"]}
        rename={{ "Can do": "What the learner can do after" }}
        section="Details"
      />
    </AdminSection>
  );
}

function WrittenBy() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <AdminSection title="Outline">
        <FactsFrom dump={lesson} section="Outline" />
        <span className="flex gap-4">
          <a className="text-muted-foreground text-xs font-medium" href="#">
            Spec
          </a>
          <a className="text-muted-foreground text-xs font-medium" href="#">
            Summary card
          </a>
        </span>
      </AdminSection>
      <AdminSection title="Versions">
        <TableFrom dump={lesson} section="Versions" />
      </AdminSection>
    </div>
  );
}

const HOOK_JSON = `{
  "text": "Lia opens her broker app: a share of the bakery chain shows $20.10. A second later it shows $20.12. Nobody at the company did anything. So who just changed the price?",
  "variant": "text"
}`;

export default async function LessonMockPage({ searchParams }: PageProps<"/lessons/mock">) {
  const query = await searchParams;
  const tab = readView(query.tab) || "screens";
  const json = readView(query.json) === "1";
  const Body = tab === "details" ? Details : tab === "written" ? WrittenBy : Screens;

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        facts={["English", "6 min", "10 screens", "Updated Nov 12, 2026"]}
        parents={[{ href: "/lessons", label: "Lessons" }]}
        title="Where a price comes from"
      />

      <AdminDetailBody>
        <AdminTabs current={tab as "screens"} label="Lesson" path="/lessons/mock" tabs={TABS} />

        <Body json={json} />
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
