export const HELP = `Usage: pnpm zoonk <command> [--api <url>]

Account
  login                                    Log in through your browser (once per machine)
  logout                                   End this machine's login
  whoami                                   Show who is logged in

Staff (production data)
  staff models [model...]                  The models you can read or fix, or the named models'
                                           fields, relations and each change a fix may make
  staff users find <email|username|id>     One account by exact email, username or id
  staff users search <text> [--limit n]    Accounts whose name, email or username contain the text
  staff get <model> <id> [--fields ...]    One record by id
  staff list <model> [options]             Records matching every --where
      --where "<field> <op> [value]"       Repeatable. Ops: eq ne gt gte lt lte, in notIn
                                           (comma-separated values), isNull notNull (no value)
      --order <field>[:asc|desc]
      --limit <n>                          Default 20, at most 100
      --offset <n>
      --fields <field>,<field>...          Print only these fields of each record
  staff count <model> [--where ...]        Number of records matching every --where

Content fixes (proposed here, approved by a staff person in Admin with a passkey)
  staff fixes propose <file.json>          Propose the fix or batch in the file, and print its review
                                           link and each fix's changes and effects. Nothing changes
                                           until it's approved.
                                           One fix: { reason, feedbackId?, changes: [...] }
                                           A batch of up to 250 fixes:
                                           { reason, fixes: [{ changes, reason? }, ...] }
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
