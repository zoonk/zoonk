import SwiftUI

struct AdjustPlanSections: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    ForEach(plan.examChoices) { choice in
      PlanExamChoiceSection(editor: editor, goal: goal, choice: choice)
    }

    PlanFocusSection(editor: editor, goal: goal, plan: plan)
      .id(AdjustPlanSheet.Section.focus)

    if let bases = plan.bases, !bases.items.isEmpty {
      Section {
        NavigationLink {
          PlanBasesView(editor: editor, goal: goal, plan: plan, bases: bases)
        } label: {
          LabeledContent {
            Text(planBasesSummary(bases))
          } label: {
            Text("Choose prerequisites", tableName: "Plan", comment: "Opens the prerequisites")
          }
        }
      } header: {
        Text("Prerequisites", tableName: "Plan", comment: "Section of the plan's prerequisites")
      }
    }

    if goal.kind == .language {
      PlanActivitiesSection(editor: editor, plan: plan)
    }

    if let written = plan.writtenPractice {
      PlanWrittenPracticeSection(editor: editor, written: written)
    }

    if plan.steering.lessonsStudied > 0 {
      PlanSteeringSection(editor: editor, steering: plan.steering)
    }

    if !plan.tools.isEmpty {
      PlanToolsSection(editor: editor, goal: goal, tools: plan.tools)
    }

    Section {
      Button {
        router.select(.buddy)
      } label: {
        Text(
          "Something else? Tell \(learner.buddyDisplayName)", tableName: "Plan",
          comment: "Opens the buddy's conversation to change the plan in words")
      }
    } footer: {
      Text(
        "In your own words, like “less on weekends”. You'll see the change before it applies.",
        tableName: "Plan", comment: "Explains changing the plan by talking to the buddy")
    }
  }
}

private struct PlanExamChoiceSection: View {
  let editor: PlanEditor
  let goal: LearnerGoal
  let choice: GoalPlan.ExamChoice

  var body: some View {
    Section {
      Picker(
        selection: Binding(
          get: { choice.subject ?? "" },
          set: { subject in
            guard !subject.isEmpty, subject != choice.subject else {
              return
            }

            Task { await choose(subject) }
          })
      ) {
        if choice.subject == nil {
          Text("Choose", tableName: "Plan", comment: "An exam choice not made yet").tag("")
        }

        ForEach(choice.options, id: \.self) { option in
          Text(option.name).tag(option.name)
        }
      } label: {
        Text(choice.group)
      }
    } header: {
      Text(
        "\(choice.group): which one will you take?", tableName: "Plan",
        comment:
          "Asks which option of an exam's choice, like its foreign language, the learner takes")
    } footer: {
      if choice.subject == nil {
        Text(
          "Until you pick, your plan leaves \(choice.group) out.", tableName: "Plan",
          comment: "Says the plan leaves an exam's choice out until the learner picks")
      }
    }
  }

  private func choose(_ subject: String) async {
    let goalId = goal.id
    let group = choice.group

    await editor.apply(
      sentence: String(
        localized: "Your plan studies \(subject) for \(group).", table: "Plan",
        comment: "Says which option the plan studies for an exam's choice")
    ) { api, token in
      try await api.chooseExamOption(token: token, goalId: goalId, group: group, subject: subject)
    }
  }
}

/// Only when the learner's time doesn't cover everything in depth.
private struct PlanFocusSection: View {
  @Environment(AppRouter.self) private var router
  @State private var picked: Set<String>?

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    let choices = plan.areas.filter { !$0.skipped && $0.partOf == nil }
    let canChoose =
      plan.feasibility?.deadline != nil && !(plan.feasibility?.fits ?? true) && choices.count > 1

