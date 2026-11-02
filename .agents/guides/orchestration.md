# Agent orchestration

First, discover providers, current models, supported effort settings, and remaining quotas/reset times where exposed. When delegating multiple sub-agents, split them into multiple providers (if available) based on remaining quota.

Resolve the latest Claude Opus and GPT Sol from the live catalog (currently Opus 5.5, GPT-6.1-Sol, GPT-6.1-Terra); map effort names to supported equivalents. Existing approval and verification rules still apply.

- **Design:** UI and UX work, including UI elements, layouts, and interactions, is design work. Use Opus with xhigh reasoning unless asked otherwise.
- **Copywriting:** Prefer Opus with xhigh reasoning.
- **Marketing:** Prefer Opus with xhigh reasoning for marketing, landing pages, motion videos, and animation.
- **Computer use:** Prefer GPT Terra through Codex with medium reasoning.
- **Code review:** Use the model family that didn't write the change, at xhigh reasoning ([cross-model review](../../AGENTS.md#cross-model-review)).
- **Small code changes:** Use GPT Sol with xhigh reasoning.
- **Architecture:** Have GPT Sol and Opus, both at xhigh reasoning, exchange proposals, objections, and revisions until they agree on the best approach. Relay their responses if direct communication is unavailable. Opus may then implement at high effort.
- **Large tasks:** Split independent work across subagents and providers to avoid exhausting one provider. Among providers meeting the task's model requirements, prefer those with the most remaining capacity and assign non-overlapping edits.
- **Spread the load:** Give each new subagent, review or helper to the eligible provider with the most remaining capacity at that moment, so usage grows a little on every provider instead of draining one or two. A provider past about 70% of its window takes no new work while another eligible one has room.
- **Nested delegation:** These rules apply at every level. A subagent that splits work delegates to the providers with the most remaining capacity instead of fanning out on its own provider.
- **Usage limits:** Recheck quotas periodically, at task boundaries, and when a provider is limited. If its reset is less than 15 minutes away, waiting is acceptable; otherwise transfer unfinished work to an eligible provider with quota. Include the brief, decisions, changed files, verification, and open issues in the handoff; stop the original task to avoid duplicate work. Keep checking so available providers take over work blocked by longer resets.
- **Lane health:** A lane's failure notice doesn't always reach its lead. After a machine-wide failure (a full disk, a reboot, a provider outage), or when a lane has been quiet for about an hour, read each lane's status yourself, and resume a failed lane where it ran so it keeps its context and worktree.
- **Waiting inside the turn:** A lane that waits on a build or a review waits inside its turn, with a background command it then waits on. Nothing wakes a lane whose turn has ended, so it stops until its lead notices.
- **Opus fallback:** If no Opus provider is available, use GPT Sol for design at the prescribed effort. Track the pending design review and have Opus review at xhigh effort as soon as it becomes available again.

## Sharing one machine

Agents working in parallel share the machine's memory, disk and devices.

- Heavy jobs take turns through `pnpm dev:queue`; the [development guide](development.md#commands) says which commands queue on their own and how to queue the rest. The [Apple](../../apps/apple/AGENTS.md#simulators) and [Android](../../apps/android/AGENTS.md#emulators-and-builds) guidance caps how many simulators, emulators and native builds run at once.
- On macOS, a lead whose lanes use simulators or emulators runs `pnpm dev:close-device-crash-alerts` each time it checks on them, so crash alerts don't pile up on screen until a lane ends.
- Every worktree fills the disk with its own dependencies, builds (a production build is about 6 GB) and database copies. An agent working in a worktree made for its task removes it when the task ends, before it hands back: commit the work (its branch keeps the commits), stop the servers it started there, then, as its last command, run `git worktree remove <path>`, which refuses while uncommitted work is left. The next `pnpm worktree:setup` drops its database copies.
- A lead lands a lane's commits from its branch and doesn't need the lane's checkout; it removes the worktree of a lane that failed, was cancelled or handed back uncommitted work once its commits are landed or dropped. Reviews and other read-only tasks run in the lead's checkout, without a worktree.
