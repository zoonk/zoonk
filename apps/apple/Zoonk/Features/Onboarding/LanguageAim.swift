import SwiftUI

/// A language goal's aim: the CEFR level its course goes up to, and the aims above the learner's
/// level to change it to with `setAim`. The question's reasons come with it where onboarding asks.
struct LanguageAimView: Codable, Equatable, Sendable {
  struct Choice: Codable, Equatable, Sendable {
    let aim: String
  }

  struct Reason: Codable, Equatable, Sendable {
    /// Nil for a certificate, whose exam decides.
    let aim: String?
    let reason: String
  }

  let aim: String?
  /// The aim as the rest of the plan names it, half bands included ("B1+").
  let label: String?
  /// The goal's language, which names the aim's title.
  let targetLanguage: String?
  let choices: [Choice]
  var reasons: [Reason]?

  /// Main's `useAimWords().title`: "English level to reach", so it isn't read as the game's level.
  var title: String {
    aimTitle(language: targetLanguage)
  }

  /// The picked choice says the aim as the plan does ("B1+"), the others their own level.
  func name(of choice: String) -> String {
    choice == aim ? label ?? choice : choice
  }

  /// Main's `getAimAhead`: the aim as the plan names it, only while it's among the choices, so a
  /// learner past their aim isn't told when they'll reach it.
  var aimAhead: String? {
    choices.contains { $0.aim == aim } ? label ?? aim : nil
  }

  /// Main's `PlanAim`: the aims the editor dates by previewing them. A half band's own date isn't
  /// any choice's, since previewing its band would plan another target.
  var previewedAims: [String] {
    choices.map(\.aim).filter { $0 != aim || label == nil || label == aim }
  }

  /// The aims the planner dates: every choice but the current one, whose date its screen shows.
  var otherAims: [String] {
    choices.map(\.aim).filter { $0 != aim }
  }
}

extension View {
  /// Main's `useAimEnds`: when each of `aims` would be reached, from the planner as picking it would
  /// lay the plan out (`read`, nil without a date). Asked again when `key` changes and only while
  /// the choices show, since each ask plans the goal again.
  func readsAimEnds(
    _ ends: Binding<[String: PlanForecast]>, aims: [String], key: some Equatable,
    read: @escaping @MainActor @Sendable (String) async -> PlanForecast?
  ) -> some View {
    task(id: key) {
      ends.wrappedValue = [:]

      await withTaskGroup(of: (String, PlanForecast?).self) { group in
        for aim in aims {
          group.addTask { (aim, await read(aim)) }
        }

        for await (aim, end) in group where !Task.isCancelled {
          ends.wrappedValue[aim] = end
        }
      }
    }
  }
}

/// Under an aim to pick: when it's reached at the learner's time, once that's known.
func aimChoiceDetail(end: PlanForecast?) -> String? {
  switch end {
  case .month(let isoDate):
    String(
      localized: "Around \(PlanDate.longText(isoDate, month: true))", table: "Onboarding",
      comment:
        "Under a language level to aim for: when the learner reaches it; the argument is a month and year, like 'Nov 2027'"
    )
  case .year(let isoDate):
    String(
      localized: LocalizedStringResource(
        "aimAroundYear",
        defaultValue: "Around \(PlanDate.text(isoDate, today: isoDate, grain: .year))",
        table: "Onboarding",
        comment:
          "When a language level is reached. {year} is a year, like \"2031\"."
      ))
  case .beyond:
    String(
      localized: "In 10+ years", table: "Onboarding",
      comment:
        "Under a language level to aim for, when reaching it takes more than ten years at the learner's time."
    )
  case nil:
    nil
  }
}

/// Main's `useAimWords`: what each aim lets the learner do.
func aimLabel(_ aim: String) -> String? {
  switch aim.hasSuffix("+") ? String(aim.dropLast()) : aim {
  case "A2":
    String(localized: "Get by on trips", table: "Onboarding", comment: "What the A2 level aims for")
  case "B1":
    String(
      localized: "Everyday conversations", table: "Onboarding",
      comment: "What the B1 level aims for")
  case "B2":
    String(
      localized: "Work or study in it", table: "Onboarding", comment: "What the B2 level aims for")
  case "C1":
    String(
      localized: "Speak it fluently", table: "Onboarding", comment: "What the C1 level aims for")
  default:
    nil
  }
}

