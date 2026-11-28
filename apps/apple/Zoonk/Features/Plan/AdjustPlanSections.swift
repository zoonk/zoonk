import SwiftUI

/// Holds only what adjusts the plan: how lessons feel is said to the buddy, who proposes the change.
struct AdjustPlanSections: View {
  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    ForEach(plan.examChoices) { choice in
      PlanExamChoiceSection(editor: editor, choice: choice)
        .id(AdjustPlanSheet.Section.choice(choice.group))
    }

    PlanFocusSection(editor: editor, goal: goal, plan: plan)
      .id(AdjustPlanSheet.Section.focus)

    if let bases = plan.bases, !bases.items.isEmpty {
      Section {
        NavigationLink {
          PlanBasesView(editor: editor, goal: goal, plan: plan, bases: bases)
        } label: {
          Text(planBasesSummary(bases))
        }
      } header: {
        SectionTitle(
          Text("Prerequisites", tableName: "Plan", comment: "Section of the plan's prerequisites"))
      }
    }

    if goal.kind == .language {
      PlanActivitiesSection(editor: editor, plan: plan)
        .id(AdjustPlanSheet.Section.practice)
    }

    if let written = plan.writtenPractice {
      PlanWrittenPracticeSection(editor: editor, written: written)
    }

    if !plan.tools.isEmpty {
      PlanToolsSection(editor: editor, goal: goal, tools: plan.tools)
    }
  }
}

private struct PlanExamChoiceSection: View {
  let editor: PlanEditor
  let choice: GoalPlan.ExamChoice

  @State private var draft: [String]?

  var body: some View {
    if choice.take > 1 {
      several
    } else {
      one
    }
  }

  private var one: some View {
    Section {
      Picker(
        selection: Binding(
          get: { choice.subjects.first ?? "" },
          set: { subject in
            guard !subject.isEmpty, subject != choice.subjects.first else {
              return
            }

            editor.run { await editor.chooseExamOptions([subject], in: choice.group) }
          })
      ) {
        if choice.subjects.isEmpty {
          Text("Choose", tableName: "Plan", comment: "An exam choice not made yet").tag("")
        }

        ForEach(choice.options, id: \.self) { option in
          Text(option.shortName ?? option.name).tag(option.name)
        }
      } label: {
        Text(choice.group)
      }
    } header: {
      SectionTitle(Text.examChoiceQuestion(group: choice.group, take: choice.take))
    }
  }

  private var several: some View {
    let picked = draft ?? choice.subjects
    let picks = ExamOptionPicks(
      options: choice.options.map(\.name), take: choice.take, names: picked)

    return Section {
      // Main's quiet line over the options, not a second header line.
      ExamPickLimit(take: choice.take)
        .listRowSeparator(.hidden)
        .layoutSectionText()

      ExamOptionChecks(
        options: choice.options, take: choice.take,
        picked: Binding(get: { picked }, set: { draft = $0 }))

      Button {
        editor.run {
          if await editor.chooseExamOptions(picks.names, in: choice.group) {
            draft = nil
          }
        }
      } label: {
        Text("Save", tableName: "Plan", comment: "Saves the options picked for an exam's choice")
      }
      .disabled(!picks.canSave(over: choice.subjects))
    } header: {
      SectionTitle(Text.examChoiceQuestion(group: choice.group, take: choice.take))
    }
    .onChange(of: choice.subjects) { draft = nil }
  }
}

/// Only when the learner's time doesn't cover everything in depth.
private struct PlanFocusSection: View {
  @Environment(\.dismiss) private var dismiss
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

      // Main's two groups: the Focus test's marked row and the subjects don't share a label edge.
      if let focusTest = plan.focusTest {
        Section {
          Button {
            dismiss()
            router.open(.focusTest(goalId: goal.id))
          } label: {
            ListRow(
              Text(FocusTestCopy.name),
              descriptionFacts: FocusTestCopy.planLine(focusTest)
            ) {
              Image(systemName: "scope")
            }
            .disclosureChevron()
          }
        } header: {
          title
        }

        Section {
          Text(
            "Or choose them yourself", tableName: "Plan",
            comment: "Above the subjects to focus on, under the Focus test that suggests them"
          )
          .typeStyle(.note.weight(.medium))
          .foregroundStyle(.mutedForeground)
          .listRowSeparator(.hidden, edges: .bottom)
          .layoutSectionText()

          picks(choices, focused: focused, selection: selection)
        } footer: {
          footer
        }
      } else {
        Section {
          picks(choices, focused: focused, selection: selection)
        } header: {
          title
        } footer: {
          footer
        }
      }
    }
  }

  private var title: some View {
    SectionTitle(
      Text("Where to focus", tableName: "Plan", comment: "Section of the subjects to focus on"))
  }

  private var footer: some View {
    SectionFooter {
      Text(
        "The subjects you pick get more of your time.", tableName: "Plan",
        comment: "What focusing on subjects does")
    }
  }

  @ViewBuilder
  private func picks(_ choices: [GoalPlan.Area], focused: Set<String>, selection: Set<String>)
    -> some View
  {
    ForEach(choices) { area in
      let isPicked = selection.contains(area.name)

      ChoiceRow(picks: .several, isPicked: isPicked) {
        var next = selection
        if isPicked { next.remove(area.name) } else { next.insert(area.name) }
        picked = next
        editor.forgetUnchanged()
      } words: {
        areaWords(area, isPicked: isPicked)
      }
    }

    let areas = choices.map(\.name).filter { selection.contains($0) }

    Button {
      editor.run { await focus(on: areas) }
    } label: {
      if selection.isEmpty, !focused.isEmpty {
        Text(
          "Remove focus", tableName: "Plan",
          comment: "Saves no subject to focus on, so the plan has no focus")
      } else {
        Text("Save", tableName: "Plan", comment: "Saves the subjects to focus on")
      }
    }
    .disabled(selection == focused || editor.changedNothing([.focusAreas(areas)]))
  }

  /// What the area holds, and once it's picked, the part of it the learner named.
  private func areaWords(_ area: GoalPlan.Area, isPicked: Bool) -> ChoiceWords {
    let parts = plan.areas.filter { !$0.skipped && $0.partOf == area.name }.map(\.name)

    return ChoiceWords(
      title: Text(verbatim: area.name),
      detail: parts.isEmpty
        ? nil : Text("Includes \(parts.formatted(.list(type: .and)))", tableName: "Plan"),
      note: isPicked ? area.focusPart.map { Text("Only \($0)", tableName: "Plan") } : nil)
  }

  /// A pick that changed nothing stays, with main's words for why at the editor's foot.
  private func focus(on areas: [String]) async {
    let saved = await editor.change(
      [.focusAreas(areas)],
      unchanged: areas.isEmpty ? nil : { Self.unchangedSentence($0, areas: areas) })

    if saved {
      picked = nil
    }
  }

  private static func unchangedSentence(_ reason: UnchangedReason, areas: [String]) -> String {
    let names = areas.formatted(.list(type: .and))

    return switch reason {
    case .alreadyIn:
      String(
        localized: "Nothing changed. All \(names) lessons are already in your plan.", table: "Plan")
    case .cantMove:
      String(
        localized: "Nothing changed. To fit more of \(names), study longer each day.", table: "Plan"
      )
    }
  }
}

