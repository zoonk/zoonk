import SwiftUI

/// Main's prerequisites sheet: how much of what the topics build on to study. The recommended
/// option is marked as soon as the sheet has it; studied prerequisites stay studied.
struct PlanBasesView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(PlanStore.self) private var store
  @State private var choices: [String: BaseChoice]
  @State private var preview: PlanPreviewState = .checking
  @State private var previewAttempt = 0
  @State private var recommended: BaseChoice?

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan
  let bases: GoalPlan.Bases

  /// A preview answers for its choices against the plan it was asked on, as main's does.
  private struct PreviewKey: Equatable {
    let attempt: Int
    let choices: [String]
    let plan: GoalPlan
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

    ZoonkList {
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
            Text("Mixed", tableName: "Plan", comment: "Prerequisites with different choices")
              .tag(BaseChoice?.none)
          }

          ForEach([BaseChoice.deep, .essential, .quick, .skip], id: \.self) { choice in
            option(choice, minutes: open.reduce(0) { $0 + minutes($1, choice) })
              .tag(BaseChoice?.some(choice))
          }
        } label: {
          Text(
            "All prerequisites", tableName: "Plan",
            comment: "Picks one choice for every prerequisite")
        }
        .pickerStyle(.inline)

        if let recommended {
          Text(recommendation(recommended))
            .foregroundStyle(.mutedForeground)
        }
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
                option(choice, minutes: minutes(item, choice)).tag(choice)
              }
            } label: {
              Text(item.name)
            }
          }
        }
      }

      if !changed.isEmpty {
        Section {
          switch preview {
          case .checking:
            Label {
              Text(
                "Checking what changes…", tableName: "Plan", comment: "A change's preview loading")
            } icon: {
              ProgressView()
            }
          case .failed:
            Text(
              "We couldn't check what changes.", tableName: "Plan",
              comment: "A change's preview failed to load")

            Button {
              previewAttempt += 1
            } label: {
              Text("Try again", tableName: "Plan", comment: "Asks again after it failed")
            }
          case .unchanged:
            Text(
              "Your plan stays as it is.", tableName: "Plan", comment: "A preview with no change")
          case .changes(let previewed):
            PlanEffectDiff(
              effect: previewed.effect, today: plan.today,
              options: PlanChangeOptions(
                byDate: plan.schedule.targetDate != nil, dateKind: editor.dateKind))
          }

          BusyButton(isBusy: editor.isSaving, isRow: true) {
            Task { await save(changed, open: open) }
          } label: {
            Text("Save", tableName: "Plan", comment: "Saves the prerequisites' choices")
          }
          .disabled(!preview.canSave && !editor.isSaving)
        }
      }
    }
    .navigationTitle(
      Text("Prerequisites", tableName: "Plan", comment: "Title of the prerequisites")
    )
    .toolbarTitleDisplayMode(.inline)
    .task {
      await advise()
    }
    .task(
      id: PreviewKey(
        attempt: previewAttempt,
        choices: changed.map { "\($0.skillId):\(choices[$0.skillId]?.rawValue ?? "")" },
        plan: plan)
    ) {
      await check(changed)
    }
  }

  /// An option's name and the time it takes, the recommended one marked.
  private func option(_ choice: BaseChoice, minutes: Int) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      choice == .skip
        ? planBaseChoiceName(choice)
        : Text(
          "\(planBaseChoiceName(choice))\u{00A0}· \(planDurationText(minutes: Double(minutes)))",
          tableName: "Plan",
          comment: "A prerequisite option and the time it takes, like \"Every lesson · 12 hr\"")

      if choice == recommended {
        Text("Recommended", tableName: "Plan", comment: "Marks the recommended prerequisite option")
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
      }
    }
  }

  private func recommendation(_ choice: BaseChoice) -> String {
    switch choice {
    case .deep:
      String(
        localized: "We recommend every lesson. Your time covers them.", table: "Plan",
        comment: "The app's recommendation for the prerequisites")
    case .essential:
      String(
        localized: "We recommend the first lessons only.", table: "Plan",
        comment: "The app's recommendation for the prerequisites")
    case .quick, .skip:
      String(
        localized: "We recommend one short lesson each, so there's time for the rest.",
        table: "Plan", comment: "The app's recommendation for the prerequisites")
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

  /// No recommendation shows when it can't be read: the options stand without it.
  private func advise() async {
    let goalId = goal.id
    let result = await store.write { api, token in
      try await api.basesAdvice(token: token, goalId: goalId)
    } changed: { _ in
      false
    }

    if case .done(let answer) = result, answer.ready {
      recommended = answer.recommended
    }
  }

  private func check(_ changed: [GoalPlan.Bases.Item]) async {
    preview = .checking

    guard !changed.isEmpty else {
      return
    }

    let goalId = goal.id
    let edits = [edit(changed)]
    let answer = await store.write { api, token in
      try await api.preview(token: token, goalId: goalId, edits: edits)
    } changed: { _ in
      false
    }

    switch answer {
    case .done(let previewed): preview = PlanPreviewState(previewed)
    case .failed: preview = .failed
    case .obsolete: break
    }
  }

  private func save(_ changed: [GoalPlan.Bases.Item], open: [GoalPlan.Bases.Item]) async {
    let saved = await editor.change(
      [edit(changed)],
      sentence: planBaseChoicesStatement(open.map { choices[$0.skillId] ?? $0.choice }))

    if saved {
      dismiss()
    }
  }

  private func edit(_ changed: [GoalPlan.Bases.Item]) -> PlanEdit {
    .baseChoices(changed.map { (skillId: $0.skillId, choice: choices[$0.skillId] ?? $0.choice) })
  }
}

func planBaseChoiceName(_ choice: BaseChoice) -> Text {
  switch choice {
  case .deep:
    Text("Every lesson", tableName: "Plan", comment: "Prerequisite option: all its lessons")
  case .essential:
    Text(
      "First lessons only", tableName: "Plan",
      comment: "Prerequisite option: the first third of its lessons")
  case .quick:
    Text(
      "One short lesson each", tableName: "Plan", comment: "Prerequisite option: one short lesson")
  case .skip: Text("Skip", tableName: "Plan", comment: "Prerequisite option: leave it out")
  }
}

/// "12 prerequisites · first lessons only · 4 hr".
func planBasesSummary(_ bases: GoalPlan.Bases) -> String {
  let open = bases.items.filter { !$0.studied }
  let count = bases.items.count
  let picked = Set(open.map(\.choice))
  let minutes = open.reduce(0) { sum, item in
    switch item.choice {
    case .deep: sum + item.minutes.deep
    case .essential: sum + item.minutes.essential
    case .quick: sum + item.minutes.quick
    case .skip: sum
    }
  }
  let time = planDurationText(minutes: Double(minutes))

  guard picked.count == 1, let choice = picked.first else {
    return String(
      localized: "\(count) prerequisites\u{00A0}· your choices\u{00A0}· \(time)", table: "Plan",
      comment: "The plan's prerequisites with different choices, and the time they take")
  }

  switch choice {
  case .deep:
    return String(
      localized: "\(count) prerequisites\u{00A0}· every lesson\u{00A0}· \(time)", table: "Plan",
      comment: "The plan's prerequisites, all studied with every lesson, and the time they take")
  case .essential:
    return String(
      localized: "\(count) prerequisites\u{00A0}· first lessons only\u{00A0}· \(time)",
      table: "Plan",
      comment: "The plan's prerequisites, all studied with their first lessons only, and the time")
  case .quick:
    return String(
      localized: "\(count) prerequisites\u{00A0}· one short lesson each\u{00A0}· \(time)",
      table: "Plan",
      comment: "The plan's prerequisites, each studied with one short lesson, and the time")
  case .skip:
    return String(
      localized: "\(count) prerequisites\u{00A0}· skipped", table: "Plan",
      comment: "The plan's prerequisites, all skipped")
  }
}
