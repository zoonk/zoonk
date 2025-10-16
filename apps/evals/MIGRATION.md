# Migration Guide - TestCase Structure Update

## Breaking Change: TestCase Structure

We've updated the `TestCase` type to be more generic and support any task input structure.

### What Changed

**Before:**

```typescript
interface TestCase {
  locale: string;
  prompt: string;
  expectations: string;
}
```

**After:**

```typescript
interface TestCase {
  userInput: Record<string, string>;
  expectations: string;
}
```

### Impact

If you have existing eval results cached locally, they will use the old format and may show an error or display "Legacy test case format" message.

### How to Migrate

Simply delete your cached eval results and re-run the evaluations:

```bash
# From the evals app directory
rm -rf eval-results/
```

Then visit the evals dashboard and re-run evaluations for any tasks. The new results will use the updated format.

### Why This Change?

The old structure was specific to the course suggestions task with hardcoded `locale` and `prompt` fields. The new structure is generic and supports any task with any input fields, making it easier to add new tasks without modifying the core eval system.

### Backward Compatibility

The UI will gracefully handle old cached results by showing "Legacy test case format - delete eval results and re-run" instead of crashing. However, we recommend deleting old results for the best experience.
