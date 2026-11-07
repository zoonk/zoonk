import SwiftUI

extension GoalPlan.ExamChoice {
  var pickedNames: String? {
    let names = options.filter { subjects.contains($0.name) }.map { $0.shortName ?? $0.name }
    return names.isEmpty ? nil : names.formatted(.list(type: .and))
  }

  /// Main's `PlanChoiceLines`.
  var followingLine: String? {
    pickedNames.map { names in
      String(
        localized: "Following the \(names) syllabus", table: "Onboarding",
        comment:
          "The options of an exam's choice the learner's plan studies, listed, such as a specialty (Desenvolvimento de Sistemas), a foreign language or two modules, named as the exam's notice names them"
      )
    }
  }
}

/// Main's `CheckList` rule for a choice whose candidates take several options: at most `take` on,
/// kept in the notice's order.
struct ExamOptionPicks: Equatable {
  let options: [String]
  let take: Int
  private(set) var names: [String]

  init(options: [String], take: Int, names: [String]) {
    self.options = options
    self.take = take
    self.names = options.filter(names.contains)
  }

  func canPick(_ name: String) -> Bool {
    names.contains(name) || names.count < take
  }

  mutating func set(_ name: String, picked: Bool) {
    guard canPick(name) else {
      return
    }

    names = options.filter { $0 == name ? picked : names.contains($0) }
  }

  func canSave(over saved: [String]) -> Bool {
    !names.isEmpty && names != options.filter(saved.contains)
  }
}

extension Text {
  static func examPickLimit(_ take: Int) -> Text {
    Text(
      "Pick up to \(take).", tableName: "Plan",
      comment:
        "Over the options of an exam's choice whose candidates take several of them, like two of a course's modules"
    )
  }
}

/// An exam choice's options as toggles: once `take` are on, the others wait until one is off.
struct ExamOptionToggles: View {
  let options: [GoalPlan.ExamChoice.Option]
  let take: Int
  @Binding var picked: [String]

  var body: some View {
    let picks = ExamOptionPicks(options: options.map(\.name), take: take, names: picked)

    ForEach(options, id: \.name) { option in
      let canPick = picks.canPick(option.name)

      Toggle(
        isOn: Binding(
          get: { picks.names.contains(option.name) },
          set: { isOn in
            var next = picks
            next.set(option.name, picked: isOn)
            picked = next.names
          })
      ) {
        Text(option.shortName ?? option.name)
          .foregroundStyle(canPick ? Color(.foreground) : .faint)

        if let shortName = option.shortName, shortName != option.name {
          Text(option.name)
            .foregroundStyle(canPick ? .mutedForeground : .faint)
        }
      }
      .disabled(!canPick)
    }
  }
}
