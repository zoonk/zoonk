import SwiftUI

/// The Focus test's words that more than one screen says: its name with what it costs, what it is
/// and why, its line on the plan and a subject's state.
enum FocusTestCopy {
  static let name = LocalizedStringResource(
    "Focus test", table: "FocusTest", comment: "Title of an exam goal's Focus test")

  /// One subject, or no date, leaves nothing to focus on: the test only finds what to skip.
  static func title(findsFocus: Bool) -> LocalizedStringResource {
    findsFocus
      ? LocalizedStringResource(
        "Find what to study most", table: "FocusTest",
        comment: "What the Focus test does, for an exam with a date and more than one subject")
      : LocalizedStringResource("Already know some of this?", table: "FocusTest")
  }

  /// What the test is and why, wherever it's offered.
  static func offerLine(findsFocus: Bool) -> LocalizedStringResource {
    findsFocus
      ? LocalizedStringResource(
        "A test shows what you already know, so more of your time goes to what you need most.",
        table: "FocusTest")
      : LocalizedStringResource(
        "This test shows what you already know, so your plan can skip it.", table: "FocusTest",
        comment: "What the Focus test is and why, for an exam without a date or with one subject")
  }

  static let start = LocalizedStringResource("Start the test", table: "FocusTest")

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
    comment:
      "Button that ends the Focus test with the answers given so far and shows its result.")

  static let takeTest = LocalizedStringResource(
    "Take the Focus test", table: "FocusTest",
    comment: "Opens the Focus test for a learner whose time doesn't cover the exam")

  /// The test's one line on the plan: what tapping its row gives, or where an open sitting is.
  static func planLine(_ summary: FocusTestSummary) -> [String] {
    switch summary.state {
    case .notStarted:
      return
        ([String(localized: title(findsFocus: summary.suggestsFocus))]
        + (summary.offer.map { [TestCopy.about(minutes: $0.minutes)] } ?? []))
    case .sitting where summary.offer != nil:
      let inProgress = String(
        localized: "In progress", table: "FocusTest",
        comment: "The Focus test's line on the plan while a sitting is open")

      // A question is named only while there's one to ask.
      guard let sitting = summary.sitting, sitting.answered < sitting.questions else {
        return [inProgress]
      }
      return [inProgress, TestCopy.question(sitting.answered + 1, of: sitting.questions)]
    case .sitting, .checked:
      return [
        String(
          localized: "See your result", table: "FocusTest",
          comment: "The Focus test's line on the plan once it's taken: opens its result")
      ]
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
        locale: .appLanguage,
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
