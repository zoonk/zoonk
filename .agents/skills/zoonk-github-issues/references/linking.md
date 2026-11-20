# Link related issues

GitHub records three relationships between issues and shows each on both of them. Set every one that holds, when creating the issue or afterwards, with `gh` 2.94 or newer. Each flag takes issue numbers or URLs, separated by commas:

| Relationship          | When                                                                           | Command                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocked by / blocking | One can't be fixed or shipped until the other is                               | `gh issue create --blocked-by <n> --blocking <m>`, or `gh issue edit <issue> --add-blocked-by <n> --add-blocking <m>`                                                            |
| Parent / sub-issue    | It's one part of a larger piece of work an open parent tracks, such as an Epic | `gh issue create --parent <n>`, or `gh issue edit <issue> --parent <n>`, or `gh issue edit <parent> --add-sub-issue <n>`                                                         |
| Duplicate             | Two open issues describe the same problem                                      | `gh issue close <duplicate> --repo zoonk/zoonk --duplicate-of <original>`, keeping the one [addressing an issue](../../zoonk-address-issue/SKILL.md#2-find-related-issues) keeps |

Each `--add-…` flag has a `--remove-…` twin, and `--remove-parent` takes an issue off its parent. Check the result with `gh issue view <issue> --repo zoonk/zoonk --json parent,subIssues,blockedBy,blocking`.

GitHub has no plain "related" relationship. For a related issue that neither blocks this one nor shares its parent, name it in the body with what connects them, such as "The same waiting day as #<n>, reached by accepting a plan change instead of picking an exam option". GitHub then lists the mention on that issue's timeline, so whoever addresses either one finds the other.
