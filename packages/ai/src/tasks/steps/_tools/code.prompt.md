Create a code snippet visual with optional line annotations.

Use when: The step's content describes something that can be concretely demonstrated with code — algorithms, data structure operations, syntax, APIs, or logic that becomes clearer when you see it running.

## When NOT to use code

- **The step talks ABOUT programming conceptually** but doesn't describe specific operations, syntax, or logic. For example, "data structures affect performance" is conceptual — use a table or diagram. But "a hash table resolves collisions by probing the next slot" can be shown in code.
- **The step is about a non-programming topic.** Design principles, biology, history, etc. should never have code visuals, even if you could technically write a metaphorical program about them.
- **Never use code for mathematical notation.** If the content is a mathematical expression (derivatives, integrals, equations like `dy/dx`), use the **formula** visual instead. Code visuals are for executable programs, not for displaying math in a monospace font.

## When to use code

- The step explains an algorithm or procedure that has concrete steps (sorting, searching, hashing, traversal)
- The step describes a data structure operation (insert, delete, lookup, push, pop, enqueue, dequeue) and showing the code makes the mechanics clear — **prefer code over a diagram** for these, the concrete implementation is more educational than abstract boxes
- The step discusses syntax, APIs, or language features
- The step describes logic (conditionals, loops, recursion) where seeing the code is more precise than prose

## Requirements

- Specify the programming language (python, javascript, typescript, etc.)
- Code should be concise (max 500 chars) and demonstrate the concept clearly
- Use annotations to highlight key lines and explain their purpose
- Annotations are 1-based line numbers
- Code should be syntactically correct and follow language conventions
