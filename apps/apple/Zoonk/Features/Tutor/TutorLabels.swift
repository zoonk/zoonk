import SwiftUI

extension LearnerSummary {
  /// The learner's buddy by name, the one who answers in every conversation.
  var buddyDisplayName: String {
    Zoonk.buddyName(kind: buddy.kind, name: buddyName)
  }
}

extension LearnerSummaryStore {
  /// The buddy's name wherever the app says it, the default buddy's own (localized) before the
  /// summary arrives.
  var buddyDisplayName: String {
    summary.value?.buddyDisplayName ?? BuddyKind.zu.name
  }
}

extension TutorScope {
  /// What the conversation is about, under the panel's title.
  var panelDescription: Text {
    switch self {
    case .plan:
      Text(
        "Ask questions about your plan", tableName: "Tutor",
        comment: "What the buddy's panel is about")
    case .subject:
      Text(
        "Ask questions about this subject", tableName: "Tutor",
        comment: "What the buddy's panel is about")
    case .chapter:
      Text(
        "Ask questions about this chapter", tableName: "Tutor",
        comment: "What the buddy's panel is about")
    case .mock:
      Text(
        "Ask questions about this mock exam", tableName: "Tutor",
        comment: "What the buddy's panel is about")
    case .lesson:
      Text(
        "Ask questions about this lesson", tableName: "Tutor",
        comment: "What the buddy's panel is about")
    case .step:
      Text(
        "Ask about this screen", tableName: "Tutor",
        comment: "What the buddy's panel is about: the lesson screen in view")
    case .item(_, _, let answered, _):
      answered
        ? Text(
          "Ask about your answer", tableName: "Tutor",
          comment: "What the buddy's panel is about: a checked practice question")
        : Text(
          "Ask about this question", tableName: "Tutor",
          comment: "What the buddy's panel is about: a practice question")
    }
  }

  /// The composer's hint.
  var placeholder: Text {
    switch self {
    case .plan:
      Text(
        "Ask about your plan…", tableName: "Tutor", comment: "Placeholder of the buddy's composer")
    case .subject:
      Text(
        "Ask about this subject…", tableName: "Tutor",
        comment: "Placeholder of the buddy's composer")
    case .chapter:
      Text(
        "Ask about this chapter…", tableName: "Tutor",
        comment: "Placeholder of the buddy's composer")
    case .mock:
      Text(
        "Ask about this mock exam…", tableName: "Tutor",
        comment: "Placeholder of the buddy's composer")
    case .lesson, .step:
      Text(
        "Ask about the lesson content…", tableName: "Tutor",
        comment: "Placeholder of the buddy's composer in a lesson")
    case .item(_, _, let answered, _):
      answered
        ? Text(
          "Ask about your answer…", tableName: "Tutor",
          comment: "Placeholder of the buddy's composer")
        : Text(
          "Ask about this question…", tableName: "Tutor",
          comment: "Placeholder of the buddy's composer")
    }
  }

