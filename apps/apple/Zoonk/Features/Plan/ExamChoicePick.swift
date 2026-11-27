import SwiftUI

extension GoalPlan.ExamChoice {
  var pickedNames: String? {
    let names = options.filter { subjects.contains($0.name) }.map { $0.shortName ?? $0.name }
    return names.isEmpty ? nil : names.formatted(.list(type: .and))
  }

  /// Main's `PlanChoiceLines`: "Foreign language: Spanish".
  var followingLine: String? {
    pickedNames.map { names in
      String(
        localized: "\(group): \(names)", table: "Plan",
        comment:
          "An exam's choice, such as its foreign language, then the options the learner's plan studies, listed as the exam's notice names them"
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
  static func examChoiceQuestion(group: String, take: Int) -> Text {
    take > 1
      ? Text(
        "\(group): which ones will you take?", tableName: "Plan",
        comment:
          "Asks which options of an exam's choice, like the modules a course takes, the learner takes; they take several"
      )
      : Text(
        "\(group): which one will you take?", tableName: "Plan",
        comment:
          "Asks which option of an exam's choice, like its foreign language, the learner takes")
  }
}

struct ExamPickLimit: View {
  let take: Int

  var body: some View {
    Text(
      "Pick up to \(take).", tableName: "Plan",
      comment:
        "Over the options of an exam's choice whose candidates take several of them, like two of a course's modules"
    )
    .typeStyle(.body)
    .foregroundStyle(.mutedForeground)
  }
}

/// Main's `CheckList` with its `max`: an exam choice's options, each with a square; once `take` are
/// ticked, the others dim until one is unticked.
struct ExamOptionChecks: View {
  let options: [GoalPlan.ExamChoice.Option]
  let take: Int
  @Binding var picked: [String]

  var body: some View {
    let picks = ExamOptionPicks(options: options.map(\.name), take: take, names: picked)

    ForEach(options, id: \.name) { option in
      let isPicked = picks.names.contains(option.name)

      ChoiceRow(
        Text(verbatim: option.shortName ?? option.name), picks: .several, isPicked: isPicked,
        canPick: picks.canPick(option.name)
      ) {
        var next = picks
        next.set(option.name, picked: !isPicked)
        picked = next.names
      }
    }
  }
}
