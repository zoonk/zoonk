import SwiftUI

/// Main's `GateWords`: what stopped, and at most one line under it.
struct GateWords: View {
  var title: Text?
  var line: Text?

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      if let title {
        title
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))
      }

      if let line {
        line
          .typeStyle(.body)
          .foregroundStyle(.mutedForeground)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The one action that leads to paying, wherever it shows.
struct SubscribeButton: View {
  @Environment(AppRouter.self) private var router

  /// Replaces opening the subscription here, where the screen must close first.
  var action: (() -> Void)?

  var body: some View {
    Button {
      if let action {
        action()
      } else {
        router.present(.subscription)
      }
    } label: {
      Text(
        "Subscribe", tableName: "Subscriptions",
        comment: "Opens the subscription from a feature or limit that needs one")
    }
    .onAppear {
      UsageAnalytics.track(.subscriptionGateShown)
    }
  }
}

/// Main's `SubscribeGate`: in place of what the learner tried, what stopped as the title, at most
/// one line, and "Subscribe". Nothing announces it before the try. `action` is a second way on
/// that isn't paying, such as their Plan.
struct SubscribeGate<Action: View>: View {
  let title: Text
  var line: Text?
  @ViewBuilder var action: Action

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      GateWords(title: title, line: line)

      HStack(spacing: 8) {
        SubscribeButton()
        action
      }
      .buttonStyle(.outline)
      .controlSize(.small)
    }
    .accessibilityElement(children: .contain)
  }
}

extension SubscribeGate where Action == EmptyView {
  init(title: Text, line: Text? = nil) {
    self.init(title: title, line: line) {
      EmptyView()
    }
  }
}

/// What ran out as the title, and when it comes back as the one line under it.
struct LimitWords: Equatable {
  var title: LocalizedStringResource?
  var line: LocalizedStringResource?

  /// The words as one sentence, for a place that holds plain text or for VoiceOver.
  var said: String {
    [title, line].compactMap { $0.map { String(localized: $0) } }.joinedSentences()
  }

  static func == (lhs: LimitWords, rhs: LimitWords) -> Bool {
    lhs.said == rhs.said
  }
}

/// Main's limit notices: the words, then the way on. A guest creates an account, a free learner
/// subscribes, and a subscriber or a short break has only the words.
struct LimitNotice: View {
  @Environment(AppRouter.self) private var router

  let limit: HelpLimit
  let words: LimitWords

  init(limit: HelpLimit, words: LimitWords) {
    self.limit = limit
    self.words = words
  }

  /// What ran out is the day's help.
  init(limit: HelpLimit, kind: HelpLimit.Kind? = nil) {
    self.init(limit: limit, words: limit.helpWords(kind))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      GateWords(title: words.title.map(Text.init), line: words.line.map(Text.init))

      if limit.needsAccount {
        Button {
          router.present(.signIn)
        } label: {
          Label {
            Text(
              "Create a free account", tableName: "Subscriptions",
              comment: "Opens sign-up for a guest who reached what they can try without an account")
          } icon: {
            Image(systemName: "person.badge.plus")
          }
        }
        .buttonStyle(.outline)
        .controlSize(.small)
      } else if limit.offersSubscription {
        SubscribeButton()
          .buttonStyle(.outline)
          .controlSize(.small)
      }
    }
    .accessibilityElement(children: .contain)
  }
}

extension HelpLimit {
  /// What the learner asked for when the day's help ran out; without it the words name no kind.
  enum Kind {
    case explanations
    case messages
  }

  private var isMonthly: Bool {
    if case .limitReached(let period, _) = self {
      return period != .day
    }

    return false
  }

  /// When it comes back. A guest's way on is the button, so their words have no line.
  var comesBack: LocalizedStringResource? {
    guard case .limitReached(_, let tier) = self else {
      return nil
    }

    switch tier {
    case .guest:
      return nil
    case .plus:
      return isMonthly
        ? LocalizedStringResource(
          "More next month.", table: "Subscriptions",
          comment: "Under a limit a subscriber reached: it comes back next month")
        : LocalizedStringResource(
          "More tomorrow.", table: "Subscriptions",
          comment: "Under a limit a subscriber reached: it comes back tomorrow")
    case .free:
      return isMonthly
        ? LocalizedStringResource(
          "More next month, or subscribe to keep going.", table: "Subscriptions",
          comment: "Under a limit a free learner reached: it comes back next month")
        : LocalizedStringResource(
          "More tomorrow, or subscribe to keep going.", table: "Subscriptions",
          comment: "Under a limit a free learner reached: it comes back tomorrow")
    }
  }

  /// A short break and a guest's account need words of their own; a reached limit has none here.
  private var refusalWords: LimitWords {
    switch self {
    case .slowDown:
      LimitWords(
        line: LocalizedStringResource(
          "Take a short break, then try again.", table: "Subscriptions",
          comment: "Fair use asks the learner to wait a moment before trying again"))
    case .freeLessonsUsed(let opensAt):
      LimitWords(
        title: LocalizedStringResource("You've used your free lessons", table: "Subscriptions"),
        line: Self.nextFreeLesson(opensAt))
    case .signUpRequired, .limitReached:
      LimitWords(
        title: LocalizedStringResource(
          "This needs a free account", table: "Subscriptions",
          comment: "A guest tried something that needs a signed-up account"))
    }
  }