  /// "Ask Zu about this chapter": what an Ask button says to VoiceOver.
  func askLabel(_ name: String) -> String {
    switch self {
    case .plan:
      String(
        localized: "Ask \(name) about your plan", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .subject:
      String(
        localized: "Ask \(name) about this subject", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .chapter:
      String(
        localized: "Ask \(name) about this chapter", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .mock:
      String(
        localized: "Ask \(name) about this mock exam", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .lesson, .step:
      String(
        localized: "Ask \(name) about this screen", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .item(_, _, let answered, _):
      answered
        ? String(
          localized: "Ask \(name) about your answer", table: "Tutor",
          comment: "Ask button for VoiceOver; the argument is the buddy's name")
        : String(
          localized: "Ask \(name) about this question", table: "Tutor",
          comment: "Ask button for VoiceOver; the argument is the buddy's name")
    }
  }

  /// A few questions to start with, never a list: in a lesson its own suggestions (what
  /// "Simpler" and "Go deeper" were), elsewhere what main's buddy offers there.
  var suggestions: [TutorSuggestion] {
    switch self {
    case .lesson(_, let suggestions), .step(_, _, _, let suggestions):
      return suggestions
    case .chapter:
      return [
        TutorSuggestion(
          id: "after",
          label: String(
            localized: "What will I be able to do after this chapter?", table: "Tutor",
            comment: "A question to the buddy, sent with one tap"))
      ]
    case .mock:
      return [
        TutorSuggestion(
          id: "first",
          label: String(
            localized: "What should I practice first?", table: "Tutor",
            comment: "A question to the buddy about a mock exam, sent with one tap")),
        TutorSuggestion(
          id: "missed",
          label: String(
            localized: "Why did I miss these questions?", table: "Tutor",
            comment: "A question to the buddy about a mock exam, sent with one tap")),
      ]
    case .plan:
      return [
        TutorSuggestion(
          id: "today",
          label: String(
            localized: "Why am I studying this today?", table: "Tutor",
            comment: "A question to the buddy, sent with one tap")),
        TutorSuggestion(
          id: "next",
          label: String(
            localized: "What comes next?", table: "Tutor",
            comment: "A question to the buddy about the plan, sent with one tap")),
      ]
    case .subject:
      return [
        TutorSuggestion(
          id: "left",
          label: String(
            localized: "What's left to study here?", table: "Tutor",
            comment: "A question to the buddy about a subject, sent with one tap")),
        TutorSuggestion(
          id: "covered",
          label: String(
            localized: "Does my plan cover all of it?", table: "Tutor",
            comment: "A question to the buddy about a subject, sent with one tap")),
      ]
    case .item(_, _, let answered, _):
      return [
        answered
          ? TutorSuggestion(
            id: "walk",
            label: String(
              localized: "Walk me through this answer", table: "Tutor",
              comment: "A question to the buddy about a checked answer, sent with one tap"))
          : TutorSuggestion(
            id: "asking",
            label: String(
              localized: "What is this question asking?", table: "Tutor",
              comment: "A question to the buddy about a practice question, sent with one tap")),
        TutorSuggestion(
          id: "idea",
          label: String(
            localized: "What idea is this question about?", table: "Tutor",
            comment: "A question to the buddy about a practice question, sent with one tap")),
      ]
    }
  }
}

extension TutorTurn.About {
  /// What a question was about, above it in a panel.
  var label: Text {
    switch self {
    case .answer:
      Text("About your answer", tableName: "Tutor", comment: "Above a question to the buddy")
    case .chapter:
      Text("About this chapter", tableName: "Tutor", comment: "Above a question to the buddy")
    case .item:
      Text("About this question", tableName: "Tutor", comment: "Above a question to the buddy")
    case .lesson:
      Text("About this lesson", tableName: "Tutor", comment: "Above a question to the buddy")
    case .mock:
      Text("About this mock exam", tableName: "Tutor", comment: "Above a question to the buddy")
    case .plan:
      Text("About your plan", tableName: "Tutor", comment: "Above a question to the buddy")
    case .step:
      Text(
        "About this part", tableName: "Tutor",
        comment: "Above a question to the buddy: one lesson screen")
    case .subject:
      Text("About this subject", tableName: "Tutor", comment: "Above a question to the buddy")
    }
  }
}

extension TutorFailure {
  /// Why it didn't work, in one sentence.
  var message: Text {
    switch self {
    case .signUpRequired:
      Text(
        "Create your free account to continue.", tableName: "Tutor",
        comment: "A guest's help is used up")
    case .slowDown:
      Text(
        "Take a short break, then ask again.", tableName: "Tutor",
        comment: "Fair use asks for a pause before the next question")
    case .limitReached(let period, let tier):
      Self.limitMessage(period: period, tier: tier)
    case .plusRequired:
      Text(
        "Subscribe to ask questions", tableName: "Tutor",
        comment: "A free learner's question needs Plus")
    case .gone:
      Text(
        "This lesson is no longer available.", tableName: "Tutor",
        comment: "What the question was about no longer exists")
    case .invalid:
      Text(
        "We couldn't send this question. Try again.", tableName: "Tutor",
        comment: "The question wasn't accepted")
    case .signedOut:
      Text(
        "Your session expired. Sign in again.", tableName: "Tutor",
        comment: "The session ended while asking")
    case .conflict, .failed:
      Text(
        "Something went wrong. Try again.", tableName: "Tutor",
        comment: "A question or answer failed")
    }
  }

  private static func limitMessage(period: Period, tier: LearnerTier) -> Text {
    let thisMonth = period == .month || period == .total

    switch tier {
    case .guest:
      return thisMonth
        ? Text(
          "You've used the free help you can get without an account. Create a free account to keep going.",
          tableName: "Tutor", comment: "A guest's help is used up")
        : Text(
          "You've used today's free help. Create a free account to keep going.", tableName: "Tutor",
          comment: "A guest's help for the day is used up")
    case .plus:
      return Text(
        "You've used today's help. It comes back tomorrow.", tableName: "Tutor",
        comment: "A Plus learner's help for the day is used up")
    case .free:
      return thisMonth
        ? Text(
          "You've used this month's help. It comes back next month, or get Plus to keep going now.",
          tableName: "Tutor", comment: "A free learner's help for the month is used up")
        : Text(
          "You've used today's help. It comes back tomorrow, or get Plus to keep going now.",
          tableName: "Tutor", comment: "A free learner's help for the day is used up")
    }
  }

  /// The one thing to do about it: create a free account, see Plus, sign in, or try again.
  enum Remedy {
    case createAccount
    case seePlus
    case signIn
    case tryAgain
    case none
  }

  var remedy: Remedy {
    switch self {
    case .signUpRequired, .limitReached(_, .guest):
      .createAccount
    case .limitReached(_, .free), .plusRequired:
      .seePlus
    case .signedOut:
      .signIn
    case .limitReached(_, .plus), .gone:
      .none
    case .slowDown, .invalid, .conflict, .failed:
      .tryAgain
    }
  }
}

/// "Today", "Yesterday" or the date: the day a stretch of the conversation is from.
func tutorDayLabel(_ date: Date, now: Date = .now) -> Text {
  let calendar = Calendar.current

  if calendar.isDate(date, inSameDayAs: now) {
    return Text("Today", tableName: "Tutor", comment: "The day of the messages below")
  }

  if let yesterday = calendar.date(byAdding: .day, value: -1, to: now),
    calendar.isDate(date, inSameDayAs: yesterday)
  {
    return Text("Yesterday", tableName: "Tutor", comment: "The day of the messages below")
  }

  return Text(date.formatted(.dateTime.weekday(.wide).day().month(.wide)))
}
