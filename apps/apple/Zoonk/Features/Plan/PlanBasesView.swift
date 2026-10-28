import SwiftUI

/// "Prerequisites": how to study each topic the goal builds on, in depth, the essentials, one quick
/// lesson, or skipped. The app recommends a choice only when the learner asks; picking one for all
/// applies it to every prerequisite not studied yet. Before saving, the sheet says what the choices
/// change, and studied prerequisites stay studied.
struct PlanBasesView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(PlanStore.self) private var store
  @State private var choices: [String: BaseChoice]
  @State private var effect: PlanEffect?
  @State private var isChecking = false
  @State private var recommended: BaseChoice?
  @State private var advice: Advice = .none

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan
  let bases: GoalPlan.Bases

  private enum Advice: Equatable {
    case asking
    case building
    case none
    case shown
  }

  init(editor: PlanEditor, goal: LearnerGoal, plan: GoalPlan, bases: GoalPlan.Bases) {
    self.editor = editor
    self.goal = goal
    self.plan = plan
    self.bases = bases
    _choices = State(
      initialValue: Dictionary(uniqueKeysWithValues: bases.items.map { ($0.skillId, $0.choice) }))
  }

  var body: some View {
    let open = bases.items.filter { !$0.studied }
    let changed = open.filter { choices[$0.skillId] != $0.choice }

    Form {
      Section {
        Picker(
          selection: Binding(
            get: { sharedChoice(open) },
            set: { choice in
              guard let choice else {
                return
              }

              for item in open where item.choices.contains(choice) {
                choices[item.skillId] = choice
              }
            })
        ) {
          if sharedChoice(open) == nil {
            Text(
              "Different choices", tableName: "Plan", comment: "Prerequisites with mixed choices"
            )
            .tag(BaseChoice?.none)
          }

          ForEach([BaseChoice.deep, .essential, .quick, .skip], id: \.self) { choice in
            choiceLabel(choice).tag(BaseChoice?.some(choice))
          }
        } label: {
          Text(
            "All prerequisites", tableName: "Plan",
            comment: "Picks one choice for every prerequisite")
        }

        switch advice {
        case .none:
          Button {
            Task { await advise() }
          } label: {
            Text(
              "Recommend a choice", tableName: "Plan",
              comment: "Asks which choice the app recommends")
          }
        case .asking:
          ProgressView()
        case .building:
          Text(
            "Your plan is still being built. Try again in a moment.", tableName: "Plan",
            comment: "Advice asked while the plan was being built"
          )
          .foregroundStyle(.secondary)
        case .shown:
          if let recommended {
            Text(adviceText(recommended))
              .foregroundStyle(.secondary)
          }
        }
      } footer: {
        Text(
          "Already know some? Show it in a test and they leave your plan on their own.",
          tableName: "Plan", comment: "Says known prerequisites can be tested out")
      }

      Section {
        ForEach(bases.items) { item in
          if item.studied {
            LabeledContent {
              Text("Studied", tableName: "Plan", comment: "A prerequisite already studied")
            } label: {
              Text(item.name)
            }
          } else {
            Picker(
              selection: Binding(
                get: { choices[item.skillId] ?? item.choice },
                set: { choices[item.skillId] = $0 })
            ) {
              ForEach(item.choices, id: \.self) { choice in
                VStack(alignment: .leading) {
                  choiceLabel(choice)
                  if choice != .skip {
                    Text(planDurationText(minutes: Double(minutes(item, choice))))
                  }
                }
                .tag(choice)
              }
            } label: {
              Text(item.name)
            }
          }
        }
      } footer: {
        Text(
          "Prerequisites you've studied stay studied.", tableName: "Plan",
          comment: "Says studied prerequisites keep counting")
      }

      if !changed.isEmpty {
        Section {
          if isChecking {
            Label {
              Text(
                "Checking what changes…", tableName: "Plan", comment: "A change's preview loading")
            } icon: {
              ProgressView()
            }
          } else if let text = planEffectText(effect, plan: plan) {
            Text(text)
          } else {
            Text(
              "Your plan stays as it is.", tableName: "Plan", comment: "A preview with no change")
          }

          Button {
            Task { await save(changed) }
          } label: {
            Text("Save choices", tableName: "Plan", comment: "Saves the prerequisites' choices")
          }
          .disabled(isChecking || editor.isSaving)
        }
      }
    }
    .navigationTitle(
      Text("Prerequisites", tableName: "Plan", comment: "Title of the prerequisites")
    )
    .toolbarTitleDisplayMode(.inline)
    .task(id: changed.map { "\($0.skillId):\(choices[$0.skillId]?.rawValue ?? "")" }) {
      await preview(changed)
    }
  }

  private func choiceLabel(_ choice: BaseChoice) -> Text {
    switch choice {
    case .deep: Text("In depth", tableName: "Plan", comment: "Prerequisite choice: every lesson")
    case .essential:
      Text("Essentials", tableName: "Plan", comment: "Prerequisite choice: the first third")
    case .quick:
      Text("Quick lesson", tableName: "Plan", comment: "Prerequisite choice: one short lesson")
    case .skip: Text("Skip", tableName: "Plan", comment: "Prerequisite choice: leave it out")
    }
  }

  private func minutes(_ item: GoalPlan.Bases.Item, _ choice: BaseChoice) -> Int {
    switch choice {
    case .deep: item.minutes.deep
    case .essential: item.minutes.essential
    case .quick: item.minutes.quick
    case .skip: 0
    }
  }

  private func sharedChoice(_ open: [GoalPlan.Bases.Item]) -> BaseChoice? {
    let picked = Set(open.compactMap { choices[$0.skillId] })
    return picked.count == 1 ? picked.first : nil
  }

  private func adviceText(_ choice: BaseChoice) -> String {
    choice == .deep
      ? String(
        localized: "Your time covers everything, so we recommend each prerequisite in depth.",
        table: "Plan", comment: "The app's recommendation for prerequisites")
      : String(
        localized: "We recommend the essentials, so the topics that build on them make sense.",
        table: "Plan", comment: "The app's recommendation for prerequisites")
  }

  private func advise() async {
    advice = .asking
    let goalId = goal.id
    let answer = await store.write { api, token in
      try await api.basesAdvice(token: token, goalId: goalId)
    } changed: { _ in
      false
    }

    guard let answer, answer.ready, let choice = answer.recommended else {
      advice = answer == nil ? .none : .building
      return
    }

    recommended = choice
    advice = .shown

    for item in bases.items where !item.studied && item.choices.contains(choice) {
      choices[item.skillId] = choice
    }
  }

  /// What the picked choices would change, asked again whenever they change.
  private func preview(_ changed: [GoalPlan.Bases.Item]) async {
    guard !changed.isEmpty else {
      effect = nil
      return
    }

    isChecking = true
    defer { isChecking = false }

    let goalId = goal.id
    let edits = [edit(changed)]
    effect =
      await store.write { api, token in
        try await api.preview(token: token, goalId: goalId, edits: edits)
      } changed: { _ in
        false
      } ?? nil
  }

  private func save(_ changed: [GoalPlan.Bases.Item]) async {
    let saved = await editor.change(
      [edit(changed)],
      sentence: String(
        localized: "Your prerequisites changed.", table: "Plan",
        comment: "Says the prerequisites' choices were saved"))

    if saved {
      dismiss()
    }
  }

  private func edit(_ changed: [GoalPlan.Bases.Item]) -> PlanEdit {
    .baseChoices(changed.map { (skillId: $0.skillId, choice: choices[$0.skillId] ?? $0.choice) })
  }
}

/// "3 prerequisites · 2 hr": how many there are and the time they take as chosen.
func planBasesSummary(_ bases: GoalPlan.Bases) -> String {
  let minutes = bases.items.filter { !$0.studied }.reduce(0) { sum, item in
    switch item.choice {
    case .deep: sum + item.minutes.deep
    case .essential: sum + item.minutes.essential
    case .quick: sum + item.minutes.quick
    case .skip: sum
    }
  }

  let count = String(
    localized: "\(bases.items.count) prerequisites", table: "Plan",
    comment: "How many prerequisites the plan has")

  return minutes > 0 ? "\(count) · \(planDurationText(minutes: Double(minutes)))" : count
}
