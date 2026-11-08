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
        ZoonkList {
          PlanEditorLatestSection(editor: editor, plan: plan)

          PlanDateSection(
            editor: editor, goal: goal, plan: plan, asksStudyEverything: section == .everything
          )
          .id(Section.date)

          if let languageAim = plan.languageAim, !languageAim.choices.isEmpty {
            aimSection(languageAim)
          }

          PlanTimeSection(
            editor: editor, goal: goal, plan: plan, weekendOn: weekendOn,
            asksStudyEverything: section == .everything
          )
          .id(Section.time)

          daysSection
            .id(Section.days)

          if plan.schedule.shape.canDiffer {
            weekendSection
          }

          AdjustPlanSections(editor: editor, goal: goal, plan: plan)
        }
        .disabled(editor.isSaving)
        .announcesStatus(PlanEditorLatestSection.announcement(of: editor.latest, plan: plan))
        .onAppear {
          if section == .everything {
            // An exam studies everything after it from its time; any other goal drops its date.
            proxy.scrollTo(goal.kind == .exam ? Section.time : Section.date, anchor: .top)
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
        Button {
          guard choice.aim != languageAim.aim else {
            return
          }

          Task {
            await editor.change(
              [.aim(choice.aim)],
              sentence: String(
                localized: "Your course now goes up to \(choice.aim).", table: "Plan",
                comment: "Says a language course's aim changed; the argument is a level like B1"))
          }
        } label: {
          VStack(alignment: .leading, spacing: 2) {
            AimName(aim: choice.aim)
              .typeStyle(.rowTitle)
              .foregroundStyle(Color(.foreground))

            Text(aimDetail(choice, languageAim: languageAim))
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .contentShape(.rect)
        }
        .pickedRow(choice.aim == languageAim.aim)
        .accessibilityAddTraits(choice.aim == languageAim.aim ? .isSelected : [])
      }
    } header: {
      VStack(alignment: .leading, spacing: 4) {
        SectionTitle(
          Text(
            "Your aim", tableName: "Plan",
            comment:
              "The language level a course goes up to, like B1. Not the learner's goal: the level they aim for."
          ))

        Text(
          "How far your course goes, which sets how long your plan is.", tableName: "Plan",
          comment: "Under the levels a language course can aim for"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .textCase(nil)
      }
    }
  }

  private func aimDetail(_ choice: LanguageAimView.Choice, languageAim: LanguageAimView) -> String {
    let hours = choice.hours.formatted()

    guard
      let end = languageAim.endDate(
        hours: choice.hours, planEnd: plan.estimate.endDate, today: plan.today)
    else {
      return String(
        localized: "About \(hours) h more", table: "Plan",
        comment: "Under a language level to aim for: the hours of study still needed to reach it")
    }

    return String(
      localized: "About \(hours) h more · around \(PlanDate.longText(end, month: true))",
      table: "Plan",
      comment:
        "Under a language level to aim for: the hours of study still needed to reach it, then when; the second argument is a month and year, like 'Nov 2027'"
    )
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
    await editor.change(
      [.weekdayMinutes(minutes, weekdays: plan.schedule.shape.weekendDays)],
      sentence: String(
        localized: "Weekend time changed to \(planDurationText(minutes: Double(minutes))).",
        table: "Plan", comment: "Says the plan's time on Saturday and Sunday changed"))
  }

  private static let mondayFirst = [1, 2, 3, 4, 5, 6, 0]
}

/// Undo shows only while the change is the plan's latest.
struct PlanEditorLatestSection: View {
  let editor: PlanEditor
  let plan: GoalPlan

