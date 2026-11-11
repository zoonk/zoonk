import Foundation

/// The Focus test's words that more than one screen says: a sitting's size, a subject's state, why
/// a subject is suggested, and the test's state on the plan.
enum FocusTestCopy {
  static func about(minutes: Int) -> String {
    String(
      localized: "About \(studyDuration(minutes: minutes))", table: "FocusTest",
      comment: "About how long a Focus test sitting takes, such as \"About 15 min\"")
  }

  static func upTo(questions: Int) -> String {
    String(
      localized: "Up to \(questions) questions", table: "FocusTest",
      comment: "The most questions a Focus test sitting asks")
  }

  static func subjects(_ count: Int) -> String {
    String(
      localized: "\(count) subjects", table: "FocusTest",
      comment: "How many subjects the exam has, written and listening parts included")
  }

  /// "Check where to focus · About 15 min": the test offered where a short plan's time could go.
  static func checkWhereToFocus(minutes: Int) -> String {
    String(
      localized: "Check where to focus\u{00A0}· About \(studyDuration(minutes: minutes))",
      table: "FocusTest",
      comment:
        "Opens the Focus test for a learner whose time doesn't cover the exam; then how long it takes"
    )
  }

  static func evidence(asked: Int, total: Int) -> String {
    String(
      localized: "Questions on \(asked) of \(total) subjects so far", table: "FocusTest",
      comment: "How many of the exam's subjects the Focus test has asked about")
  }

  static let settled = String(
    localized: "Your starting points are set.", table: "FocusTest",
    comment: "A Focus test sitting ended early: every subject's starting point is set")

  static let noQuestionsReady = String(
    localized: "That's all the questions ready for now. Your next sessions ask the rest.",
    table: "FocusTest",
    comment: "A Focus test sitting ended early: no more questions are ready yet")

  static func endLine(_ end: FocusTest.Sitting.End?) -> String? {
    switch end {
    case .settled: settled
    case .noQuestionsReady: noQuestionsReady
    case .ceiling, nil: nil
    }
  }

  /// Before the first answer every quick subject would say "Not asked yet", so the invitation's
  /// list says only what the test can't check.
  static func state(of subject: FocusTest.Subject) -> String {
    switch subject.state {
    case .answered:
      String(
        localized: "\(subject.right) of \(subject.asked) right", table: "FocusTest",
        comment: "How many of a subject's Focus test answers were right")
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

  static func reason(_ row: FocusTest.Row) -> String {
    switch row.reason {
    case .answers:
      String(
        localized: "Your answers suggest reviewing this subject.", table: "FocusTest",
        comment: "Why the plan gives a subject more time: a miss or an \"I don't know yet\"")
    case .minimumScore:
      String(
        localized: "This part has a minimum score.", table: "FocusTest",
        comment: "Why the plan gives a part of the exam more time")
    case .notChecked:
      switch row.part {
      case .written:
        String(
          localized: "Writing counts heavily; it isn't checked here.", table: "FocusTest",
          comment:
            "Why the plan gives the written part more time: it weighs a lot, and the Focus test can't ask about it"
        )
      case .listening:
        String(
          localized: "Listening counts heavily; it isn't checked here.", table: "FocusTest",
          comment:
            "Why the plan gives the listening part more time: it weighs a lot, and the Focus test can't ask about it"
        )
      case .speaking:
        String(
          localized: "Speaking counts heavily; it isn't checked here.", table: "FocusTest",
          comment:
            "Why the plan gives the speaking part more time: it weighs a lot, and the Focus test can't ask about it"
        )
      case .practical, nil:
        String(
          localized: "This part counts heavily; it isn't checked here.", table: "FocusTest",
          comment:
            "Why the plan gives a part of the exam more time: it weighs a lot, and the Focus test can't ask about it"
        )
      }
    case .notAsked:
      String(
        localized: "This subject counts heavily. Its starting point hasn't been checked yet.",
        table: "FocusTest",
        comment: "Why the plan gives a subject the Focus test hasn't asked about more time")
    case .weight:
      String(
        localized: "This subject counts heavily.", table: "FocusTest",
        comment: "Why the plan gives a subject more time: it weighs a lot in the exam")
    }
  }

  /// The test as a row's facts: "Not started", "Continue" with what's left, or its last result.
  static func stateFacts(_ summary: FocusTestSummary) -> [String] {
    switch summary.state {
    case .notStarted:
      return [
        String(
          localized: "Not started", table: "FocusTest",
          comment: "The Focus test's state on the plan: the learner hasn't taken it")
      ] + (summary.offer.map { [about(minutes: $0.minutes)] } ?? [])
    case .sitting where summary.offer != nil:
      return [
        String(
          localized: "Continue", table: "FocusTest",
          comment: "The Focus test's state on the plan: a sitting is open with questions left"),
        String(
          localized: "\(summary.offer?.questions ?? 0) questions left", table: "FocusTest",
          comment: "How many questions an open Focus test sitting has left"),
      ]
    case .sitting, .checked:
      let result =
        summary.subjects.map {
          String(
            localized: "Questions on \($0.asked) of \($0.total) subjects", table: "FocusTest",
            comment: "The Focus test's last result on the plan: subjects it asked about")
        }
        ?? String(
          localized: "Your answers are in your plan", table: "FocusTest",
          comment:
            "The Focus test's result on the plan, for a goal placed before it counted subjects")

      return [result]
        + (summary.offer.map {
          [
            String(
              localized: "Up to \($0.questions) more questions", table: "FocusTest",
              comment: "How many more questions the Focus test can ask now")
          ]
        } ?? [])
    }
  }
}
