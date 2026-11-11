export const HELP = `Usage: pnpm zoonk <command> [--api <url>]

Account
  login                                   Log in through your browser (once per machine)
  logout                                  End this machine's login
  whoami                                  Show who is logged in

Staff (read-only production data)
  staff models                            Readable models, their fields and relations
  staff users find <email|username|id>    One account by exact email, username or id
  staff users search <text> [--limit n]   Accounts whose name, email or username contain the text
  staff get <model> <id>                  One record by id
  staff list <model> [options]            Records matching every --where
      --where "<field> <op> [value]"      Repeatable. Ops: eq ne gt gte lt lte, in notIn
                                          (comma-separated values), isNull notNull (no value)
      --order <field>[:asc|desc]
      --limit <n>                         Default 20, at most 100
      --offset <n>
  staff count <model> [--where ...]       Number of records matching every --where

Data commands print JSON on stdout; messages and errors go to stderr.

API: https://api.zoonk.com unless --api <url> or ZOONK_API_URL points elsewhere.
Each API keeps its own login.

Exit codes: 0 done, 1 failed, 2 wrong usage, 3 not logged in (run pnpm zoonk login).
`;
