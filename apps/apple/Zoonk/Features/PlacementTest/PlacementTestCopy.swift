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

  /// "40 lessons skipped", the title after a test or a part of it.
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

  /// What a closed part skipped, or that its skips wait until tomorrow.
  static func partLine(_ stop: PlacementPartStop) -> String {
    stop.heldUntilTomorrow && stop.partLessonsSkipped == 0
      ? String(localized: retakeTomorrow) : TestCopy.partSkipped(stop.partLessonsSkipped)
  }

  /// "11 parts left · About 1 hr 6 min": the parts still to take and how long they take together,
  /// since parts shrink as topics close.
  static func partsLeftFacts(_ attempt: PlacementAttempt) -> [String] {
    [
      TestCopy.partsLeft(attempt.partsLeft),
      TestCopy.about(minutes: attempt.remainingEstimatedMinutes),
    ]
  }

  /// Where a full test with parts left stands: its next part and the time left, or the question a
  /// part stopped midway goes on with.
  static func standing(_ attempt: PlacementAttempt) -> [String] {
    if let resume = attempt.resume {
      return [
        TestCopy.part(resume.part, of: attempt.parts),
        TestCopy.question(resume.question, of: attempt.questions),
      ]
    }

    guard attempt.partComplete else {
      return [
        TestCopy.part(attempt.part, of: attempt.parts),
        TestCopy.question(attempt.answered + 1, of: attempt.questions),
      ]
    }

    return [
      TestCopy.part(attempt.nextPart ?? attempt.part, of: attempt.parts),
      TestCopy.aboutLeft(minutes: attempt.remainingEstimatedMinutes),
    ]
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

  static let inProgress = String(
    localized: "In progress", table: "Onboarding",
    comment: "The plan's test row while a test is open")

  /// The test's facts on the plan's row: what tapping it gives, where an open one stands, or what
  /// the last one found and when.
  static func planLine(_ test: PlanPlacementTest) -> [String] {
    if test.state == .continue {
      if let attempt = test.attempt {
        if attempt.quickTestEnded {
          return resultLine(test.result)
        }

        return attempt.length == .wholeCourse
          ? standing(attempt)
          : [inProgress, TestCopy.question(attempt.answered + 1, of: attempt.questions)]
      }

      guard let answered = test.answered, let total = test.total else { return [inProgress] }
      return [inProgress, TestCopy.question(answered + 1, of: total)]
    }

    guard test.state == .result, test.result != nil else {
      let minutes = test.offer?.estimatedMinutes ?? test.estimatedMinutes

      return [
        test.kind == .language
          ? String(
            localized: "Find your level and skip what you know", table: "Onboarding",
            comment: "The level test's line on a language plan")
          : String(
            localized: "Skip lessons you already know", table: "Onboarding",
            comment: "The test's line on a plan before it's taken"),
        TestCopy.about(minutes: minutes),
      ]
    }

    return resultLine(test.result)
  }

  private static func resultLine(_ result: PlacementTestResult?) -> [String] {
    guard let result else { return [] }
    return [lessonsSkipped(result.lessonsSkipped), PlanDate.moment(result.finishedAt)]
  }
}