  func helpWords(_ kind: Kind? = nil) -> LimitWords {
    guard case .limitReached(_, let tier) = self else {
      return refusalWords
    }

    guard tier != .guest else {
      return LimitWords(
        title: LocalizedStringResource(
          "That's all you can try without an account", table: "Subscriptions",
          comment: "A guest used what they can try without an account"))
    }

    let title: LocalizedStringResource =
      switch (kind, isMonthly) {
      case (.messages, true):
        LocalizedStringResource(
          "No more messages this month", table: "Subscriptions",
          comment: "The learner sent all the messages to their buddy they can this month")
      case (.messages, false):
        LocalizedStringResource(
          "No more messages today", table: "Subscriptions",
          comment: "The learner sent all the messages to their buddy they can today")
      case (.explanations, true):
        LocalizedStringResource(
          "No more explanations this month", table: "Subscriptions",
          comment: "The learner asked for all the answer explanations they can this month")
      case (.explanations, false):
        LocalizedStringResource(
          "No more explanations today", table: "Subscriptions",
          comment: "The learner asked for all the answer explanations they can today")
      case (nil, true):
        LocalizedStringResource(
          "You've reached this month's limit", table: "Subscriptions",
          comment: "The learner used this month's AI checks, clips and similar")
      case (nil, false):
        LocalizedStringResource(
          "You've reached today's limit", table: "Subscriptions",
          comment: "The learner used today's AI checks, clips and similar")
      }

    return LimitWords(title: title, line: comesBack)
  }

  /// The day a free learner's next lesson opens, in their own time zone: no clock time, no count of
  /// days. Without the instant, nothing about a day, never a guess.
  static func nextFreeLesson(_ opensAt: Date?, now: Date = .now, calendar: Calendar = .current)
    -> LocalizedStringResource?
  {
    guard let opensAt else {
      return nil
    }

    let days =
      calendar.dateComponents(
        [.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: opensAt)
      ).day ?? 0

    switch days {
    case ...0:
      return LocalizedStringResource(
        "Your next free lesson opens later today, or subscribe to keep going.",
        table: "Subscriptions")
    case 1:
      return LocalizedStringResource(
        "Your next free lesson opens tomorrow, or subscribe to keep going.",
        table: "Subscriptions")
    default:
      let day = opensAt.formatted(
        Date.FormatStyle(
          locale: calendar.locale ?? .current, calendar: calendar, timeZone: calendar.timeZone
        ).month(.wide).day())
      return LocalizedStringResource(
        "Your next free lesson opens on \(day), or subscribe to keep going.",
        table: "Subscriptions",
        comment:
          "On the screen a free learner sees when their free lessons are used. {date} is a day and its month, such as \"November 22\" in English."
      )
    }
  }

  /// A free learner's lessons are the plan's one allowance, so its title says so.
  var lessonWords: LimitWords {
    guard case .limitReached(_, let tier) = self else {
      return refusalWords
    }

    switch (tier, isMonthly) {
    case (.guest, _):
      return LimitWords(
        title: LocalizedStringResource(
          "No more lessons without an account", table: "Subscriptions",
          comment: "A guest took the lessons they can try without an account"))
    case (_, true):
      return LimitWords(
        title: LocalizedStringResource(
          "No more new lessons this month", table: "Subscriptions",
          comment: "The learner started all the new lessons they can this month"),
        line: comesBack)
    case (_, false):
      return LimitWords(
        title: LocalizedStringResource(
          "No more new lessons today", table: "Subscriptions",
          comment: "The learner started all the new lessons they can today"),
        line: comesBack)
    }
  }

  var mindMapWords: LimitWords {
    guard case .limitReached(_, let tier) = self else {
      return refusalWords
    }

    guard tier != .guest else {
      return LimitWords(
        title: LocalizedStringResource(
          "No more mind maps without an account", table: "Subscriptions",
          comment: "A guest made the mind maps they can try without an account"))
    }

    return LimitWords(
      title: isMonthly
        ? LocalizedStringResource(
          "No more new mind maps this month", table: "Subscriptions",
          comment: "The learner made all the new mind maps they can this month")
        : LocalizedStringResource(
          "No more new mind maps today", table: "Subscriptions",
          comment: "The learner made all the new mind maps they can today"),
      line: comesBack)
  }

  /// Seeing a far topic's lessons ahead of time.
  var previewWords: LimitWords {
    guard case .limitReached(_, let tier) = self else {
      return refusalWords
    }

    guard tier != .guest else {
      return LimitWords(
        title: LocalizedStringResource(
          "No more previews without an account", table: "Subscriptions",
          comment: "A guest saw the topic ahead of time they can without an account"))
    }

    return LimitWords(
      title: isMonthly
        ? LocalizedStringResource(
          "No more previews this month", table: "Subscriptions",
          comment: "The learner saw all the topics ahead of time they can this month")
        : LocalizedStringResource(
          "No more previews today", table: "Subscriptions",
          comment: "The learner saw all the topics ahead of time they can today"),
      line: comesBack)
  }
}
