import SwiftUI

/// Main's plan editor time: the time question's whole answer, asked when the editor opens and again
/// after each change, never when the plan page loads, since it plans the goal at many times.
struct PlanTimeSection: View {
  @Environment(PlanStore.self) private var store
  @State private var asked: (revision: Revision, answer: Asked)?
  @State private var round = 0

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan
  /// The weekend has its own time: the time a day changes the weekdays alone.
  let weekendOn: Bool

  private enum Asked: Equatable {
    case building
    case failed
    case time(TimeToCover)
  }

  /// What the time-to-cover answer depends on: a change to any of it asks again.
  private struct Revision: Equatable {
    let planId: String
    let schedule: GoalPlan.Schedule
    let feasibility: GoalPlan.Feasibility?
    let steering: GoalPlan.Steering
    let areas: [GoalPlan.Area]
    let bases: GoalPlan.Bases?
    let examChoices: [GoalPlan.ExamChoice]

    init(_ plan: GoalPlan) {
      planId = plan.planId
      schedule = plan.schedule
      feasibility = plan.feasibility
      steering = plan.steering
      areas = plan.areas
      bases = plan.bases
      examChoices = plan.examChoices
    }
  }

  private struct AskKey: Equatable {
    let revision: Revision
    let round: Int
  }

  var body: some View {
    let current = plan.schedule.shape.weekdays
    let revision = Revision(plan)
    let answer = asked?.revision == revision ? asked?.answer : nil
    let found: TimeToCover? = if case .time(let time) = answer { time } else { nil }
    let marked = ScheduleTime.markedTimes(found)

    Section {
      Picker(
        selection: Binding(
          get: { current },
          set: { minutes in
            guard minutes != current else {
              return
            }

            Task { await setMinutes(minutes) }
          })
      ) {
        ForEach(
          ScheduleTime.dailyTimes(
            plan.schedule.dailyTimes, with: current, marked.suggested, marked.full),
          id: \.self
        ) { minutes in
          Text(TimeAnswer.choiceLabel(minutes, suggested: marked.suggested))
            .tag(minutes)
        }
      } label: {
        Text("Time a day", tableName: "Plan", comment: "Setting: study time a day")
      }
      .task(id: AskKey(revision: revision, round: round)) {
        guard plan.schedule.targetDate != nil, answer == nil else {
          return
        }

        await ask(revision)
      }
      .announcesStatus(editor.isSaving ? nil : finish)

      coverage(answer: answer, found: found, minutes: current)
    } footer: {
      SectionFooter {
        Text(
          "Your plan changes from today. Less time spreads your lessons over more days.",
          tableName: "Plan", comment: "Explains what changing the time a day does")
      }
    }
  }

  /// While a change saves, its place says the new coverage is being worked out: the old one would
  /// describe a time no longer picked.
  @ViewBuilder
  private func coverage(answer: Asked?, found: TimeToCover?, minutes: Int) -> some View {
    if let feasibility = plan.feasibility, feasibility.deadline != nil,
      let targetDate = plan.schedule.targetDate
    {
      let line = ScheduleTime.line(
        advice: TimeAdvice(
          coveredShare: feasibility.fits ? 1 : feasibility.coveredShare, endDate: nil,
          focusSubjects: nil, fullCourseEndDate: nil, readingNotice: false, ready: true),
        askFailed: false, dated: true, findFailed: false, found: found, hasDays: true,
        minutes: minutes)

      Group {
        if editor.isSaving {
          Text(
            "Working out what your time covers…", tableName: "Plan",
            comment: "While a change to the plan saves, in place of what the time a day covers"
          )
          .foregroundStyle(.mutedForeground)
        } else if plan.fitOffer?.fits == true, let covers = planCoversEverythingText(plan) {
          covers
            .foregroundStyle(.mutedForeground)
        } else {
          TimeAnswer(
            date: TimeAnswer.GoalDate(
              isoDate: targetDate, namedMonth: plan.schedule.targetDateNamedMonth),
            exam: goal.kind == .exam, line: line, minutes: minutes,
            offer: ScheduleTime.offer(found: found, line: line, minutes: minutes)
          ) {
            asked = nil
            round += 1
          } onUseOffer: { minutes in
            Task { await setMinutes(minutes) }
          }
        }
      }
      .typeStyle(.body)

      // A goal that isn't an exam can move its date to the day its own time covers everything.
      if goal.kind != .exam, !line.coversEverything, let fittingDate = found?.fittingDate {
        moveDate(to: fittingDate)
      }
    } else if let finish {
      Text(finish)
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
    }
  }

