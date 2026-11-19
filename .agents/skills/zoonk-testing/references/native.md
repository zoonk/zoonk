# What is worth a native test

The lists behind [the native bar](../SKILL.md#the-native-bar) for the Apple and Android apps.

## Worth a test

- **The shared data layer:** resources and keyed caches, mutations and queued saves, session identity (signing out on unauthorized, dropping a response whose session ended), generation streams and their resume, request counts, private image loading and API error mapping.
- **State machines and races the app owns:** transitions driven by a write, a failure, a session change or responses out of order, such as a purchase, the lesson player's state, a live call or a mock run.
- **Native-only logic:** layout math our code computes (pane splits and fold geometry, checked on the values it returns, not on where a screen's parts land), formatting it does itself (dates, numbers, durations, plurals across locales), parsing and transforms (rich text, sandbox output, chart and music data), and regexes on the device's engine.
- **What the learner made:** answers, drafts, progress or recordings kept across recreation, rotation, folding, process death or a failed save.
- **A thin smoke layer:** a few Apple UI tests (the accessibility audit across the tabs and Statistics, recovery from auth loss on a pushed screen, and a free account reaching the subscription store) and Android device tests only for what the JVM can't run.
- **Checks fed by the source of truth:** tests that fail when fixtures exported from main or core drift, contract tests for hand-written wire models, and the Android lint-check detectors.

## Not worth one

- Screen tests of copy, labels, which notice shows, TalkBack or VoiceOver strings, icons, colors, sizes, pane or fold placement, scroll position, what's expanded or where a tap leads.
- A rule core or the API decides (day state, plan rules, scoring, limits, eligibility) when the app only shows the answer.
- Hand-written JSON fed to the generated API client, which is the contract.
- Framework behavior, static catalogs, config or analytics event names.
- A second test of what another already guards; keep the cheaper.

A wording, layout or styling fix is checked on the device and in on-demand renders, without a permanent test. Android's renders (`-Pzoonk.shots`) skip in the suite and are a review tool, never goldens.
