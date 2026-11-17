# CALLS round 3 words handoff (FS-D42)

No new learner wording or translations were authored. The messages below use FS's supplied wording. A Claude lane completes every locale.

| App      | Catalog                   | Key                     | English               | Translator context                                                                                                                                                                            |
| -------- | ------------------------- | ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web Main | `apps/main/messages/*.po` | `{belt}, Level {level}` | {belt}, Level {level} | Accessible name of the chip that opens Level. `belt` is the translated belt name; `level` is the learner's level number. Each locale controls their order and punctuation.                    |
| Apple    | `Progress.xcstrings`      | `%@, Level %@`          | %@, Level %@          | Accessible label of the chip that opens Level. The first placeholder is the translated belt name; the second is the learner's level number. Each locale controls their order and punctuation. |

| Android (R4 new) | `apps/android/core/resources/src/main/res/values/strings.xml` | `belt_level_description` | %1$s, Level %2$s | Accessible name of the chip that opens Level. %1$s is the translated belt name; %2$s is the learner’s level number. Each locale controls their order and punctuation. |

Existing keys reused: all three apps' “Skipped · you already know it”; web `{buddy} today` and Android `buddy_page_today` for an empty day's entry. Apple's existing face hint is unchanged. Android's chip uses its own `belt_level_description`; the shared `belt_level` remains unchanged for visible session-summary text.

Android topic rows now use the same reason keys as subjects and phases. Retire the unused topic-only keys and their locales: `goalcontent_topic_known_reviews`, `goalcontent_topic_known_practice`, `goalcontent_topic_skipped`, `goalcontent_topic_past_basics`, `goalcontent_topic_skipped_base`, `goalcontent_topic_time`, `goalcontent_topic_missing`. No translation was rewritten.

Also retire Android `buddy_page_missions` and web Learn `Missions`, whose last reader was the empty-day entry. The extractor owns web catalog pruning.

Round 4 also moves Apple’s existing `%@, Level %@` message from the accessibility value to the label; its English is unchanged. The catalog and source comment now describe the label.
