# Waiting

A turn spent checking whether something is done costs as much as a turn of real work, since it reads the agent's whole context again. So every wait is one command that blocks until the thing is done, never a sleep and a check per turn.

- **A build, a test run or a review** runs as a background command the harness waits on.
- **CI** uses the harness's own CI or PR watch when the agent has one. Otherwise run one background `gh run watch <run id> --exit-status` (or `gh pr checks <pr> --watch`), never repeated `gh run view` or `gh run list`.
- **A server, a process or free memory** gets one shell loop that returns when it's ready (`until curl -sf <url>; do sleep 5; done`), never turns of `sleep 2` and `pgrep`.

Nothing wakes a lane whose turn has ended, so it waits inside its turn; otherwise it stops until its lead notices.