    if canChoose {
      let focused = Set(choices.filter(\.focused).map(\.name))
      let selection = picked ?? focused

      Section {
        Button {
          router.open(.focusTest(goalId: goal.id))
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            Text("Take a short test", tableName: "Plan", comment: "Opens the focus test")
            Text(
              "Your answers choose for you", tableName: "Plan", comment: "What the focus test does"
            )
            .font(.subheadline)
            .foregroundStyle(.secondary)
          }
        }

        ForEach(choices) { area in
          Toggle(
            area.name,
            isOn: Binding(
              get: { selection.contains(area.name) },
              set: { on in
                var next = selection
                if on { next.insert(area.name) } else { next.remove(area.name) }
                picked = next
              }))
        }

        Button {
          Task { await focus(on: selection, choices: choices) }
        } label: {
          Text("Focus on these", tableName: "Plan", comment: "Saves the subjects to focus on")
        }
        .disabled(selection.isEmpty || selection == focused)
      } header: {
        Text("Where to focus", tableName: "Plan", comment: "Section of the subjects to focus on")
      } footer: {
        Text(
          "The subjects you pick come first and get more depth.", tableName: "Plan",
          comment: "What focusing on subjects does")
      }
      .tint(.success)
    }
  }

  private func focus(on selection: Set<String>, choices: [GoalPlan.Area]) async {
    let areas = choices.map(\.name).filter { selection.contains($0) }
    let names = areas.formatted(.list(type: .and))

    await editor.change(
      [.focusAreas(areas)],
      sentence: String(
        localized: "More time for \(names).", table: "Plan",
        comment: "Says the plan gives more time to these subjects"))
    picked = nil
  }
}

private struct PlanActivitiesSection: View {
  let editor: PlanEditor
  let plan: GoalPlan

  var body: some View {
    let skipped = Set(plan.steering.skippedActivities)

    Section {
      ForEach(Self.activities, id: \.self) { activity in
        Toggle(
          isOn: Binding(
            get: { !skipped.contains(activity) },
            set: { on in
              // A plan practices at least one activity.
              guard on || skipped.count < Self.activities.count - 1 else {
                return
              }

              Task {
                await editor.change(
                  [on ? .restoreActivities([activity]) : .skipActivities([activity])],
                  sentence: on
                    ? String(
                      localized: "\(name(activity)) back in your lessons.", table: "Plan",
                      comment: "Says a practice activity is back in the lessons")
                    : String(
                      localized: "\(name(activity)) left out of your lessons.", table: "Plan",
                      comment: "Says a practice activity left the lessons"))
              }
            })
        ) {
          Text(name(activity))
        }
      }
    } header: {
      Text(
        "What you practice", tableName: "Plan", comment: "Section of a language plan's activities")
    }
    .tint(.success)
  }

  private func name(_ activity: String) -> String {
    switch activity {
    case "vocabulary": String(localized: "New words", table: "Plan", comment: "Practice activity")
    case "listening": String(localized: "Listening", table: "Plan", comment: "Practice activity")
    case "writing": String(localized: "Writing", table: "Plan", comment: "Practice activity")
    default: String(localized: "Speaking", table: "Plan", comment: "Practice activity")
    }
  }

  private static let activities = ["vocabulary", "listening", "writing", "speaking"]
}

private struct PlanWrittenPracticeSection: View {
  let editor: PlanEditor
  let written: GoalPlan.WrittenPractice

  var body: some View {
    Section {
      Picker(
        selection: Binding(
          get: { written.cadence },
          set: { cadence in
            guard cadence != written.cadence else {
              return
            }

            Task { await editor.change([.writtenCadence(cadence)], sentence: sentence(cadence)) }
          })
      ) {
        Text("Every week", tableName: "Plan", comment: "Written practice cadence").tag("weekly")
        Text("Every other week", tableName: "Plan", comment: "Written practice cadence")
          .tag("biweekly")
        Text("Only the final weeks", tableName: "Plan", comment: "Written practice cadence")
          .tag("finalWeeks")
      } label: {
        Text(
          "When to practice \(written.parts.formatted(.list(type: .and)))", tableName: "Plan",
          comment: "Setting: when the exam's written parts are practiced")
      }
    } footer: {
      Text(footer)
    }
  }

  private var footer: String {
    switch written.cadence {
    case "biweekly":
      String(
        localized: "The same practice in alternate weeks: less spread out, more at a time.",
        table: "Plan", comment: "What practicing every other week does")
    case "finalWeeks":
      String(
        localized: "Less spaced practice, concentrated in the final weeks before the exam.",
        table: "Plan", comment: "What practicing in the final weeks does")
    default:
      String(
        localized: "Recommended: a little every week, which improves writing the most.",
        table: "Plan", comment: "What practicing every week does")
    }
  }

  private func sentence(_ cadence: String) -> String {
    switch cadence {
    case "biweekly":
      String(
        localized: "Writing practice every other week from now on.", table: "Plan",
        comment: "Says the written practice cadence changed")
    case "finalWeeks":
      String(
        localized: "Writing practice only in the final weeks from now on.", table: "Plan",
        comment: "Says the written practice cadence changed")
    default:
      String(
        localized: "Writing practice every week from now on.", table: "Plan",
        comment: "Says the written practice cadence changed")
    }
  }
}