/// Main's `useReasonCopy` titles: a language goal's reason key as the learner reads it.
func languageReasonLabel(_ reason: String) -> String? {
  switch reason {
  case "travel":
    String(
      localized: "Travel", table: "Onboarding", comment: "A reason to learn a language: to travel")
  case "talk":
    String(
      localized: "Talk with people", table: "Onboarding", comment: "A reason to learn a language")
  case "work":
    String(
      localized: "Work or study in it", table: "Onboarding",
      comment: "A reason to learn a language")
  case "fluent":
    String(
      localized: "Speak it fluently", table: "Onboarding", comment: "A reason to learn a language")
  case "certificate":
    String(
      localized: "Pass a certificate", table: "Onboarding", comment: "A reason to learn a language")
  case "other":
    String(localized: "Something else", table: "Onboarding", comment: "Purpose choice")
  default:
    nil
  }
}

/// "English level to reach": a language aim's title, named with its language.
func aimTitle(language: String?) -> String {
  guard let language, !language.isEmpty else {
    return String(localized: "How far do you want to go?", table: "Onboarding")
  }
  return String(
    localized: "\(Locale.current.languageName(language)) level to reach", table: "Onboarding",
    comment:
      "Titles the language level a learner picks to reach, like \"B2\". {language} is a language name as in a sentence, like \"English\"."
  )
}

/// "B1 · Everyday conversations", the level in mono.
struct AimName: View {
  let aim: String

  var body: some View {
    if let label = aimLabel(aim) {
      Text("\(Text(verbatim: aim).monospaced())\u{00A0}· \(label)")
    } else {
      Text(verbatim: aim).monospaced()
    }
  }
}

/// Main's `AimPicker` on phones: "How far do you want to go?", each aim with when it's reached.
/// Picking applies it; a change that didn't save keeps the choices open.
struct AimChoicesSheet: View {
  let languageAim: LanguageAimView
  /// When the current aim is reached, as its screen says.
  var currentEnd: PlanForecast?
  /// When another aim would be reached, as picking it would lay the plan out.
  let readEnd: @MainActor @Sendable (String) async -> PlanForecast?
  /// False when it couldn't be saved.
  let pick: (String) async -> Bool

  @Environment(\.dismiss) private var dismiss
  @State private var picking: String?
  @State private var failed = false
  @State private var ends: [String: PlanForecast] = [:]

  var body: some View {
    NavigationStack {
      ZoonkList {
        Section {
          ForEach(languageAim.choices, id: \.aim) { choice in
            BusyButton(isBusy: picking == choice.aim, isRow: true) {
              apply(choice.aim)
            } label: {
              ChoiceRowLabel(isPicked: choice.aim == languageAim.aim) {
                VStack(alignment: .leading, spacing: 2) {
                  AimName(aim: languageAim.name(of: choice.aim))
                    .typeStyle(.rowTitle)
                    .foregroundStyle(Color(.foreground))

                  if let detail = aimChoiceDetail(
                    end: choice.aim == languageAim.aim ? currentEnd : ends[choice.aim])
                  {
                    Text(detail)
                      .typeStyle(.meta)
                      .foregroundStyle(.mutedForeground)
                  }
                }
              }
            }
            .pickedRow(choice.aim == languageAim.aim)
            .accessibilityAddTraits(choice.aim == languageAim.aim ? .isSelected : [])
          }
        } footer: {
          SectionFooter {
            if failed {
              FailureLine(
                message: LocalizedStringResource(
                  "That didn't save. Try again.", table: "Onboarding",
                  comment: "A change couldn't be saved"))
            }
          }
        }
        .disabled(picking != nil)
      }
      .navigationTitle(
        Text(
          "How far do you want to go?", tableName: "Onboarding",
          comment: "Title of the choices of a language course's aim")
      )
      .toolbarTitleDisplayMode(.inline)
      .sheetClose { dismiss() }
    }
    .presentationDetents([.medium, .large])
    .readsAimEnds($ends, aims: languageAim.otherAims, key: languageAim.aim, read: readEnd)
  }

  private func apply(_ aim: String) {
    guard aim != languageAim.aim else {
      dismiss()
      return
    }

    picking = aim
    failed = false

    Task {
      let saved = await pick(aim)
      picking = nil

      if saved {
        dismiss()
      } else {
        failed = true
      }
    }
  }
}
