export const HELP = `Usage: pnpm zoonk <command> [--api <url>]

Account
  login [--repair-writing]                 Log in through your browser. Request permission to apply writing repairs with --repair-writing.
  logout                                   End this machine's login
  whoami                                   Show who is logged in

Staff (production data)
  staff models [model...]                  The models you can read or fix, or the named models'
                                           fields, relations and each change a fix may make
  staff users find <email|username|id>     One account by exact email, username or id
  staff users search <text> [--limit n]    Accounts whose name, email or username contain the text
  staff lesson <id>                        A lesson's plan, ideas, screens, variants and vocabulary
  staff get <model> <id> [--fields ...]    One record by id
  staff list <model> [options]             Records matching every --where
      --where "<field> <op> [value]"       Repeatable. Ops: eq ne gt gte lt lte, in notIn
                                           (comma-separated values), isNull notNull (no value)
      --order <field>[:asc|desc]
      --limit <n>                          Default 20, at most 100
      --offset <n>
      --fields <field>,<field>...          Print only these fields of each record
  staff count <model> [--where ...]        Number of records matching every --where

Written exam preparation repair
  staff repair-writing <blueprints|learners> [--after <cursor>] [--apply]
                                           Preview one page. --apply starts notice rereads
                                           or reopens unsupported writing claims.

Shared clip audit
  staff audit-clips <words|sentences> [--after <cursor>] [--limit <n>] [--voiced-before <ISO date>]
                                           Listen for added speech or sounds in one page of clips.
                                           Default 100, at most 250. Use the same cutoff on each page.

Lesson activities
  staff lesson-activities <lessonId>...    For up to 5 published lessons written before lessons
                                           practised skills by doing them: pick the practice screens
                                           that become activities, write and check them, and print
                                           each lesson's outcome in "lessons" and a batch of setPlan
                                           and setScreens fixes in "proposal", ready for staff fixes
                                           propose (save it with jq .proposal).

Content fixes (proposed here, approved by a staff person in Admin with a passkey)
  staff fixes propose [--check] <file.json>  Propose the fix or batch in the file, and print its review
                                           link and each fix's changes and effects. Nothing changes
                                           until it's approved.
                                           One fix: { reason, feedbackId?, changes: [...] }
                                           A batch of up to 250 fixes:
                                           { reason, fixes: [{ changes, reason? }, ...] }
      --check                              Print prepared changes and effects without saving the fix
  staff fixes revert <fixId> --reason "…"  Propose undoing an applied fix: what it replaced comes
                                           back once the undo is approved
      --batch <batchId>                    In place of <fixId>: undo every applied fix of a batch
                                           that isn't undone yet, proposed as a new batch
  staff fixes withdraw <fixId>             Take back a fix you proposed that nobody approved yet
      --batch <batchId>                    In place of <fixId>: every fix of your batch still waiting
                                           for review. Approved and applied fixes stay; undo those
                                           with revert.

Data commands print JSON on stdout; messages and errors go to stderr.

API: https://api.zoonk.com unless --api <url> or ZOONK_API_URL points elsewhere.
Each API keeps its own login.

Exit codes: 0 done, 1 failed, 2 wrong usage, 3 not logged in (run pnpm zoonk login).
`;

export function commandUsage(name: string): string {
  const line = HELP.split("\n").find((entry) => entry.startsWith(`  ${name} `));
  const [usage = name] = line?.trim().split(/\s{2,}/u) ?? [];

  return `pnpm zoonk ${usage}`;
}
