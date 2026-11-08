import SwiftUI

/// A language goal's aim: the CEFR level its course goes up to, and the aims above the learner's
/// level to change it to with `setAim`. The question's reasons come with it where onboarding asks.
struct LanguageAimView: Codable, Equatable, Sendable {
  struct Choice: Codable, Equatable, Sendable {
    let aim: String
    /// Hours of study, practice included, from the learner's level to this aim.
    let hours: Int
  }

  struct Reason: Codable, Equatable, Sendable {
    /// Nil for a certificate, whose exam decides.
    let aim: String?
    /// Hours of study from scratch; nil for a certificate.
    let hours: Int?
    let reason: String
  }

  let aim: String?
  let choices: [Choice]
  var reasons: [Reason]?

  /// Main's `getAimAhead`: a learner past their aim isn't told when they'll reach it.
  var aimAhead: String? {
    choices.contains { $0.aim == aim } ? aim : nil
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
    _ ends: Binding<[String: String]>, aims: [String], key: some Equatable,
    read: @escaping @MainActor @Sendable (String) async -> String?
  ) -> some View {
    task(id: key) {
      ends.wrappedValue = [:]

      await withTaskGroup(of: (String, String?).self) { group in
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

/// Under an aim to pick: the hours of study still needed, then when it's reached once that's known.
func aimChoiceDetail(hours: Int, end: String?) -> String {
  let hours = hours.formatted()

  guard let end else {
    return String(
      localized: "About \(hours) h more", table: "Onboarding",
      comment: "Under a language level to aim for: the hours of study still needed to reach it")
  }

  return String(
    localized: "About \(hours) h more · around \(PlanDate.longText(end, month: true))",
    table: "Onboarding",
    comment:
      "Under a language level to aim for: the hours of study still needed to reach it, then when; the second argument is a month and year, like 'Nov 2027'"
  )
}

/// Main's `useAimWords`: what each aim lets the learner do.
func aimLabel(_ aim: String) -> String? {
  switch aim {
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

/// Main's `AimPicker` on phones: "How far do you want to go?", each aim with the hours left and when
/// it's reached. Picking applies it; a change that didn't save keeps the choices open.
struct AimChoicesSheet: View {
  let languageAim: LanguageAimView
  /// What the hours count from, the learner's level and their time a day; nil while unknown.
  var fromLine: String?
  /// When the current aim is reached, as its screen says.
  var currentEnd: String?
  /// When another aim would be reached, as picking it would lay the plan out.
  let readEnd: @MainActor @Sendable (String) async -> String?
  /// False when it couldn't be saved.
  let pick: (String) async -> Bool

  @Environment(\.dismiss) private var dismiss
  @State private var picking: String?
  @State private var failed = false
  @State private var ends: [String: String] = [:]

  var body: some View {
    NavigationStack {
      ZoonkList {
        Section {
          ForEach(languageAim.choices, id: \.aim) { choice in
            BusyButton(isBusy: picking == choice.aim, isRow: true) {
              apply(choice.aim)
            } label: {
              VStack(alignment: .leading, spacing: 2) {
                AimName(aim: choice.aim)
                  .typeStyle(.rowTitle)
                  .foregroundStyle(Color(.foreground))

                Text(
                  aimChoiceDetail(
                    hours: choice.hours,
                    end: choice.aim == languageAim.aim ? currentEnd : ends[choice.aim])
                )
                .typeStyle(.meta)
                .foregroundStyle(.mutedForeground)
              }
              .frame(maxWidth: .infinity, alignment: .leading)
            }
            .pickedRow(choice.aim == languageAim.aim)
            .accessibilityAddTraits(choice.aim == languageAim.aim ? .isSelected : [])
          }
        } header: {
          if let fromLine {
            Text(fromLine)
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
              .textCase(nil)
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
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
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

/// Main's `useFromLevel`: where the aims' hours count from, and the learner's time a day.
func aimFromLine(level: String?, minutes: Int) -> String {
  let time = planDurationText(minutes: Double(minutes))

  return switch level {
  case nil, "none"?:
    String(
      localized: "From scratch, at \(time) a day.", table: "Onboarding",
      comment: "Under \"How far do you want to go?\": the learner starts from nothing")
  case "basic"?:
    String(
      localized: "From the basics, at \(time) a day.", table: "Onboarding",
      comment: "Under \"How far do you want to go?\": the learner knows the basics")
  case "intermediate"?:
    String(
      localized: "From an intermediate level, at \(time) a day.", table: "Onboarding",
      comment: "Under \"How far do you want to go?\": the learner is at an intermediate level")
  case "advanced"?:
    String(
      localized: "From an advanced level, at \(time) a day.", table: "Onboarding",
      comment: "Under \"How far do you want to go?\": the learner is at an advanced level")
  case let level?:
    String(
      localized: "From \(level), at \(time) a day.", table: "Onboarding",
      comment:
        "Under \"How far do you want to go?\": the learner's level, a CEFR label like 'B1+', and their time a day"
    )
  }
}
