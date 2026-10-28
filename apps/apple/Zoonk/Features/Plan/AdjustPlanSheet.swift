import SwiftUI

/// "Adjust your plan": everything that reshapes it, as main's editor. The goal's date, the time a
/// day (with what it covers, the time that covers everything when the learner asks, and moving the
/// date), the study days, an exam's choices, where to focus, the prerequisites, what a language plan
/// practices, when written tests are practiced, how the lessons feel, and the tools it uses. Each
/// change re-plans from today and saves at once: fewer minutes or a closed day apply right away,
/// this week included, and the top of the sheet says what the latest change did (its new end,
/// whether today's session follows it) with Undo while it's the plan's latest change. Opened at a
/// setting the Plan lists, it scrolls there.
struct AdjustPlanSheet: View {
  enum Section: Hashable, Identifiable {
    case date
    case days
    case time
    case top

    var id: Self { self }
  }

  @State private var editor: PlanEditor

  let goal: LearnerGoal
  let plan: GoalPlan
  let section: Section

  init(goal: LearnerGoal, plan: GoalPlan, section: Section, store: PlanStore) {
    self.goal = goal
    self.plan = plan
    self.section = section
    _editor = State(initialValue: PlanEditor(goalId: goal.id, store: store))
  }

  var body: some View {
    NavigationStack {
      ScrollViewReader { proxy in
        Form {
          PlanEditorLatestSection(editor: editor, plan: plan)

          dateSection
            .id(Section.date)

          PlanTimeSection(editor: editor, goal: goal, plan: plan)
            .id(Section.time)

          daysSection
            .id(Section.days)

          AdjustPlanSections(editor: editor, goal: goal, plan: plan)
        }
        .disabled(editor.isSaving)
        .onAppear {
          if section != .top {
            proxy.scrollTo(section, anchor: .top)
          }
        }
      }
      .navigationTitle(
        Text("Adjust your plan", tableName: "Plan", comment: "Title of the plan editor")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          PlanSheetDoneButton()
        }

        if editor.isSaving {
          ToolbarItem(placement: .status) {
            ProgressView()
          }
        }
      }
      .alert(
        Text("Couldn't save", tableName: "Plan", comment: "Title of an error saving the plan"),
        isPresented: $editor.failed
      ) {
      } message: {
        Text(
          "Check your connection and try again.", tableName: "Plan",
          comment: "Explains a failed save")
      }
    }
    .presentationDetents([.medium, .large])
  }

  // MARK: Sections

  private var dateSection: some View {
    SwiftUI.Section {
      if let targetDate = plan.schedule.targetDate, let date = PlanDate.date(targetDate) {
        DatePicker(
          selection: Binding(
            get: { date },
            set: { picked in
              let isoDate = PlanDate.isoDate(picked)

              guard isoDate != targetDate else {
                return
              }

              Task {
                await editor.change(
                  [.targetDate(isoDate)],
                  sentence: String(
                    localized:
                      "Date moved to \(picked.formatted(Date.FormatStyle(date: .long, time: .omitted, timeZone: .gmt))).",
                    table: "Plan", comment: "Says the goal's date moved"))
              }
            }),
          in: (PlanDate.date(plan.today) ?? .now)...,
          displayedComponents: .date
        ) {
          dateLabel
        }
        .environment(\.timeZone, .gmt)
      } else {
        LabeledContent {
          goal.kind == .exam
            ? Text("To be confirmed", tableName: "Plan", comment: "An exam's date not known yet")
            : Text("No date", tableName: "Plan", comment: "A goal without a date")
        } label: {
          dateLabel
        }
      }
    }
  }

  private var dateLabel: Text {
    goal.kind == .exam
      ? Text("Exam date", tableName: "Plan", comment: "Setting: the exam's date")
      : Text("Goal date", tableName: "Plan", comment: "Setting: the goal's date")
  }

  private var daysSection: some View {
    let weekdayMinutes = plan.schedule.weekdayMinutes
    let studyCount = weekdayMinutes.filter { $0 > 0 }.count
    let symbols = Calendar.current.weekdaySymbols

    return SwiftUI.Section {
      ForEach(Self.mondayFirst, id: \.self) { weekday in
        let studies = weekdayMinutes.indices.contains(weekday) && weekdayMinutes[weekday] > 0

        Toggle(
          symbols[weekday],
          isOn: Binding(
            get: { studies },
            set: { on in
              let minutes = on ? plan.schedule.dailyMinutes : 0

              Task {
                await editor.change(
                  [.weekdayMinutes(minutes, weekdays: [weekday])],
                  sentence: on
                    ? String(
                      localized:
                        "\(symbols[weekday]): \(planDurationText(minutes: Double(minutes))) a day.",
                      table: "Plan", comment: "Says a weekday became a study day with its time")
                    : String(
                      localized: "\(symbols[weekday]): rest day.", table: "Plan",
                      comment: "Says a weekday became a rest day"))
              }
            })
        )
        // A plan needs at least one study day.
        .disabled(studies && studyCount == 1)
      }
    } header: {
      Text("Study days", tableName: "Plan", comment: "Setting: the days of the week to study")
    }
    .tint(.success)
  }

  private static let mondayFirst = [1, 2, 3, 4, 5, 6, 0]
}

