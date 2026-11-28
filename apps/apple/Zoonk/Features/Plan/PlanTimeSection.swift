import SwiftUI

/// Main's plan editor time: the time question's whole answer, read while the editor shows and again
/// after each change, never when the plan page loads, since it plans the goal at many times.
struct PlanTimeSection: View {
  @Environment(PlanStore.self) private var store
  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan
  /// The weekend has its own time: the time a day changes the weekdays alone.
  let weekendOn: Bool

  var body: some View {
    let current = plan.schedule.shape.weekdays
    let time = store.timeToCover(goalId: goal.id)
    let found = time.freshValue
    let suggested = ScheduleTime.suggestedMinutes(found)

    Section {
      DailyTimeRow(finish: finish, aim: plan.languageAim?.aimAhead, updating: editor.isSaving) {
        DailyTimeMenu(
          minutes: current,
          times: ScheduleTime.dailyTimes(plan.schedule.dailyTimes, with: current, suggested),
          suggested: suggested
        ) { minutes in
          guard minutes != current else {
            return
          }

          editor.run { await setMinutes(minutes) }
        }
      }
      .loads(
        plan.schedule.targetDate == nil ? [] : [time], refreshable: false, retriesAFailure: true)

      timeLine(time: time, found: found, minutes: current)
    } header: {
      SectionTitle(Text("Daily study time", tableName: "Plan"))
    } footer: {
      SectionFooter {
        Text(
          "Your plan changes from today. Less time spreads your lessons over more days.",
          tableName: "Plan", comment: "Explains what changing the time a day does")
      }
    }
  }

  /// A plan with a date says the time it suggests, dimmed while a change saves.
  @ViewBuilder
  private func timeLine(time: Resource<TimeToCover>, found: TimeToCover?, minutes: Int) -> some View
  {
    if let feasibility = plan.feasibility, feasibility.deadline != nil,
      let targetDate = plan.schedule.targetDate
    {
      TimeAnswer(
        date: TimeAnswer.GoalDate(
          isoDate: targetDate, namedMonth: plan.schedule.targetDateNamedMonth,
          estimated: plan.schedule.targetDateEstimated),
        exam: goal.kind == .exam,
        line: ScheduleTime.line(
          advice: nil, askFailed: false, dated: true, findFailed: Self.failed(time),
          found: found, hasDays: true, minutes: minutes),
        minutes: minutes, updating: editor.isSaving, subjectsTakenOut: plan.subjectsTakenOut
      ) {
        Task { await time.refresh() }
      } onUseOffer: { minutes in
        editor.run { await setMinutes(minutes) }
      }

      // A goal that isn't an exam can move its date to the day its own time covers everything.
      if goal.kind != .exam, !feasibility.fits, !feasibility.timeCovers,
        let fittingDate = found?.fittingDate
      {
        moveDate(to: fittingDate)
      }
    }
  }

  private static func failed(_ time: Resource<TimeToCover>) -> Bool {
    if case .failed = time.freshState {
      return true
    }

    return false
  }

  /// A plan without a date says when it finishes; a paused one has no pace to say it by. The end
  /// is the saved schedule's last day, laid out again only by a change, so once it has passed it no
  /// longer says that.
  private var finish: PlanForecast? {
    guard plan.schedule.targetDate == nil, plan.end == nil, goal.status != .paused,
      let forecast = plan.estimate.forecast
    else {
      return nil
    }

    if let end = forecast.isoDate, end < plan.today {
      return nil
    }

    return forecast
  }

  private func moveDate(to fittingDate: String) -> some View {
    Button {
      editor.run { await editor.change([.targetDate(fittingDate)]) }
    } label: {
      Text(
        "Move your date to \(PlanDate.text(fittingDate, today: plan.today))", tableName: "Plan",
        comment:
          "Moves the goal's date to the day its time covers everything; the argument is a date like 'May 5'"
      )
    }
    .buttonStyle(.outline)
    .controlSize(.small)
  }

  private func setMinutes(_ minutes: Int) async {
    let shape = plan.schedule.shape

    await editor.change([
      weekendOn && shape.canDiffer
        ? .weekdayMinutes(minutes, weekdays: shape.weekdayDays) : .dailyMinutes(minutes)
    ])
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
          what: plan.subjectsTakenOut
            ? String(
              localized:
                "You study every topic in your plan. What doesn't fit before the exam comes after it.",
              table: "Plan")
            : String(
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
                  editor.run { await editor.change([.fullCourse(false)]) }
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
        if on, let end = plan.estimate.fullCourseEndDate {
          SectionFooter {
            Text(
              "You finish around \(PlanDate.finishText(end, grain: plan.estimate.precision == .year ? .year : .month)).",
              tableName: "Plan",
              comment:
                "When the plan finishes, as a month and year, like \"January 2027\", or a year, like \"2031\""
            )
          }
        }
      }
    }
  }
}
