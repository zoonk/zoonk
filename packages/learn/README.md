# Learn

The learning experience (Today, Plan, Progress, Content and the screens around them) as app-agnostic components that render core's view models.

Like `@zoonk/player`, the package can use Next.js and next-intl but never an app's routes, auth or data fetching. Data comes in as view models, and the host injects the rest.

## Setup

- Wrap the learning routes in `LearnProvider` (`@zoonk/learn/provider`) with stable `adapters`: the host's link component, the analytics `track` function from `@zoonk/core/analytics` and the tab routes.
- Merge `learnMessages(locale)` (`@zoonk/learn/messages`) into the app's next-intl messages and add `packages/learn/messages` to the plugin's message paths. Feedback components translate under the `feedback` namespace (`useExtracted("feedback")`), so an app can send `learnFeedbackMessages(locale)` to every page and the full catalog only where learn screens render; new feedback components use the same namespace.
- Wrap the app once in `ContentFeedbackProvider` (`@zoonk/learn/feedback`) with the host's vote, vote-read and message functions. It powers the vote entries of screen menus (`@zoonk/learn/feedback/menu-items`), thumbs (`@zoonk/learn/feedback/thumbs`), "Send feedback" (`@zoonk/learn/feedback/send`) and the feedback form, and renders the downvote sheet and the form dialog outside any menu, loading each the first time it opens. Without it, those controls render nothing.
- Compose the frame with `LearnShell`, `LearnShellHeader`, `LearnShellStart`, `LearnShellEnd` and `LearnShellMain` (`@zoonk/learn/shell`), and place `LearnNavigation` (`@zoonk/learn/navigation`) in the header. It renders the learning tabs.

## Buddies

The buddy artwork lives in `@zoonk/ui/components/buddy`, not here, so any package can draw it (`@zoonk/ui` has no app or package dependencies). The rules behind it (stage from the belt, Energy states) live in `@zoonk/utils/buddy`, so core can share them. The buddy's default name per language is translated here (`useBuddyName`), and the picker that onboarding and Appearance share lives in `src/buddies`.

## Shared parts

Screens build on these instead of their own copies:

- `TaskFrame`, `TaskMainButton`, `TaskMainLink` and `TaskSaveError` (`src/shell/task-frame.tsx`): the full-screen frame of checkpoints, mock exams, essays, calls and pattern drills, its one main action and its save error.
- `src/_components`: `SectionLabel` (the quiet caps above a group), `StatTile` (a number over its label), `Meter` (a thin bar with a share filled in), `EnterButton` (a session step's main action with its Enter hint), `AnswerOption` (a checkpoint's or mock's lettered pick), `Checklist` (a routine ticked off on the device) and `PracticeOutcomeMessage` (why a bonus practice didn't open).
- `src/_utils`: `useFormatIsoDate` and `daysUntilIsoDate` for view-model days, `useFormatDuration` and `useFormatTimeOfDay`, `formatClock` for timers, and `usePoll` to ask again while something is being made.
