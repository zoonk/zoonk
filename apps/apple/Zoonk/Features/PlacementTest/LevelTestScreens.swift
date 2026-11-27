import SwiftUI

/// Main's `LevelResult`: each skill's range, or "Not tested yet" for one the test didn't finish,
/// what the test skipped and the lesson the plan goes on with. The plan's has the next level's
/// test-out beside its way on.
struct LanguageTestResultView: View {
  let result: PlacementTestResult?
  let targetLanguage: String
  let testOutLevel: String?
  let pressed: FocusTestPress?
  let failed: Bool
  var undo: PlacementResultUndo?
  var onboarding = false
  /// Onboarding's: the learner's own language, which the app can switch to.
  var appLanguage: String?
  let onContinue: () -> Void
  let onTestOut: () -> Void

  var body: some View {
    let restored = undo?.restored != nil

    ZoonkList {
      StepHeader(
        title: restored
          ? Text(PlacementTestCopy.lessonsSkipped(0))
          : Text(
            "Your \(Locale.current.languageName(targetLanguage)) level", tableName: "Onboarding"),
        description: undo?.restored ?? Text(lead))

      Section {
        Grid(horizontalSpacing: 16, verticalSpacing: 0) {
          ForEach(Array(skills.enumerated()), id: \.element) { index, skill in
            if index > 0 {
              Divider()
            }

            row(skill)
          }
        }
      }
      .listRowInsets(.vertical, 0)

      if let nextLesson = result?.nextLesson, !restored {
        UpNextPanel(title: nextLesson.title)
      }

      if let appLanguage, onboarding {
        AppLanguageAction(language: appLanguage)
      }

      if let testOutLevel, !onboarding {
        BusyButton(isBusy: pressed == .other, action: onTestOut) {
          Text(verbatim: PlacementTestCopy.testOut(testOutLevel))
            .underline()
        }
        .buttonStyle(.borderless)
        .disabled(pressed == .main || undo?.request.isRunning == true)
      }
    }
    .bottomBar(
      note: undo?.failure ?? (failed && pressed == nil ? BarNote(TestCopy.saveFailure) : nil)
    ) {
      undo?.button
      StepButtons(
        canContinue: undo?.request.isRunning != true,
        continueLabel: onboarding
          ? nil
          : result?.nextLesson == nil || restored
            ? Text(TestCopy.done) : Text(TestCopy.startLesson),
        onContinue: onContinue)
    }
    .onboardingColumn()
    .announcesStatus(undo?.announcement)
    .environment(\.isSavingAnswer, pressed != nil || undo?.request.isRunning == true)
  }

  private let skills: [LevelTest.Skill] = [.reading, .listening]

  @ViewBuilder
  private func row(_ skill: LevelTest.Skill) -> some View {
    let range = result?.ranges?[skill.rawValue]

    GridRow {
      Text(verbatim: languageSkillName(skill.rawValue))
        .typeStyle(.meta.weight(.medium))
        .gridColumnAlignment(.leading)
        .frame(minHeight: 44)
        .accessibilityLabel(
          range.map { Text(PlacementTestCopy.skillRange(skill, $0)) }
            ?? Text(
              verbatim: [languageSkillName(skill.rawValue), String(localized: TestCopy.notTested)]
                .joinedFacts()))

      LevelRangeBar(range: range)
        .frame(minWidth: 32, maxWidth: .infinity)

      if let range {
        Text(verbatim: range.shown)
          .typeStyle(.note.weight(.medium))
          .monospacedDigit()
          .fixedSize()
          .gridColumnAlignment(.trailing)
          .accessibilityHidden(true)
      } else {
        Text(TestCopy.notTested)
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
          .fixedSize()
          .gridColumnAlignment(.trailing)
          .accessibilityHidden(true)
      }
    }
  }

  private var lead: String {
    let lessons = result?.lessonsSkipped ?? 0

    if lessons > 0 {
      return String(
        localized: "Skipped \(lessons) lessons you already know.", table: "Onboarding",
        locale: .appLanguage)
    }

    if result?.ranges?[LevelTest.Skill.reading.rawValue] != nil, result?.listeningUntested == true {
      return String(localized: TestCopy.listeningLater)
    }

    return String(
      localized: "Your lessons keep adjusting as you answer.", table: "Onboarding",
      comment: "Under a level test's result that skipped no level")
  }
}

/// Main's `LevelBar` with a range: the six levels, A1 to C2, those the skill lies within filled;
/// none for a skill not tested yet.
private struct LevelRangeBar: View {
  private static let levels = ["A1", "A2", "B1", "B2", "C1", "C2"]

  let range: LevelRange?

  var body: some View {
    let low = range.flatMap { Self.levels.firstIndex(of: $0.low) } ?? Self.levels.count
    let high = range.flatMap { Self.levels.firstIndex(of: $0.high) } ?? low

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
