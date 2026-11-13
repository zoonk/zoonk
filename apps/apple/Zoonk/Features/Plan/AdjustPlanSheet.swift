import SwiftUI

/// Each change re-plans from today and saves at once: fewer minutes or a closed day apply right
/// away, this week included.
struct AdjustPlanSheet: View {
  enum Section: Hashable, Identifiable {
    /// One of the exam's choices, by its group.
    case choice(String)
    case date
    case days
    /// Studying everything, which asks as soon as the sheet opens.
    case everything
    case focus
    case time
    case top

    var id: Self { self }
  }

  @State private var editor: PlanEditor
  /// The weekend switch answers at once, while the plan it changed is read again; until it's
  /// touched, it shows whether the plan's weekend has its own time.
  @State private var weekendChoice: Bool?
  @State private var aimEnds: [String: String] = [:]

  let goal: LearnerGoal
  let plan: GoalPlan
  let section: Section

  init(goal: LearnerGoal, plan: GoalPlan, section: Section, store: PlanStore) {
    self.goal = goal
    self.plan = plan
    self.section = section
    _editor = State(
      initialValue: PlanEditor(
        goalId: goal.id, store: store, dateKind: GoalDateKind(isExam: goal.kind == .exam)))
  }

  var body: some View {
    NavigationStack {
      ScrollViewReader { proxy in
        ZoonkList {
          PlanEditorLatestSection(editor: editor, plan: plan, dateKind: dateKind)

          PlanDateSection(
            editor: editor, goal: goal, plan: plan, asksStudyEverything: section == .everything
          )
          .id(Section.date)

          if let languageAim = plan.languageAim, !languageAim.choices.isEmpty {
            aimSection(languageAim)
              .readsAimEnds(
                $aimEnds, aims: languageAim.choices.map(\.aim), key: plan
              ) { [editor] aim in
                await editor.preview([.aim(aim)])?.finishDate
              }
          }

          PlanTimeSection(editor: editor, goal: goal, plan: plan, weekendOn: weekendOn)
            .id(Section.time)

          daysSection
            .id(Section.days)

          if plan.schedule.shape.canDiffer {
            weekendSection
          }

          if goal.kind == .exam, plan.feasibility?.deadline != nil {
            PlanFullCourseSection(editor: editor, plan: plan, asks: section == .everything)
              .id(Section.everything)
          }

          AdjustPlanSections(editor: editor, goal: goal, plan: plan)
        }
        .disabled(editor.isSaving)
        .announcesStatus(
          PlanEditorLatestSection.announcement(of: editor.latest, plan: plan, dateKind: dateKind)
        )
        .onAppear {
          if section == .everything {
            // An exam studies everything after it from its time; any other goal drops its date.
            proxy.scrollTo(goal.kind == .exam ? Section.everything : Section.date, anchor: .top)
          } else if section != .top {
            proxy.scrollTo(section, anchor: .top)
          }
        }
      }
      .navigationTitle(
        Text("Adjust your plan", tableName: "Plan", comment: "Navigation title of the plan editor")
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

  /// Main's `PlanAim`: how far a language course goes, applied with the editor's summary and Undo.
  private func aimSection(_ languageAim: LanguageAimView) -> some View {
    SwiftUI.Section {
      ForEach(languageAim.choices, id: \.aim) { choice in
        aimRow(choice, isPicked: choice.aim == languageAim.aim)
      }
    } header: {
      SectionTitle(
        Text(
          "Your aim", tableName: "Plan",
          comment:
            "The language level a course goes up to, like B1. Not the learner's goal: the level they aim for."
        ))
    }
  }

  private func aimRow(_ choice: LanguageAimView.Choice, isPicked: Bool) -> some View {
    let detail = aimChoiceDetail(end: aimEnds[choice.aim])

    return Button {
      guard !isPicked else {
        return
      }

      Task { await editor.change([.aim(choice.aim)]) }
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        AimName(aim: choice.aim)
          .typeStyle(.rowTitle)
          .foregroundStyle(Color(.foreground))

        if let detail {
          Text(detail)
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(.rect)
    }
    .pickedRow(isPicked)
    .accessibilityAddTraits(isPicked ? .isSelected : [])
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
              let minutes = on ? plan.schedule.shape.minutes(for: weekday) : 0

              Task { await editor.change([.weekdayMinutes(minutes, weekdays: [weekday])]) }
            })
        )
        // A plan needs at least one study day.
        .disabled(studies && studyCount == 1)
      }
    } header: {
      SectionTitle(
        Text("Study days", tableName: "Plan", comment: "Setting: the days of the week to study"))
    }
    .tint(.success)
  }

  private var weekendOn: Bool {
    weekendChoice ?? (plan.schedule.shape.weekend != nil)
  }

  /// Only for a week studied on weekdays and on the weekend.
  private var weekendSection: some View {
    let shape = plan.schedule.shape
    let current = shape.weekend ?? shape.weekdays

    return SwiftUI.Section {
      Toggle(
        isOn: Binding(
          get: { weekendOn },
          set: { on in
            weekendChoice = on

            if !on, shape.weekend != nil {
              Task { await setWeekend(shape.weekdays) }
            }
          })
      ) {
        Text(
          "Different time on weekends", tableName: "Plan",
          comment: "Setting: Saturday and Sunday get their own study time")
      }

      if weekendOn {
        Picker(
          selection: Binding(
            get: { current },
            set: { minutes in
              guard minutes != current else {
                return
              }

              Task { await setWeekend(minutes) }
            })
        ) {
          ForEach(ScheduleTime.dailyTimes(plan.schedule.dailyTimes, with: current), id: \.self) {
            minutes in
            Text(planDurationText(minutes: Double(minutes)))
              .tag(minutes)
          }
        } label: {
          Text(
            "Time on weekends", tableName: "Plan",
            comment: "Setting: study time on Saturday and Sunday")
        }
      }
    }
    .tint(.success)
  }

  private func setWeekend(_ minutes: Int) async {
    await editor.change([.weekdayMinutes(minutes, weekdays: plan.schedule.shape.weekendDays)])
  }

  private var dateKind: GoalDateKind { GoalDateKind(isExam: goal.kind == .exam) }

  private static let mondayFirst = [1, 2, 3, 4, 5, 6, 0]
}

