import SwiftUI

extension LearnerSummary {
  var buddyDisplayName: String {
    Zoonk.buddyName(kind: buddy.kind, name: buddyName)
  }
}

extension LearnerSummaryStore {
  var buddyDisplayName: String {
    summary.value?.buddyDisplayName ?? BuddyKind.zu.name
  }
}

extension TutorScope {
  var panelDescription: Text {
    switch self {
    case .plan:
      Text(
        "Ask questions about your plan", tableName: "Tutor",
        comment: "What the buddy's panel is about")
    case .subject:
      Text(
        "Ask questions about this subject", tableName: "Tutor",
        comment: "What the buddy's panel is about: a subject of the learner's exam or plan")
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
    case .step where isAboutCheckedAnswer, .item where isAboutCheckedAnswer:
      Text(
        "Ask about your answer", tableName: "Tutor",
        comment: "What the buddy's panel is about: a checked answer")
    case .step:
      Text(
        "Ask about this screen", tableName: "Tutor",
        comment: "What the buddy's panel is about: the lesson screen in view")
    case .item:
      Text(
        "Ask about this question", tableName: "Tutor",
        comment: "What the buddy's panel is about: a practice question")
    }
  }

  var placeholder: Text {
    switch self {
    case .plan:
      Text(
        "Ask about your plan…", tableName: "Tutor", comment: "Placeholder of the buddy's composer")
    case .subject:
      Text(
        "Ask about this subject…", tableName: "Tutor",
        comment:
          "Placeholder of the buddy's composer; the subject is one of the learner's exam or plan")
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
    case .item(_, _, let answered, _, _):
      answered
        ? Text(
          "Ask about your answer…", tableName: "Tutor",
          comment: "Placeholder of the buddy's composer")
        : Text(
          "Ask about this question…", tableName: "Tutor",
          comment: "Placeholder of the buddy's composer")
    }
  }

  func askLabel(_ name: String) -> String {
    switch self {
    case .plan:
      String(
        localized: "Ask \(name) about your plan", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .subject:
      String(
        localized: "Ask \(name) about this subject", table: "Tutor",
        comment:
          "Ask button for VoiceOver; the argument is the buddy's name, and the subject is one of the learner's exam or plan"
      )
    case .chapter:
      String(
        localized: "Ask \(name) about this chapter", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .mock:
      String(
        localized: "Ask \(name) about this mock exam", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .step where isAboutCheckedAnswer, .item where isAboutCheckedAnswer:
      String(
        localized: "Ask \(name) about your answer", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .lesson, .step:
      String(
        localized: "Ask \(name) about this screen", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    case .item:
      String(
        localized: "Ask \(name) about this question", table: "Tutor",
        comment: "Ask button for VoiceOver; the argument is the buddy's name")
    }
  }

  /// A few questions to start with, never a list.
  var suggestions: [TutorSuggestion] {
    switch self {
    case .lesson(_, _, let suggestions), .step(_, _, _, _, let suggestions, _):
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
    case .item(_, _, let answered, _, _):
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
      Text(
        "About this subject", tableName: "Tutor",
        comment: "Above a question to the buddy about a subject of the learner's exam or plan")
    }
  }
}

extension TutorFailure {
  /// A limit reads as every other limit; the rest are one line.
  var words: LimitWords {
    switch self {
    case .signUpRequired:
      return HelpLimit.signUpRequired.helpWords(.messages)
    case .slowDown:
      return HelpLimit.slowDown(retryAfterSeconds: 0).helpWords(.messages)
    case .limitReached(let period, let tier):
      return HelpLimit.limitReached(
        period: HelpLimit.Period(rawValue: period.rawValue) ?? .day, tier: tier
      )
      .helpWords(.messages)
    case .plusRequired:
      return LimitWords(
        title: LocalizedStringResource(
          "Asking questions needs a subscription", table: "Tutor",
          comment: "A free learner's question to their buddy needs a subscription"))
    case .gone:
      return LimitWords(
        line: LocalizedStringResource(
          "This lesson is no longer available.", table: "Tutor",
          comment: "What the question was about no longer exists"))
    case .invalid:
      return LimitWords(
        line: LocalizedStringResource(
          "We couldn't send this question. Try again.", table: "Tutor",
          comment: "The question wasn't accepted"))
    case .signedOut:
      return LimitWords(
        line: LocalizedStringResource(
          "You've been logged out.", table: "Tutor", comment: "The session ended while asking"))
    case .conflict, .failed:
      return LimitWords(
        line: LocalizedStringResource(
          "Something went wrong. Try again.", table: "Tutor",
          comment: "A question or answer failed"))
    }
  }

  var message: String {
    words.said
  }

  enum Remedy {
    case createAccount
    case subscribe
    case signIn
    case tryAgain
    case none
  }

  var remedy: Remedy {
    switch self {
    case .signUpRequired, .limitReached(_, .guest):
      .createAccount
    case .limitReached(_, .free), .plusRequired:
      .subscribe
    case .signedOut:
      .signIn
    case .limitReached(_, .plus), .gone:
      .none
    case .slowDown, .invalid, .conflict, .failed:
      .tryAgain
    }
  }
}

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

  return Text(
    PlanDate.momentDay(
      date, style: .dateTime.weekday(.wide).day().month(.wide), now: now, calendar: calendar))
}
