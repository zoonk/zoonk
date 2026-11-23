import Foundation

/// The words of the test taken from the plan, shared by its row, its screens and the lesson's offer.
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
    "Test what you know", table: "Onboarding",
    comment: "The test of what the learner already knows in a course, taken from the plan")
  static let languageName = LocalizedStringResource(
    "Level test", table: "Onboarding", comment: "Over the level test's result")

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

  /// "40 lessons skipped", the title after a test or a part of it.
  static func lessonsSkipped(_ count: Int) -> String {
    count == 0
      ? String(
        localized: "No lessons skipped", table: "Onboarding",
        comment: "After a test of what the learner knows: it took no lesson out of the plan")
      : String(
        localized: "\(count) lessons skipped", table: "Onboarding",
        locale: .appLanguage,
        comment: "After a test of what the learner knows: how many lessons it took out of the plan")
  }

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

  /// The test's facts on the plan's row: what tapping it gives, how far an open one is, or what the
  /// last one found and when.
  static func planLine(_ test: PlanPlacementTest) -> [String] {
    if test.state == .continue {
      return [
        String(
          localized: "In progress", table: "Onboarding",
          comment: "The plan's test row while a test is open"),
        String(
          localized: "\(studyDuration(minutes: test.estimatedMinutes)) left", table: "Onboarding",
          comment: "How long the rest of an open test takes, such as \"9 min left\""),
      ]
    }

    if test.kind == .language {
      return [
        String(
          localized: "Find your level and skip what you know", table: "Onboarding",
          comment: "The level test's line on a language plan")
      ]
    }

    guard test.state == .result, let result = test.result else {
      return [
        String(
          localized: "Skip lessons you already know", table: "Onboarding",
          comment: "The test's line on a plan before it's taken")
      ]
    }

    return [lessonsSkipped(result.lessonsSkipped), PlanDate.moment(result.finishedAt)]
  }
}
