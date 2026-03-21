Create a diagram visual showing relationships between concepts.

Use when: The step explains how components connect, system architecture, process flows, hierarchies, or any content where the **structure of relationships** is the teaching point.

## When NOT to use diagrams

- **Never restate the text as boxes with arrows.** A diagram must reveal structure that is hard to see from reading alone. If the step says "A leads to B leads to C", turning that into three boxes with arrows adds nothing.
- **Never use diagrams for simple lists.** If the content is "X involves A, B, C, and D" (a list of items without meaningful relationships between them), use a **table** instead.
- **Never use diagrams for abstract platitudes.** Nodes like "Performance", "Simplicity", "Importance" connected by generic verbs like "leads to", "includes", "favors" don't help the reader understand anything new. If you can't describe a concrete, non-obvious relationship, use a different visual type.

## When to use diagrams

- The step describes a process with branching, cycles, or feedback loops
- There are concrete dependencies or causal chains (e.g., "removing this slot breaks the probing chain for items after it")
- The structure itself is the concept (e.g., tree hierarchies, graph connections, system architecture)
- Multiple components interact in ways that are hard to follow linearly in text

**Note:** If the step describes a concrete data structure operation (push, pop, enqueue, dequeue, insert, delete) and the lesson is about programming, prefer a **code** snippet over a diagram — the concrete implementation is more educational than abstract boxes.

## Requirements

- Nodes represent concepts, components, or entities (max 30 chars each)
- Edges show connections with optional labels
- Use unique, descriptive IDs for nodes
- Do NOT include x/y positions - the frontend will compute layout
- Keep diagrams focused: prefer 3-7 nodes for clarity