private struct PlanActivitiesSection: View {
  let editor: PlanEditor
  let plan: GoalPlan

  var body: some View {
    let skipped = Set(plan.steering.skippedActivities)

    Section {
      FlowLayout(spacing: 8) {
        ForEach(planActivities, id: \.self) { activity in
          let isOn = !skipped.contains(activity)

          ToggleChip(Text(planActivityName(activity)), isOn: isOn) {
            editor.run {
              await editor.change([
                isOn ? .skipActivities([activity]) : .restoreActivities([activity])
              ])
            }
          }
        }
      }
    } header: {
      SectionTitle(
        Text(
          "What you practice", tableName: "Plan", comment: "Section of a language plan's activities"
        ))
    }
  }
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

            editor.run {
              await editor.change([.writtenCadence(cadence)], sentence: sentence(cadence))
            }
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
      SectionFooter {
        Text(footer)
      }
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
      SectionTitle(Text("You'll use", tableName: "Plan", comment: "Section of the plan's tools"))
    } footer: {
      SectionFooter {
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
    }
    .sheet(item: $choosing) { tool in
      PlanToolChoiceSheet(editor: editor, goal: goal, tool: tool)
        .zoonkSheet()
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
  @State private var isWriting = false
  @State private var saving = VisitRequest<Bool>()

  private var failed: Bool { saving.outcome == true }

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
      ZoonkList {
        if isWriting {
          WritingWait(
            title: Text(
              "Adding a setup lesson", tableName: "Plan",
              comment: "A tool's setup lesson is being written"),
            hint: Text(
              "Your plan updates as soon as it's ready.", tableName: "Plan",
              comment: "The plan takes the setup lesson by itself once it's written"))
        } else {
          choices

          if failed {
            FailureLine(
              message: LocalizedStringResource(
                "That didn't save. Try again.", table: "Plan",
                comment: "The tool choice didn't save; Save tries again"))
          }
        }
      }
      .navigationTitle(
        Text("Do you have it?", tableName: "Plan")
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
          BusyButton(isBusy: editor.isSaving, role: .confirm, icon: .check) {
            saving.run {
              // Saved even when the sheet closed first; then there's nothing left to close.
              let saved = await save()
              guard !Task.isCancelled else { return nil }
              if saved { dismiss() }
              return !saved
            }
          } label: {
            Text("Save", tableName: "Plan", comment: "Saves the tool choice")
          }
        }
      }
    }
    .presentationDetents([.medium, .large])
    .onDisappear { saving.leave() }
  }

  @ViewBuilder
  private var choices: some View {
    Section {
      option(
        .have, Text("I have it", tableName: "Plan"),
        Text("You'll practice on your own device.", tableName: "Plan"))
      option(
        .setup, Text("I'll set it up", tableName: "Plan"),
        Text("A short lesson shows how, right before you need it.", tableName: "Plan"))
      option(
        .none, Text("I won't use it", tableName: "Plan"),
        Text("You'll practice with examples instead.", tableName: "Plan"))
    }

    if choice == .setup {
      Section {
        FlowLayout(spacing: 8) {
          ForEach(["windows", "macos", "linux", "chromebook", "phone"], id: \.self) { system in
            ToggleChip(Text(planSystemName(system)), isOn: self.system == system) {
              self.system = system
            }
          }
        }
      } header: {
        SectionTitle(
          Text("Your device", tableName: "Plan", comment: "The device a setup lesson is for"))
      }
    }
  }

  private func option(_ value: ToolChoice, _ title: Text, _ detail: Text) -> some View {
    ChoiceRow(title, detail: detail, isPicked: choice == value) {
      choice = value
    }
  }

  /// False when it didn't save: the sheet stays with the learner's choice for Save to try again.
  private func save() async -> Bool {
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
        String(localized: "You won't use \(names): you'll learn with examples.", table: "Plan")
      }

    await editor.apply(sentence: sentence) { api, token in
      try await api.chooseTools(
        token: token, goalId: goalId, tools: tools, choice: choice, system: system
      ) {
        isWriting = true
      }
    }

    isWriting = false

    guard editor.failed else {
      return true
    }

    editor.failed = false
    return false
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
