import SwiftUI

/// The Focus test's words that more than one screen says: its name with what it costs, its line on
/// the plan, the result's reason and a subject's state.
enum FocusTestCopy {
  static let name = LocalizedStringResource(
    "Focus test", table: "FocusTest", comment: "Title of an exam goal's Focus test")

  static func about(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes))", table: "FocusTest",
      comment: "About how long a Focus test sitting takes, such as \"About 15 min\"")
  }

  static func aboutLeft(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes)) left", table: "FocusTest",
      comment: "About how long the rest of an open Focus test takes, such as \"About 9 min left\"")
  }

  /// "Focus test · About 15 min", over the offer.
  static func offered(minutes: Int) -> String {
    [String(localized: name), about(minutes: minutes)].joinedFacts()
  }

  /// "Focus test · About 13 min left", over an open sitting the learner came back to.
  static func left(minutes: Int) -> String {
    [String(localized: name), aboutLeft(minutes: minutes)].joinedFacts()
  }

  /// One subject, or no date, leaves nothing to focus on: the test only finds where to start.
  static func title(findsFocus: Bool) -> LocalizedStringResource {
    findsFocus
      ? LocalizedStringResource(
        "Find out where to focus", table: "FocusTest",
        comment: "What the Focus test does, for an exam with a date and more than one subject")
      : LocalizedStringResource(
        "Find out where to start", table: "FocusTest",
        comment: "What the Focus test does, for an exam without a date or with one subject")
  }

  /// Leaves the test with the answers it has, for its result.
  static let seeResult = LocalizedStringResource(
    "See my result", table: "FocusTest",
    comment: "Ends the Focus test with the answers given so far and shows its result")

  static let takeTest = LocalizedStringResource(
    "Take the Focus test", table: "FocusTest",
    comment: "Opens the Focus test for a learner whose time doesn't cover the exam")

  /// Why the result names these subjects, in onboarding and on a plan that makes no claim about them.
  static let basedOnAnswers = LocalizedStringResource(
    "Based on your answers and what counts most in your exam. Focusing never removes a subject.",
    table: "FocusTest", comment: "Under the Focus test's result: why these subjects")

  /// The test's one line on the plan: what tapping its row gives.
  static func planLine(_ summary: FocusTestSummary, dated: Bool) -> String {
    switch summary.state {
    case .notStarted:
      return
        ([String(localized: title(findsFocus: dated))]
        + (summary.offer.map { [about(minutes: $0.minutes)] } ?? [])).joinedFacts()
    case .sitting where summary.offer != nil:
      return [
        String(
          localized: "In progress", table: "FocusTest",
          comment: "The Focus test's line on the plan while a sitting is open"),
        aboutLeft(minutes: summary.offer?.minutes ?? 0),
      ].joinedFacts()
    case .sitting, .checked:
      return summary.sessionQuestions == .paused
        ? String(
          localized: "Paused in your sessions", table: "FocusTest",
          comment:
            "The Focus test's line on the plan once the learner paused its questions in sessions")
        : String(
          localized: "See your result", table: "FocusTest",
          comment: "The Focus test's line on the plan once it's taken: opens its result")
    }
  }

  /// How a subject's answers went, in the result's list of every subject.
  static func state(of subject: FocusTest.Subject) -> String {
    switch subject.state {
    case .answered where subject.asked == subject.dontKnow:
      String(
        localized: "Not known yet", table: "FocusTest",
        comment: "A subject whose Focus test answers were all \"I don't know yet\"")
    case .answered:
      String(
        localized: "\(subject.right) of \(subject.asked - subject.dontKnow) right",
        table: "FocusTest",
        comment:
          "How many of a subject's chosen Focus test answers were right; \"I don't know yet\" isn't counted"
      )
    case .notAsked:
      String(
        localized: "Not asked yet", table: "FocusTest",
        comment: "A subject the Focus test hasn't asked a question about yet")
    case .notChecked:
      switch subject.part {
      case .written:
        String(
          localized: "Writing: not checked here", table: "FocusTest",
          comment: "A written part of the exam, such as the essay, that the Focus test can't check")
      case .listening:
        String(
          localized: "Listening: not checked here", table: "FocusTest",
          comment: "A listening part of the exam that the Focus test can't check")
      case .speaking:
        String(
          localized: "Speaking: not checked here", table: "FocusTest",
          comment: "A speaking part of the exam that the Focus test can't check")
      case .practical, nil:
        String(
          localized: "Practical part: not checked here", table: "FocusTest",
          comment: "A practical part of the exam that the Focus test can't check")
      }
    }
  }
}
