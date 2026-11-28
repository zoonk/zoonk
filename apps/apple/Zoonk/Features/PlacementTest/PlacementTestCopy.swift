import Foundation

/// The words of a course's and a language's tests, shared by the plan's row, their screens and the
/// lesson's offer.
enum PlacementTestCopy {
  static func knownLessons(_ count: Int) -> LocalizedStringResource {
    count == 1
      ? LocalizedStringResource(
        "You already know it. It stays in your practice.", table: "Onboarding")
      : LocalizedStringResource(
        "You already know them. They stay in your practice.", table: "Onboarding")
  }

  static func lessonsRestored(_ count: Int) -> LocalizedStringResource {
    count == 1
      ? LocalizedStringResource("The lesson is back in your plan.", table: "Onboarding")
      : LocalizedStringResource("The lessons are back in your plan.", table: "Onboarding")
  }

  static let learnName = LocalizedStringResource(
    "Test what you know", table: "Onboarding")
  static let languageName = LocalizedStringResource(
    "Level test", table: "Onboarding")

  static func name(_ kind: PlanPlacementTest.Kind) -> LocalizedStringResource {
    kind == .language ? languageName : learnName
  }

  static let retakeTomorrow = LocalizedStringResource(
    "You undid these today. Answer again tomorrow to skip them.", table: "Onboarding")

  static func rangeFacts(_ ranges: [PlacementTestResult.SkillRange]) -> [String] {
    ranges.map { skillRange($0.skill, $0.range) }
  }

  static let notNow = LocalizedStringResource(
    "Not now", table: "Onboarding",
    comment: "Leaves the test taken from the plan, or a lesson's offer to check the level, for now")

  /// "40 lessons skipped": the title after a test or a part of it, or the caption under a course's
  /// line on its result.
  static func lessonsSkipped(_ count: Int) -> String {
    count == 0
      ? String(
        localized: "No lessons skipped", table: "Onboarding",
        comment: "The title after a placement test: how many lessons it took out of the plan.")
      : String(
        localized: "\(count) lessons skipped", table: "Onboarding",
        locale: .appLanguage,
        comment: "The title after a placement test: how many lessons it took out of the plan.")
  }

  /// Over the chapter's name on a course test's result.
  static let youStartHere = LocalizedStringResource(
    "You start here", table: "Onboarding",
    comment: "Over the name of the chapter a course's placement test starts the learner in.")

  /// The plan's last course result, when a new test can start.
  static let takeTestAgain = LocalizedStringResource(
    "Take the test again", table: "Onboarding",
    comment:
      "A quiet action on the result of a placement test opened again from the plan: it offers a new test."
  )

  static func skillRange(_ skill: LevelTest.Skill, _ range: LevelRange) -> String {
    switch skill {
    case .listening:
      String(
        localized: "Listening \(range.shown)", table: "Onboarding",
        comment: "A CEFR level range the test found for listening, such as \"B1–B2\"")
    default:
      String(
        localized: "Reading \(range.shown)", table: "Onboarding",
        comment: "A CEFR level range the test found for reading, such as \"B1–B2\"")
    }
  }

  static func testOut(_ level: String) -> String {
    String(
      localized: "Test out of \(level)", table: "Onboarding",
      comment: "A short test of one language level, such as \"Test out of B2\"")
  }

  static let inProgress = String(
    localized: "In progress", table: "Onboarding",
    comment: "The plan's test row while a test is open")

  /// The test's facts on the plan's row: what tapping it gives, where an open one stands, or what
  /// the last one found and when.
  static func planLine(_ test: PlanPlacementTest) -> [String] {
    let open: (answered: Int, total: Int)? =
      if let attempt = test.attempt {
        (attempt.answered, attempt.questions)
      } else if test.kind == .language, test.state == .continue {
        test.answered.flatMap { answered in test.total.map { (answered, $0) } }
      } else {
        nil
      }

    // A question is named only while there's one to ask: at the ceiling the test is still open
    // until it's finished.
    if let open {
      return open.answered < open.total
        ? [inProgress, TestCopy.question(open.answered + 1, of: open.total)] : [inProgress]
    }

    if test.kind == .language, test.state == .continue {
      return [inProgress]
    }

    if let result = test.result {
      return [lessonsSkipped(result.lessonsSkipped), PlanDate.moment(result.finishedAt)]
    }

    return [
      test.kind == .language
        ? String(
          localized: "Find your level and skip what you know", table: "Onboarding",
          comment: "The level test's line on a language plan")
        : String(
          localized: "Skip lessons you already know", table: "Onboarding",
          comment: "The test's line on a plan before it's taken"),
      TestCopy.about(minutes: test.offer?.estimatedMinutes ?? test.estimatedMinutes),
    ]
  }
}