/// Once the learner studied a lesson of the plan. Tapping an active one again goes back to the
/// default.
private struct PlanSteeringSection: View {
  let editor: PlanEditor
  let steering: GoalPlan.Steering

  var body: some View {
    Section {
      steer(
        Text("Too easy", tableName: "Plan", comment: "Steering: make the lessons harder"),
        active: steering.difficultyBias == "harder", on: .difficultyBias("harder"),
        off: .difficultyBias("standard"))
      steer(
        Text("Too hard", tableName: "Plan", comment: "Steering: make the lessons easier"),
        active: steering.difficultyBias == "easier", on: .difficultyBias("easier"),
        off: .difficultyBias("standard"))
      steer(
        Text("More practice", tableName: "Plan", comment: "Steering: more practice"),
        active: steering.practiceBias == "morePractice", on: .practiceBias("morePractice"),
        off: .practiceBias("balanced"))
      steer(
        Text("More explanation", tableName: "Plan", comment: "Steering: more explanation"),
        active: steering.practiceBias == "moreExplanation", on: .practiceBias("moreExplanation"),
        off: .practiceBias("balanced"))
    } header: {
      Text("How is it going?", tableName: "Plan", comment: "Section of the lessons' steering")
    } footer: {
      if steering.difficultyBias != "standard" {
        Text(difficultySentence(steering.difficultyBias))
      }
    }
    .tint(.success)
  }

  private func steer(_ label: Text, active: Bool, on: PlanEdit, off: PlanEdit) -> some View {
    Toggle(
      isOn: Binding(
        get: { active },
        set: { isOn in
          let edit = isOn ? on : off
          Task { await editor.change([edit], sentence: sentence(edit)) }
        })
    ) {
      label
    }
  }

  private func sentence(_ edit: PlanEdit) -> String {
    switch edit {
    case .difficultyBias(let bias):
      difficultySentence(bias)
    case .practiceBias("morePractice"):
      String(
        localized: "More practice from now on.", table: "Plan", comment: "Says the steering changed"
      )
    case .practiceBias("moreExplanation"):
      String(
        localized: "More explanation from now on.", table: "Plan",
        comment: "Says the steering changed")
    default:
      String(
        localized: "Lessons balance practice and explanation from now on.", table: "Plan",
        comment: "Says the steering went back to the default")
    }
  }

  private func difficultySentence(_ bias: String) -> String {
    switch bias {
    case "harder":
      String(
        localized:
          "Harder from now on: tougher practice, and the basics you already do well are skipped.",
        table: "Plan", comment: "What harder lessons do")
    case "easier":
      String(
        localized: "Easier material from now on.", table: "Plan", comment: "What easier lessons do")
    default:
      String(
        localized: "Lessons at the usual difficulty from now on.", table: "Plan",
        comment: "Says the difficulty went back to the default")
    }
  }
}

/// Tools only later phases use are listed under "More later" instead of asked now.
private struct PlanToolsSection: View {
  @State private var choosing: GoalPlan.Tool?

  let editor: PlanEditor
  let goal: LearnerGoal
  let tools: [GoalPlan.Tool]

  var body: some View {
    let now = tools.filter { !$0.later }
    let later = tools.filter(\.later)

    Section {
      ForEach(now) { tool in
        Button {
          choosing = tool
        } label: {
          LabeledContent {
            Text(answer(tool))
          } label: {
            Text(tool.name).foregroundStyle(.primary)
          }
        }
        .accessibilityHint(
          tool.choice == nil
            ? Text(
              "Choose how you'll use \(tool.name)", tableName: "Plan", comment: "Hint on a tool row"
            )
            : Text(
              "Change how you'll use \(tool.name)", tableName: "Plan", comment: "Hint on a tool row"
            ))
      }
    } header: {
      Text("You'll use", tableName: "Plan", comment: "Section of the plan's tools")
    } footer: {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "No tools? You can do it all with examples.", tableName: "Plan",
          comment: "Says every tool is optional")

        if !later.isEmpty {
          Text(
            "More later: \(later.map(\.name).formatted(.list(type: .and)))", tableName: "Plan",
            comment: "Tools only later phases use")
        }
      }
    }
    .sheet(item: $choosing) { tool in
      PlanToolChoiceSheet(editor: editor, goal: goal, tool: tool)
    }
  }

  private func answer(_ tool: GoalPlan.Tool) -> String {
    switch tool.choice {
    case "have":
      String(
        localized: "You have it", table: "Plan",
        comment: "Status of a tool the course uses, like a program, that the learner already has")
    case "setup":
      tool.system.map {
        String(
          localized: "Setup lesson for \(planSystemName($0))", table: "Plan",
          comment: "A setup lesson comes first for this device")
      }
        ?? String(
          localized: "Setup lesson first", table: "Plan", comment: "A setup lesson comes first")
    case "none":
      String(localized: "Examples only", table: "Plan", comment: "A tool learned with examples")
    default:
      tool.essential
        ? String(localized: "Needed to practice", table: "Plan", comment: "An essential tool")
        : String(localized: "Optional", table: "Plan", comment: "An optional tool")
    }
  }
}

