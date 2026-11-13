export const HELP = `Usage: pnpm zoonk <command> [--api <url>]

Account
  login                                   Log in through your browser (once per machine)
  logout                                  End this machine's login
  whoami                                  Show who is logged in

Staff (production data)
  staff models [model...]                 Readable model names, or the named models' fields, relations
                                          and, for content, what a fix may change
  staff users find <email|username|id>    One account by exact email, username or id
  staff users search <text> [--limit n]   Accounts whose name, email or username contain the text
  staff get <model> <id> [--fields ...]   One record by id
  staff list <model> [options]            Records matching every --where
      --where "<field> <op> [value]"      Repeatable. Ops: eq ne gt gte lt lte, in notIn
                                          (comma-separated values), isNull notNull (no value)
      --order <field>[:asc|desc]
      --limit <n>                         Default 20, at most 100
      --offset <n>
      --fields <field>,<field>...         Print only these fields of each record
  staff count <model> [--where ...]       Number of records matching every --where

Content fixes (proposed here, approved by a staff person in Admin with a passkey)
  staff fixes propose <file.json>         Propose { reason, feedbackId?, changes: [...] }, or a batch
                                          { reason, fixes: [{ changes, reason? }, ...] } of up to 250,
                                          and print the batch's review link and each fix: each
                                          field's before and after, and its effects. Nothing changes
                                          until it's approved.
  staff fixes revert <fixId> --reason "…" Propose putting back what an applied fix replaced
  staff fixes revert --batch <batchId> --reason "…"
                                          The same for every applied fix of a batch, as a new batch

Data commands print JSON on stdout; messages and errors go to stderr.

API: https://api.zoonk.com unless --api <url> or ZOONK_API_URL points elsewhere.
Each API keeps its own login.

Exit codes: 0 done, 1 failed, 2 wrong usage, 3 not logged in (run pnpm zoonk login).
`;
