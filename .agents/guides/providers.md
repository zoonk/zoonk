# Pick the provider

Which provider account takes the next subagent, review or helper. Weekly usage a provider doesn't spend before its reset is lost, so work goes to the provider that resets soonest.

Before a delegation round, discover the providers, their current models, the effort settings they support, and their remaining quotas and reset times where exposed.

- **Soonest reset first:** give each new agent to the eligible provider (one that meets the task's [model](models.md) requirements) whose weekly window resets soonest, however little it has left. A provider at 20% that resets in two days takes the work before one at 75% that resets in six. Keep using it until it reaches its floor, then move to the eligible provider that resets next.
- **The 2% floor:** a provider with 2% or less of its weekly window left takes no new work. One that keeps running on paid credits past its weekly window, such as Codex with credits, stays eligible below 2% only while it has more than 2,000 credits left. Work a provider already runs keeps going until it hits a limit.
- **Session window:** the 5-hour window doesn't change the order, it only pauses it: while the soonest-resetting provider's session window is spent, new work goes to the next one by reset, and returns once the session resets.
- **Usage limits:** recheck quotas at task boundaries and when a provider is limited. If its reset is less than 15 minutes away, waiting is acceptable; otherwise transfer unfinished work to an eligible provider with quota. Include the brief, decisions, changed files, verification and open issues in the handoff, and stop the original task to avoid duplicate work. Keep checking, so available providers take over work blocked by longer resets.