/// Main's editor note: what the change did, its consequence and "See all changes", how it applies,
/// and Undo while the change is the plan's latest.
struct PlanEditorLatestSection: View {
  let editor: PlanEditor
  let plan: GoalPlan
  let dateKind: GoalDateKind

  var body: some View {
    if let latest = editor.latest {
      Section {
        if case .applied(let change, let sentence) = latest {
          VStack(alignment: .leading, spacing: 6) {
            Text(sentence)
              .typeStyle(.body.weight(.semibold))

            PlanEffectDiff(
              effect: change.effect, today: plan.today,
              options: PlanChangeOptions(
                byDate: plan.schedule.targetDate != nil, dateKind: dateKind))

            Text(PlanChangeWords.appliedLine(todaySession: change.todaySession))
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }

          if change.canUndo {
            Button {
              Task { await editor.undo() }
            } label: {
              Text("Undo", tableName: "Plan", comment: "Undoes the latest plan change")
            }
          }
        } else if let line = Self.line(of: latest) {
          Text(line)
        }
      }
    }
  }

  static func announcement(of latest: PlanEditor.Latest?, plan: GoalPlan, dateKind: GoalDateKind)
    -> String?
  {
    guard case .applied(let change, let sentence) = latest else {
      return latest.flatMap(line)
    }

    let consequence = PlanChangeEffect.consequence(
      change.effect,
      PlanChangeOptions(byDate: plan.schedule.targetDate != nil, dateKind: dateKind),
      today: plan.today)

    return [
      sentence, consequence?.text, PlanChangeWords.appliedLine(todaySession: change.todaySession),
    ]
    .compactMap(\.self).joinedSentences()
  }

  private static func line(of latest: PlanEditor.Latest) -> String? {
    switch latest {
    case .undone:
      String(
        localized: "Undone. Your plan is back as it was.", table: "Plan",
        comment: "Says the latest plan change was undone")
    case .unchanged:
      String(
        localized: "Your plan already works that way.", table: "Plan",
        comment: "Says a change wasn't needed")
    case .invalid:
      String(
        localized: "That change doesn't fit your plan.", table: "Plan",
        comment: "Says the API refused a plan change")
    case .applied:
      nil
    }
  }
}
