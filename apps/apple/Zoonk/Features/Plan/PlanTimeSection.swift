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
  var asksStudyEverything = false

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
          Text(TimeAnswer.choiceLabel(minutes, full: marked.full, suggested: marked.suggested))
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

      coverage(answer: answer, found: found, minutes: current)

      if goal.kind == .exam, plan.feasibility?.deadline != nil {
        fullCourseToggle
      }
    } footer: {
      Text(
        "Your plan changes from today. Less time spreads your lessons over more days.",
        tableName: "Plan", comment: "Explains what changing the time a day does")
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
          fullCourseEndDate: nil, ready: true),
        askFailed: false, dated: true, findFailed: false, found: found, hasDays: true,
        minutes: minutes)

      Group {
        if editor.isSaving {
          Text(
            "Working out what your time covers…", tableName: "Plan",
            comment: "While a change to the plan saves, in place of what the time a day covers"
          )
          .foregroundStyle(.secondary)
        } else if plan.fitOffer?.fits == true, let covers = planCoversEverythingText(plan) {
          covers
            .foregroundStyle(.secondary)
        } else {
          TimeAnswer(
            date: TimeAnswer.GoalDate(
              isoDate: targetDate, namedMonth: plan.schedule.targetDateNamedMonth),
            exam: goal.kind == .exam, line: line, minutes: minutes,
            note: ScheduleTime.fullTimeNote(
              found: found, line: line,
              studiesEveryDay: plan.schedule.weekdayMinutes.allSatisfy { $0 > 0 }),
            noteStatus: noteStatus(answer),
            offer: ScheduleTime.offer(found: found, line: line, minutes: minutes)
          ) {
            asked = nil
            round += 1
          } onUseOffer: { minutes in
            Task { await setMinutes(minutes) }
          }
        }
      }
      .font(.subheadline)

      // A goal that isn't an exam can move its date to the day its own time covers everything.
      if goal.kind != .exam, !line.coversEverything, let fittingDate = found?.fittingDate {
        moveDate(to: fittingDate)
      }
    } else if let finish {
      finish
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
  }

  private func noteStatus(_ answer: Asked?) -> TimeAnswer.NoteStatus? {
    switch answer {
    case .time: nil
    case .building, .failed: .failed
    case nil: .finding
    }
  }

  /// A plan without a date says when it finishes. The end is the saved schedule's last day, laid
  /// out again only by a change, so once it has passed it no longer says that.
  private var finish: Text? {
    guard let end = plan.estimate.endDate, end >= plan.today, plan.end == nil else {
      return nil
    }

    return editor.isSaving
      ? Text(
        "Working out when you'd finish…", tableName: "Plan",
        comment: "While a change to the time saves, in place of when the plan finishes")
      : Text(
        "You finish around \(PlanDate.text(end, today: plan.today, month: true)).",
        tableName: "Plan", comment: "When a plan without a date finishes, as a month and year")
  }

  /// Turning it on says what it changes first; turning it off applies at once.
  private var fullCourseToggle: some View {
    PreviewedPlanChange(
      editor: editor, plan: plan, edits: [.fullCourse(true)],
      title: Text(
        "Study everything", tableName: "Plan",
        comment: "Title asking to study everything, and its button"),
      what: String(
        localized: "Every topic, even after the exam, at your own pace.", table: "Plan",
        comment: "What studying everything does"),
      sentence: String(
        localized: "Your plan studies everything, even after the exam.", table: "Plan",
        comment: "Says the plan now studies everything"),
      asksOnAppear: asksStudyEverything && !plan.schedule.fullCourse
    ) { isPreviewing, ask in
      Toggle(
        isOn: Binding(
          get: { plan.schedule.fullCourse },
          set: { on in
            if on {
              ask()
            } else {
              Task { await stopFullCourse() }
            }
          })
      ) {
        HStack {
          Text(
            "Study everything, even after the exam", tableName: "Plan",
            comment: "Setting: keep studying every topic after the exam")

          if isPreviewing {
            ProgressView()
          }
        }
      }
      .tint(.success)
    }
  }

  private func moveDate(to fittingDate: String) -> some View {
    Button {
      Task {
        await editor.change(
          [.targetDate(fittingDate)],
          sentence: String(
            localized: "Date moved to \(PlanDate.text(fittingDate, today: plan.today)).",
            table: "Plan",
            comment:
              "Says the goal's date moved, earlier or later; the argument is a date like 'May 5'")
        )
      }
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

    await editor.change(
      [
        weekendOn && shape.canDiffer
          ? .weekdayMinutes(minutes, weekdays: shape.weekdayDays) : .dailyMinutes(minutes)
      ],
      sentence: String(
        localized: "Daily time changed to \(planDurationText(minutes: Double(minutes))).",
        table: "Plan", comment: "Says the plan's time a day changed"))
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

  private func stopFullCourse() async {
    await editor.change(
      [.fullCourse(false)],
      sentence: String(
        localized: "What doesn't fit by the exam is left out of your plan.", table: "Plan",
        comment: "Says the plan stops studying everything"))
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

/// Nil when it covers everything in depth.
func planCoverageText(_ plan: GoalPlan) -> String? {
  guard let feasibility = plan.feasibility, feasibility.deadline != nil, !feasibility.fits else {
    return nil
  }

  let time = planDurationText(minutes: Double(plan.schedule.dailyMinutes))
  let isExam = feasibility.measure == "exam"

  if feasibility.coveredShare < 0.005 {
    return String(
      localized: "\(time) a day isn't enough time to cover your goal.", table: "Plan",
      comment: "The time a day covers next to nothing")
  }

  if feasibility.coreFits && isExam {
    return feasibility.deepensMostAsked
      ? String(
        localized:
          "\(time) a day studies every topic of the exam, the ones that come up most in more depth.",
        table: "Plan", comment: "What the time a day covers of an exam")
      : String(
        localized: "\(time) a day studies every topic of the exam, some of them in less depth.",
        table: "Plan", comment: "What the time a day covers of an exam")
  }

  if feasibility.coreFits {
    return String(
      localized:
        "\(time) a day studies every part of your goal, the ones that matter most in more depth.",
      table: "Plan", comment: "What the time a day covers of a goal")
  }

  if isExam && plan.schedule.fullCourse {
    return String(
      localized:
        "\(time) a day doesn't reach every topic by the exam: the ones that come up least come after it.",
      table: "Plan", comment: "What the time a day leaves for after the exam")
  }

  return isExam
    ? String(
      localized:
        "\(time) a day doesn't reach every topic: the ones that come up least are left out.",
      table: "Plan", comment: "What the time a day leaves out of an exam")
    : String(
      localized:
        "\(time) a day doesn't reach every part of your goal: what comes last in your path is left out.",
      table: "Plan", comment: "What the time a day leaves out of a goal")
}
