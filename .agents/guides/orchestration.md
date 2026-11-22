# Agent orchestration

When to hand work to another agent, and which small file covers each part of doing it. Approval and verification rules apply to every agent, at every level.

## When to delegate

- A subagent costs a fresh start: it knows only its brief, reads the repository's instructions again and returns only a summary. Delegate when that pays for itself: a big task, one that spans several areas (code, design, UX, accessibility), work that runs in parallel, or a read that must come from eyes that didn't build the change. Do a handful of tool calls yourself.
- **Brief it like a peer:** the goal, what's done and what's ruled out, the branch and the files worth reading, what to hand back, and any rule it must hold that it couldn't find itself. A brief that reaches more than one platform tells the agent to fix the [drift](../../AGENTS.md#architecture-shared-by-all-workspaces) it finds and never list it. A new agent or a new model gets a short written brief, never the whole history: a model can't reuse another's prompt cache, so its first turn on a long conversation pays to cache all of it.
- **Fresh agents for new work:** a lane hands back when its slice is done. The next slice, a fix round or a review gets a new agent with a short brief (the goal, the branch, what's done), not another message to a lane that already carries its whole history. Resume a lane only to finish its own slice.
- **Keep every context lean:** an agent's whole context is read again on every turn, so each turn costs more the longer the agent runs. Any agent, a lane included, hands bulky reading (a broad search, a long log, many files) to a cheaper helper ([models](models.md)) that returns only the lines and facts that matter. It still reads the files it's about to edit and makes quick lookups itself, since a helper costs a brief and a fresh start.
- A subagent that splits work follows these files the same way, and its brief says so, since it may see only the usage numbers.

## Pick the model

Which model and reasoning effort each kind of task gets, and what to do when one isn't available: [models](models.md).

## Pick the provider

Which provider account takes the next agent, its floors, and what happens at a usage limit: [providers](providers.md).

## Lanes

Splitting a large task among agents that land on one branch, who owns the shared pieces, and what runs once per PR: [lanes](lanes.md).

## Waiting

Every wait is one command that blocks until the thing is done, never a sleep and a check per turn: [waiting](waiting.md).

## Cross-model review

The one adversarial review a PR gets from the other model family before it's marked ready: [cross-model review](cross-model-review.md).

## Design debate

Two models from different families debate a big feature or a structural change before any code: [design debate](design-debate.md).

## Exceptions

What an agent does when a rule looks wrong for its case, and where a task with lanes records it: [when a rule looks wrong](exceptions.md).

## Sharing one machine

The queue for heavy jobs, device limits, worktrees, branches and what to do before handing back: [sharing one machine](shared-machine.md).