  var body: some View {
    if let latest = editor.latest {
      Section {
        if case .applied(let change, let sentence) = latest {
          VStack(alignment: .leading, spacing: 4) {
            Text(sentence)
              .typeStyle(.body.weight(.semibold))

            if let effect = planEffectText(change.effect, plan: plan) {
              Text(effect)
                .foregroundStyle(.mutedForeground)
            }

            Text(Self.appliedLine(change))
              .foregroundStyle(.mutedForeground)
          }
          .typeStyle(.note)

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

  static func announcement(of latest: PlanEditor.Latest?, plan: GoalPlan) -> String? {
    guard case .applied(let change, let sentence) = latest else {
      return latest.flatMap(line)
    }

    return [sentence, planEffectText(change.effect, plan: plan), appliedLine(change)]
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

  private static func appliedLine(_ change: AppliedPlanChange) -> String {
    switch change.todaySession {
    case "changed":
      String(
        localized: "It's in your plan, and today's session follows it.", table: "Plan",
        comment: "Says a change applies to today's session too")
    case "unchanged":
      String(
        localized:
          "It's in your plan from your next study day. Today's session stays as it is.",
        table: "Plan", comment: "Says a change starts on the next study day")
    default:
      String(
        localized: "Your plan follows it from now on.", table: "Plan",
        comment: "Says a change applies")
    }
  }
}

func planEffectText(_ effect: PlanEffect?, plan: GoalPlan) -> String? {
  planEffectText(
    effect, today: plan.today,
    isEstimated: plan.schedule.targetDate == nil || plan.schedule.targetDateEstimated)
}

func planEffectText(_ effect: PlanEffect?, today: String, isEstimated: Bool) -> String? {
  guard let after = effect?.endDateAfter, let before = effect?.endDateBefore, after != before else {
    return nil
  }

  let afterText = PlanDate.text(after, today: today)
  let beforeText = PlanDate.text(before, today: today)

  return isEstimated
    ? String(
      localized: "Ends around \(afterText) instead of \(beforeText).", table: "Plan",
      comment: "How a change moves the plan's estimated end; the arguments are dates like 'May 5'")
    : String(
      localized: "Ends \(afterText) instead of \(beforeText).", table: "Plan",
      comment: "How a change moves the plan's end; the arguments are dates like 'May 5'")
}

/// Mirrors main's `useLessonsEffectText` for a plan with a date: what a change adds and leaves out,
/// naming a few of the lessons it leaves out and the topics not written yet.
func planLessonsEffectText(_ effect: PlanEffect?) -> String? {
  guard let effect else {
    return nil
  }

  let leftOut = effect.lessonsLeftOut ?? []
  let removed = effect.lessonsRemoved
  let someOf = leftOut.count != removed
  let names = leftOut.isEmpty ? nil : someOf ? lessonExamples(leftOut) : lessonList(leftOut)

  let counts = lessonCountsText(
    added: effect.lessonsAdded, about: effect.lessonsAddedEstimated ?? false, removed: removed,
    names: names, someOf: someOf)
  // A lesson swapped within its own topic still needs its name.
  let netted =
    removed == 0 && !leftOut.isEmpty
    ? leftOutText(removed: leftOut.count, names: lessonList(leftOut), someOf: false) : nil
  let unwritten = (effect.unwrittenLeftOut ?? []).map {
    String(
      localized: "\($0.skill) (about \($0.lessons))", table: "Plan",
      comment: "A topic whose lessons aren't written yet, with about how many it has")
  }
  let unwrittenText =
    unwritten.isEmpty
    ? nil
    : String(
      localized: "Lessons not written yet: \(unwritten.formatted(.list(type: .and))).",
      table: "Plan", comment: "Topics a change leaves out before their lessons are written")
  let sentences = [counts, netted, unwrittenText].compactMap(\.self)

  return sentences.isEmpty ? nil : sentences.joinedSentences()
}

private func lessonCountsText(added: Int, about: Bool, removed: Int, names: String?, someOf: Bool)
  -> String?
{
  if added > 0 && removed > 0 {
    switch (names, someOf, about) {
    case (let names?, true, true):
      return String(
        localized: "Adds about \(added) lessons and leaves out \(removed), such as \(names).",
        table: "Plan", comment: "A change's lessons added and left out, naming a few")
    case (let names?, true, false):
      return String(
        localized: "Adds \(added) lessons and leaves out \(removed), such as \(names).",
        table: "Plan", comment: "A change's lessons added and left out, naming a few")
    case (let names?, false, true):
      return String(
        localized: "Adds about \(added) lessons and leaves out \(removed): \(names).",
        table: "Plan", comment: "A change's lessons added and left out, naming them all")
    case (let names?, false, false):
      return String(
        localized: "Adds \(added) lessons and leaves out \(removed): \(names).", table: "Plan",
        comment: "A change's lessons added and left out, naming them all")
    case (nil, _, true):
      return String(
        localized: "Adds about \(added) lessons and leaves out \(removed).", table: "Plan",
        comment: "A change's lessons added and left out")
    case (nil, _, false):
      return String(
        localized: "Adds \(added) lessons and leaves out \(removed).", table: "Plan",
        comment: "A change's lessons added and left out")
    }
  }

  if added > 0 {
    return about
      ? String(
        localized: "Adds about \(added) lessons.", table: "Plan",
        comment: "A change's lessons added, estimated")
      : String(
        localized: "Adds \(added) lessons.", table: "Plan", comment: "A change's lessons added")
  }

  return removed > 0 ? leftOutText(removed: removed, names: names, someOf: someOf) : nil
}

private func leftOutText(removed: Int, names: String?, someOf: Bool) -> String {
  guard let names else {
    return String(
      localized: "Leaves out \(removed) lessons.", table: "Plan",
      comment: "A change's lessons left out")
  }

  return someOf
    ? String(
      localized: "Leaves out \(removed) lessons, such as \(names).", table: "Plan",
      comment: "A change's lessons left out, naming a few")
    : String(
      localized: "Leaves out \(removed) lessons: \(names).", table: "Plan",
      comment: "A change's lessons left out, naming them all")
}

/// Main's `useExamples`: the first three, as a list.
private func lessonExamples(_ names: [String]) -> String {
  names.prefix(3).formatted(.list(type: .and))
}

/// Main's `useShortList` for lessons: three names, then how many more.
private func lessonList(_ names: [String]) -> String {
  guard names.count > 3 else {
    return names.formatted(.list(type: .and))
  }

  return String(
    localized: "\(names.prefix(3).joined(separator: ", ")) and \(names.count - 3) more",
    table: "Plan", comment: "A few lesson names and how many more")
}
