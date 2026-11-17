# CALLS round 3 words handoff (FS-D42)

No new learner wording or translations were authored. The two new messages use FS's supplied wording. A Claude lane completes every locale.

| App      | Catalog                   | Key                     | English               | Translator context                                                                                                                                                                            |
| -------- | ------------------------- | ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Main | `apps/main/messages/*.po` | `{belt}, Level {level}` | {belt}, Level {level} | Accessible name of the chip that opens Level. `belt` is the translated belt name; `level` is the learner's level number. Each locale controls their order and punctuation.                    |
| Apple    | `Progress.xcstrings`      | `%@, Level %@`          | %@, Level %@          | Accessible value of the chip that opens Level. The first placeholder is the translated belt name; the second is the learner's level number. Each locale controls their order and punctuation. |

Existing keys reused: all three apps' “Skipped · you already know it”; web `{buddy} today` and Android `buddy_page_today` for an empty day's entry. Apple's existing face hint is unchanged. Android's `BeltLevel` already uses one catalog message (`belt_level`) for both values; no code-built ordering needs replacement there.

Android topic rows now use the same reason keys as subjects and phases. Retire the unused topic-only keys and their locales: `goalcontent_topic_known_reviews`, `goalcontent_topic_known_practice`, `goalcontent_topic_skipped`, `goalcontent_topic_past_basics`, `goalcontent_topic_skipped_base`, `goalcontent_topic_time`, `goalcontent_topic_missing`. No translation was rewritten.

Also retire Android `buddy_page_missions` and web Learn `Missions`, whose last reader was the empty-day entry. The extractor owns web catalog pruning.
