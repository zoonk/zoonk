import SwiftUI

private let saveFailure = LocalizedStringResource(
  "That didn't save. Try again.", table: "Onboarding", comment: "A change couldn't be saved")

/// Main's `LevelResult`: each assessed skill's range, what the test skipped, and the way on: the
/// whole-course test's walk through the course's topics, or the plan with the next level's
/// test-out beside it.
struct LanguageTestResultView: View {
  let length: PlacementLength
  let result: PlacementTestResult?
  let targetLanguage: String
  let testOutLevel: String?
  let pressed: FocusTestPress?
  let failed: Bool
  var undo: PlacementResultUndo?
  var onboarding = false
  let onContinue: () -> Void
  let onTestOut: () -> Void

  var body: some View {
    let walks = length == .wholeCourse && result?.wholeCourseReady == true

    ZoonkList {
      StepHeader(
        title: undo?.restored == nil
          ? Text(
            "Your \(Locale.current.languageName(targetLanguage)) level", tableName: "Onboarding")
          : Text(PlacementTestCopy.lessonsSkipped(0)),
        description: undo?.restored ?? Text(lead))

      if let result, !result.skillRanges.isEmpty {
        Section {
          ForEach(result.skillRanges, id: \.skill) { item in
            LabeledContent {
              Text(verbatim: item.range.shown)
                .monospacedDigit()
            } label: {
              VStack(alignment: .leading, spacing: 6) {
                Text(verbatim: languageSkillName(item.skill.rawValue))
                LevelRangeBar(range: item.range)
              }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(Text(PlacementTestCopy.skillRange(item.skill, item.range)))
          }
        }
      }

    }
    .bottomBar(note: undo?.failure ?? (failed && pressed == nil ? BarNote(saveFailure) : nil)) {
      undo?.button
      StepButtons(
        continueLabel: walks
          ? Text(
            "Keep going", tableName: "Onboarding",
            comment: "Goes on from the whole-course level test to the course's topics")
          : onboarding
            ? nil : Text("Done", tableName: "Onboarding", comment: "Leaves a test's result"),
        skipLabel: testOutLevel.map { Text(verbatim: PlacementTestCopy.testOut($0)) },
        onContinue: onContinue,
        onSkip: !walks && testOutLevel != nil ? onTestOut : nil)
    }
    .onboardingColumn()
    .announcesStatus(undo?.announcement)
    .environment(\.isSavingAnswer, pressed != nil)
  }

  private var lead: String {
    let skipped = result?.levelsSkipped ?? []

    guard !skipped.isEmpty else {
      return String(
        localized: "Your lessons keep adjusting as you answer.", table: "Onboarding",
        comment: "Under a level test's result that skipped no level")
    }

    let count = result?.lessonsSkipped ?? 0
    let lessons = String(
      localized: "\(count) lessons", table: "Onboarding",
      locale: .appLanguage,
      comment: "How many lessons a level test took out of the plan, such as \"12 lessons\"")
    let levels = skipped.formatted(.list(type: .and))

    return String(
      localized: "We skipped \(levels): \(lessons).", table: "Onboarding",
      comment:
        "Under a level test's result: the language levels it skipped, such as \"A1 and A2\", then how many lessons the plan no longer has, such as \"12 lessons\""
    )
  }
}

/// Main's `LevelBar` with a range: the six levels, A1 to C2, those the skill lies within filled.
private struct LevelRangeBar: View {
  private static let levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

  let range: LevelRange

  var body: some View {
    let low = Self.levels.firstIndex(of: range.low) ?? 0
    let high = Self.levels.firstIndex(of: range.high) ?? low

    HStack(spacing: 3) {
      ForEach(Self.levels.indices, id: \.self) { band in
        RoundedRectangle(cornerRadius: 2, style: .continuous)
          .fill(band >= low && band <= high ? Color.success : Color.surface3)
          .frame(height: 4)
      }
    }
    .accessibilityHidden(true)
  }
}

/// Main's `TestOutResult`: what a level's test-out skipped, or that the level stays.
struct LevelTestOutResult: View {
  let view: LevelTestOut
  let isSaving: Bool
  let failed: Bool
  var undo: PlacementResultUndo?
  let onDone: () -> Void

  var body: some View {
    let lessons = view.result?.lessonsSkipped ?? 0

    TestOutcome(
      title: lessons > 0
        ? Text(PlacementTestCopy.lessonsSkipped(undo?.restored == nil ? lessons : 0))
        : Text(
          "\(view.level) stays in your plan", tableName: "Onboarding",
          comment:
            "After a level's test-out that skipped nothing, such as \"B2 stays in your plan\""
        ),
      description: undo?.restored
        ?? (view.total == 0
          ? Text(
            "There aren't enough questions for \(view.level) yet.", tableName: "Onboarding",
            comment: "After a level's test-out that had too few questions to check, such as B2")
          : lessons > 0
            ? Text(PlacementTestCopy.knownLessons(lessons))
            : Text(
              "Your lessons keep adjusting as you answer.", tableName: "Onboarding",
              comment: "Under a level test's result that skipped no level")),
      continueLabel: Text("Done", tableName: "Onboarding", comment: "Leaves a test's result"),
      undo: undo, isSaving: isSaving, failed: failed, onContinue: onDone
    )
    .announcesStatus(undo?.announcement)
  }
}