private struct PlanToolChoiceSheet: View {
  @Environment(\.dismiss) private var dismiss
  @State private var choice: ToolChoice
  @State private var system: String

  let editor: PlanEditor
  let goal: LearnerGoal
  let tool: GoalPlan.Tool

  init(editor: PlanEditor, goal: LearnerGoal, tool: GoalPlan.Tool) {
    self.editor = editor
    self.goal = goal
    self.tool = tool
    _choice = State(initialValue: tool.choice.flatMap(ToolChoice.init(rawValue:)) ?? .have)
    _system = State(initialValue: tool.system ?? "macos")
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker(selection: $choice) {
            option(
              Text("I have it", tableName: "Plan", comment: "Tool choice"),
              Text(
                "You'll practice on your own device.", tableName: "Plan",
                comment: "Tool choice detail")
            ).tag(ToolChoice.have)
            option(
              Text("I'll set it up", tableName: "Plan", comment: "Tool choice"),
              Text(
                "A short lesson shows how, right before you need it.", tableName: "Plan",
                comment: "Tool choice detail")
            ).tag(ToolChoice.setup)
            option(
              Text("No install", tableName: "Plan", comment: "Tool choice"),
              Text(
                "Learn with examples. You won't practice on your own computer.", tableName: "Plan",
                comment: "Tool choice detail")
            ).tag(ToolChoice.none)
          } label: {
            Text(tool.name)
          }
          .pickerStyle(.inline)
        }

        if choice == .setup {
          Section {
            Picker(selection: $system) {
              ForEach(["windows", "macos", "linux", "chromebook", "phone"], id: \.self) { system in
                Text(planSystemName(system)).tag(system)
              }
            } label: {
              Text("Your device", tableName: "Plan", comment: "The device a setup lesson is for")
            }
          }
        }
      }
      .navigationTitle(
        Text("How will you use it?", tableName: "Plan", comment: "Title of the tool choice")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .cancel) {
            dismiss()
          } label: {
            Text("Cancel", tableName: "Plan", comment: "Cancels a change")
          }
        }

        ToolbarItem(placement: .confirmationAction) {
          Button(role: .confirm) {
            Task {
              await save()
              dismiss()
            }
          } label: {
            Text("Save", tableName: "Plan", comment: "Saves the tool choice")
          }
          .disabled(editor.isSaving)
        }
      }
    }
    .presentationDetents([.medium, .large])
  }

  private func option(_ title: Text, _ detail: Text) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      title
      detail
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
  }

  private func save() async {
    let goalId = goal.id
    let tools = [tool.name]
    let choice = choice
    let system = choice == .setup ? system : nil
    let names = tool.name

    let sentence =
      switch choice {
      case .setup:
        String(
          localized:
            "A lesson to set up \(names) on \(planSystemName(system ?? "")) comes before you need it.",
          table: "Plan", comment: "Says a setup lesson comes first")
      case .have:
        String(
          localized: "You have \(names), so there's nothing to set up.", table: "Plan",
          comment: "Says the learner has the tool")
      case .none:
        String(
          localized: "No install for \(names): you'll learn with examples.", table: "Plan",
          comment: "Says the tool is learned with examples")
      }

    await editor.apply(sentence: sentence) { api, token in
      try await api.chooseTools(
        token: token, goalId: goalId, tools: tools, choice: choice, system: system)
    }
  }
}

func planSystemName(_ system: String) -> String {
  switch system {
  case "windows": String(localized: "Windows", table: "Plan", comment: "A device's system")
  case "macos": String(localized: "macOS", table: "Plan", comment: "A device's system")
  case "linux": String(localized: "Linux", table: "Plan", comment: "A device's system")
  case "chromebook": String(localized: "Chromebook", table: "Plan", comment: "A device's system")
  default: String(localized: "Phone only", table: "Plan", comment: "A device's system")
  }
}