  /// A plan without a date says when it finishes. The end is the saved schedule's last day, laid
  /// out again only by a change, so once it has passed it no longer says that.
  private var finish: String? {
    guard plan.feasibility?.deadline == nil || plan.schedule.targetDate == nil,
      let end = plan.estimate.endDate, end >= plan.today, plan.end == nil
    else {
      return nil
    }

    return editor.isSaving
      ? String(
        localized: "Working out when you'd finish…", table: "Plan",
        comment: "While a change to the time saves, in place of when the plan finishes")
      : String(
        localized: "You finish around \(PlanDate.text(end, today: plan.today, month: true)).",
        table: "Plan", comment: "When a plan without a date finishes, as a month and year")
  }

  private func moveDate(to fittingDate: String) -> some View {
    Button {
      Task { await editor.change([.targetDate(fittingDate)]) }
    } label: {
      Text(
        "Move your date to \(PlanDate.text(fittingDate, today: plan.today))", tableName: "Plan",
        comment:
          "Moves the goal's date to the day its time covers everything; the argument is a date like 'May 5'"
      )
    }
  }

  private func setMinutes(_ minutes: Int) async {
    let shape = plan.schedule.shape

    await editor.change([
      weekendOn && shape.canDiffer
        ? .weekdayMinutes(minutes, weekdays: shape.weekdayDays) : .dailyMinutes(minutes)
    ])
  }

  private func ask(_ revision: Revision) async {
    let goalId = goal.id
    let time = await store.write { api, token in
      try await api.timeToCover(token: token, goalId: goalId)
    } changed: { _ in
      false
    }

    switch time {
    case .done(let time) where time.ready: asked = (revision, .time(time))
    case .done: asked = (revision, .building)
    case .failed: asked = (revision, .failed)
    case .obsolete: break
    }
  }

}

/// Main's `FullCourseSwitch`, at the end of the schedule settings: it shows only on an exam plan
/// that already studies past the exam, so it can be turned off. Before the exam the option lives in
/// the coverage suggestion; after it, the Plan asks.
struct PlanFullCourseSection: View {
  let editor: PlanEditor
  let plan: GoalPlan
  /// Opened to keep studying after the exam: it asks at once.
  var asks = false

  var body: some View {
    let on = plan.schedule.fullCourse
    let title = Text(
      "Keep studying after the exam", tableName: "Plan",
      comment: "Setting and question: keep studying what's left after the exam")

    if on || asks {
      Section {
        PreviewedPlanChange(
          editor: editor, plan: plan, edits: [.fullCourse(true)], title: title,
          button: Text(
            "Keep studying", tableName: "Plan",
            comment: "Keeps studying what's left after the exam"),
          what: String(
            localized: "You study every topic. What doesn't fit before the exam comes after it.",
            table: "Plan", comment: "What studying after the exam does"),
          asksOnAppear: asks && !on
        ) { isPreviewing, ask in
          Toggle(
            isOn: Binding(
              get: { on },
              set: { isOn in
                if isOn {
                  ask()
                } else {
                  Task { await editor.change([.fullCourse(false)]) }
                }
              })
          ) {
            HStack {
              title

              if isPreviewing {
                ProgressView()
              }
            }
          }
          .tint(.success)
          .disabled(isPreviewing)
        }
      } footer: {
        if on, let end = plan.estimate.endDate {
          SectionFooter {
            Text(
              "You finish in \(PlanDate.text(end, today: plan.today, month: true)).",
              tableName: "Plan",
              comment: "When a plan that goes on after the exam finishes, as a month and year")
          }
        }
      }
    }
  }
}

/// Nil for a plan without a date.
func planCoversEverythingText(_ plan: GoalPlan) -> Text? {
  let schedule = plan.schedule

  guard let targetDate = schedule.targetDate else {
    return nil
  }

  let date = PlanDate.text(targetDate, today: plan.today, month: schedule.targetDateNamedMonth)

  return schedule.targetDateNamedMonth
    ? Text(
      "Your time covers everything by the start of \(date)", tableName: "Plan",
      comment:
        "The learner's own time a day covers the whole goal; the argument is the month the learner named, like 'May 2027'"
    )
    : Text(
      "Your time covers everything by \(date)", tableName: "Plan",
      comment:
        "The learner's own time a day covers the whole goal; the argument is a date like 'May 5'")
}

/// Main's `useCoveredText`: how much of the goal its time covers by its date. Nil when it covers
/// everything.
func planCoverageText(_ plan: GoalPlan) -> String? {
  guard let feasibility = plan.feasibility, feasibility.deadline != nil, !feasibility.fits else {
    return nil
  }

  let schedule = plan.schedule

  guard feasibility.coveredShare >= 0.005, schedule.targetDate != nil else {
    let time = planDurationText(minutes: Double(schedule.dailyMinutes))

    return String(
      localized: "\(time) a day isn't enough time to cover your goal.", table: "Plan",
      comment: "The time a day covers next to nothing")
  }

  return planCoverageLine(
    minutes: schedule.dailyMinutes, share: feasibility.coveredShare,
    exam: feasibility.measure == "exam")
}
