import SwiftUI

/// The Focus test's words that more than one screen says: its name with what it costs, what it is
/// and why, its line on the plan and a subject's state.
enum FocusTestCopy {
  static let name = LocalizedStringResource(
    "Focus test", table: "FocusTest", comment: "Title of an exam goal's Focus test")

  static func timeLeft(minutes: Int) -> String {
    String(
      localized: "\(studyDuration(minutes: minutes)) left", table: "FocusTest",
      comment: "How long the rest of an open Focus test takes, such as \"9 min left\"")
  }

  /// "Focus test · 15 min", over the offer.
  static func offered(minutes: Int) -> String {
    [String(localized: name), studyDuration(minutes: minutes)].joinedFacts()
  }

  /// "Focus test · 13 min left", over an open sitting the learner came back to.
  static func left(minutes: Int) -> String {
    [String(localized: name), timeLeft(minutes: minutes)].joinedFacts()
  }

  /// One subject, or no date, leaves nothing to focus on: the test only finds what to skip.
  static func title(findsFocus: Bool) -> LocalizedStringResource {
    findsFocus
      ? LocalizedStringResource(
        "Find what to study most", table: "FocusTest",
        comment: "What the Focus test does, for an exam with a date and more than one subject")
      : LocalizedStringResource(
        "Skip what you already know", table: "FocusTest",
        comment: "What the Focus test does, for an exam without a date or with one subject")
  }

  /// What the test is and why, wherever it's offered with its time over it. "It never removes a
  /// subject" is exact: focusing gives some subjects more time and takes none out.
  static func offerLine(findsFocus: Bool) -> LocalizedStringResource {
    findsFocus
      ? LocalizedStringResource(
        "This test shows what you already know, so more of your time goes to what you need most. It never removes a subject.",
        table: "FocusTest",
        comment: "What the Focus test is and why, for an exam with a date and more than one subject"
      )
      : LocalizedStringResource(
        "This test shows what you already know, so your plan can skip it.", table: "FocusTest",
        comment: "What the Focus test is and why, for an exam without a date or with one subject")
  }

  /// The offer's line where no chip over the title says the test's time, such as Today's sheet.
  static func timedLine(minutes: Int) -> String {
    String(
      localized:
        "A \(studyDuration(minutes: minutes)) test shows what you already know, so more of your time goes to what you need most. It never removes a subject.",
      table: "FocusTest",
      comment:
        "What the Focus test is and why; the argument is how long it takes, such as \"15 min\"")
  }

  static let start = LocalizedStringResource(
    "Start", table: "FocusTest", comment: "Starts the Focus test")

  /// Leaves the test with the answers it has, for its result.
  /// The test's actions, from its own table wherever they show, Today included, so each language
  /// words them one way.
  static let continueLabel = LocalizedStringResource(
    "Continue", table: "FocusTest", comment: "Goes on from a Focus test screen")
  static let notNow = LocalizedStringResource(
    "Not now", table: "FocusTest",
    comment: "Leaves the Focus test, its suggestion or the focus it proposes for now")
  static let updatePlan = LocalizedStringResource(
    "Update my plan", table: "FocusTest",
    comment: "Applies the focus the Focus test proposes to the plan")

  static let seeResult = LocalizedStringResource(
    "See my result", table: "FocusTest",
    comment: "Ends the Focus test with the answers given so far and shows its result")

  static let takeTest = LocalizedStringResource(
    "Take the Focus test", table: "FocusTest",
    comment: "Opens the Focus test for a learner whose time doesn't cover the exam")

  /// The test's one line on the plan: what tapping its row gives.
  static func planLine(_ summary: FocusTestSummary) -> String {
    switch summary.state {
    case .notStarted:
      return
        ([String(localized: title(findsFocus: summary.suggestsFocus))]
        + (summary.offer.map { [studyDuration(minutes: $0.minutes)] } ?? [])).joinedFacts()
    case .sitting where summary.offer != nil:
      return [
        String(
          localized: "In progress", table: "FocusTest",
          comment: "The Focus test's line on the plan while a sitting is open"),
        timeLeft(minutes: summary.offer?.minutes ?? 0),
      ].joinedFacts()
    case .sitting, .checked:
      return String(
        localized: "See your result", table: "FocusTest",
        comment: "The Focus test's line on the plan once it's taken: opens its result")
    }
  }

  /// How a subject's answers went, in the result's list of every subject; nothing for one with no
  /// answers.
  static func state(of subject: FocusTest.Subject) -> String? {
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
      nil
    case .notChecked:
      switch subject.part {
      case .written:
        String(
          localized: "Writing: not in this test", table: "FocusTest",
          comment:
            "A written part of the exam, such as the essay, that the Focus test can't ask about")
      case .listening:
        String(
          localized: "Listening: not in this test", table: "FocusTest",
          comment: "A listening part of the exam that the Focus test can't ask about")
      case .speaking:
        String(
          localized: "Speaking: not in this test", table: "FocusTest",
          comment: "A speaking part of the exam that the Focus test can't ask about")
      case .practical, nil:
        String(
          localized: "Practical part: not in this test", table: "FocusTest",
          comment: "A practical part of the exam that the Focus test can't ask about")
      }
    }
  }
}
