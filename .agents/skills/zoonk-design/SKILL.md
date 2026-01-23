---
name: zoonk-design
description: Design philosophy and UI/UX guidelines inspired by Apple, Linear, and Vercel. Use when planning new features, designing interfaces, reviewing implementations, or making visual and interaction design decisions.
license: MIT
metadata:
  author: zoonk
  version: "1.0.0"
---

# Design Guidelines

Whenever you're designing something, follow this design style:

Subtle animations, great typography, clean, minimalist, and intuitive design with lots of black/white and empty space. Make it clean, intuitive and super simple to use. Take inspiration from brands with great design like Vercel, Linear, and Apple. Ask yourself "How would Apple, Linear, or Vercel design this?"

You **deeply care about quality and details**, so every element should feel polished and well thought out.

Some design preferences:

- Avoid cards/items with borders and heavy shadows. Prefer using empty space and subtle dividers instead
- For buttons, prefer `outline` variant for most buttons and links. Use the default one only for active/selected states or for submit buttons. Use the `secondary` variant for buttons you want to emphasize a bit more
- Prefer using existing components instead of creating new ones. If a component doesn't exist, search the `shadcn` registry before creating a new one

## Philosophy

**"Design is not just what it looks like. Design is how it works."**

Approach every design challenge by asking: "What is the simplest way to solve this problem?" Great design removes everything that doesn't serve the user's goal. The best interface is often the one with the least interface.

## Core Principles

1. **Simplicity is the ultimate sophistication** — Remove everything that doesn't serve the user's goal. If something feels complex, find a simpler way.

2. **Clarity over cleverness** — Users should never have to think about how to use your interface. The right action should be obvious.

3. **Restraint is a feature** — Say no to most things. The courage to leave things out is what separates good design from great design.

4. **Details matter obsessively** — The spacing, the timing of animations, the weight of a shadow—these micro-decisions compound into the feeling of quality.

5. **Empty space is not empty** — White space is a powerful design element. It creates focus, hierarchy, and breathing room.

## Design Language

- **Color**: Primarily black and white with generous empty space. Color is used sparingly and purposefully.
- **Borders & Shadows**: Avoid heavy borders and shadows on cards/items. Use subtle dividers and empty space instead.
- **Buttons**: Use `outline` variant for most actions. Default/filled for primary actions or selected states. `secondary` for slightly emphasized actions.
- **Typography**: Clean, readable, with clear hierarchy. Let typography do the heavy lifting.
- **Animation**: Subtle and purposeful. Animations should feel natural and provide feedback, never distract.

## Design Process

### Phase 1: Planning (Before Implementation)

1. **Understand the problem deeply** — What is the user trying to accomplish? What is their mental model? What are the edge cases?

2. **Map the user journey** — What are the key moments? Where might users get confused? What's the happy path?

3. **Question everything** — Do we need this feature? Can we combine steps? What can we remove?

4. **Think in flows, not screens** — Design the experience, not just the UI. Consider transitions, loading states, empty states, error states.

5. **Propose the simplest solution** — Start minimal. You can always add, but it's hard to remove.

Ask yourself:

- How would Apple design this?
- How would Linear design this?
- How would Vercel design this?
- What would Steve Jobs ask to remove?

### Phase 2: Review (After Implementation)

1. **Check consistency** — Does it match the design language? Are spacing, colors, and typography consistent?

2. **Evaluate simplicity** — Is there anything that can be removed? Any unnecessary visual noise?

3. **Test the flow** — Does the interaction feel natural? Are loading and error states handled gracefully?

4. **Assess accessibility** — Can all users access this? Is the contrast sufficient? Are interactive elements appropriately sized?

5. **Feel the quality** — Does it feel polished? Would Apple ship this?

## What to Avoid

- Bloated interfaces with too many options
- Design by committee—too many competing ideas
- Decoration that doesn't serve function
- Complexity that could be simplified
- Features without clear user value
- Inconsistency with established patterns

## Component Guidelines

- Always prefer existing UI components before creating new ones
- Check component libraries (like shadcn) before building from scratch
- Use the compound components pattern for all UI components

## Remember

Your job is to be the guardian of quality and simplicity. Push for excellence. The best designs feel inevitable—like they couldn't have been done any other way.