/// The latest change at the top of an editor: what it did (its sentence, its new end, whether
/// today's session follows it), with Undo while it's the plan's latest; or that it changed nothing.
struct PlanEditorLatestSection: View {
  let editor: PlanEditor
  let plan: GoalPlan

  var body: some View {
    if let latest = editor.latest {
      Section {
        switch latest {
        case .undone:
          Text(
            "Undone. Your plan is back as it was.", tableName: "Plan",
            comment: "Says the latest plan change was undone")
        case .unchanged:
          Text(
            "Your plan already works that way.", tableName: "Plan",
            comment: "Says a change wasn't needed")
        case .invalid:
          Text(
            "That change doesn't fit your plan.", tableName: "Plan",
            comment: "Says the API refused a plan change")
        case .applied(let change, let sentence):
          VStack(alignment: .leading, spacing: 4) {
            Text(sentence)
              .font(.headline)

            if let effect = planEffectText(change.effect, plan: plan) {
              Text(effect)
                .foregroundStyle(.secondary)
            }

            appliedLine(change)
              .foregroundStyle(.secondary)
          }
          .font(.subheadline)

          if change.canUndo {
            Button {
              Task { await editor.undo() }
            } label: {
              Text("Undo", tableName: "Plan", comment: "Undoes the latest plan change")
            }
          }
        }
      }
    }
  }

  /// Whether today's session follows the change or it starts on the next study day.
  private func appliedLine(_ change: AppliedPlanChange) -> Text {
    switch change.todaySession {
    case "changed":
      Text(
        "It's in your plan, and today's session follows it.", tableName: "Plan",
        comment: "Says a change applies to today's session too")
    case "unchanged":
      Text(
        "It's in your plan from your next study day. Today's session stays as it is.",
        tableName: "Plan", comment: "Says a change starts on the next study day")
    default:
      Text("Your plan follows it from now on.", tableName: "Plan", comment: "Says a change applies")
    }
  }
}

/// "Ends Nov 12 instead of Nov 13.": what a change does to the plan's end.
func planEffectText(_ effect: PlanEffect?, plan: GoalPlan) -> String? {
  guard let after = effect?.endDateAfter, let before = effect?.endDateBefore, after != before else {
    return nil
  }

  let afterText = PlanDate.text(after, today: plan.today)
  let beforeText = PlanDate.text(before, today: plan.today)

  return plan.schedule.targetDate == nil || plan.schedule.targetDateEstimated
    ? String(
      localized: "Ends around \(afterText) instead of \(beforeText).", table: "Plan",
      comment: "How a change moves the plan's estimated end")
    : String(
      localized: "Ends \(afterText) instead of \(beforeText).", table: "Plan",
      comment: "How a change moves the plan's end")
}
