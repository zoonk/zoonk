## Agent orchestration

First, discover providers, current models, supported effort settings, and remaining quotas/reset times where exposed. When delegating multiple sub-agents, split them into multiple providers (if available) based on remaining quota.

Resolve the latest Claude Opus and GPT Sol from the live catalog (currently Opus 5.5 and GPT-6.1-Sol); map effort names to supported equivalents. Existing approval and verification rules still apply.

- **Design:** UI and UX work, including UI elements, layouts, and interactions, is design work. Use Opus with xhigh reasoning unless asked otherwise.
- **Copywriting:** Prefer Opus with xhigh reasoning.
- **Marketing:** Prefer Opus with xhigh reasoning for marketing, landing pages, motion videos, and animation.
- **Computer use:** Prefer GPT Sol through Codex with medium reasoning.
- **Code review:** Use the model family that didn't write the change, at xhigh reasoning ([cross-model review](../../AGENTS.md#cross-model-review)).
- **Small code changes:** Use GPT Sol with medium reasoning.
- **Architecture:** Have GPT Sol and Opus, both at xhigh reasoning, exchange proposals, objections, and revisions until they agree on the best approach. Relay their responses if direct communication is unavailable. Opus may then implement at medium effort.
- **Large tasks:** Split independent work across subagents and providers to avoid exhausting one provider. Among providers meeting the task's model requirements, prefer those with the most remaining capacity and assign non-overlapping edits.
- **Nested delegation:** These rules apply at every level. A subagent that splits work delegates to the providers with the most remaining capacity instead of fanning out on its own provider.
- **Usage limits:** Recheck quotas periodically, at task boundaries, and when a provider is limited. If its reset is less than 15 minutes away, waiting is acceptable; otherwise transfer unfinished work to an eligible provider with quota. Include the brief, decisions, changed files, verification, and open issues in the handoff; stop the original task to avoid duplicate work. Keep checking so available providers take over work blocked by longer resets.
- **Devices:** A lead whose lanes use simulators or emulators runs `pnpm dev:close-device-crash-alerts` each time it checks on them, so a crash alert doesn't wait on the owner's screen until a lane ends.
- **Opus fallback:** If no Opus provider is available, use GPT Sol for design at the prescribed effort. Track the pending design review and have Opus review at xhigh effort as soon as it becomes available again.
