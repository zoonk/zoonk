import SwiftUI

/// "Your preparation" / "Your progress": the number tapped, with its meter, and what it's made of.
struct PlanStandingSheet: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let syllabus: GoalSyllabus?

  var body: some View {
    ZoonkList {
      if context.goal.kind == .exam,
        let preparation = store.standing(goalId: context.goal.id).value?.preparation
      {
        readout(
          share: preparation.value,
          text: preparation.value.formatted(.percent.precision(.fractionLength(0))),
          line: Text(
            "From what you've studied and how well you answer.", tableName: "Plan",
            comment: "What the exam preparation number is made of"))

        if !preparation.areas.isEmpty {
          Section {
            ForEach(preparation.areas) { area in
              VStack(alignment: .leading, spacing: 6) {
                LabeledContent {
                  Text(area.preparation, format: .percent.precision(.fractionLength(0)))
                    .monospacedDigit()
                } label: {
                  Text(area.title)
                }

                Meter(value: area.preparation, fill: .success)
                  .accessibilityHidden(true)
              }
              .accessibilityElement(children: .combine)
            }
          } header: {
            SectionTitle(
              Text(
                "By subject", tableName: "Plan",
                comment: "Section of the preparation of each subject"))
          }
        }

        calculated(
          preparation.components.mocks.kind == "fullReviews"
            ? Text(
              "Each subject counts as much as it's worth on the exam. A subject's number is how much of it you've studied times how well you answer, and it stays under 75% until you review every topic once.",
              tableName: "Plan")
            : Text(
              "Each subject counts as much as it's worth on the exam. A subject's number is how much of it you've studied times how well you answer, and it stays under 75% until you take a mock exam.",
              tableName: "Plan", comment: "How the exam preparation number is worked out"))
      } else if let lessons = syllabus?.lessons {
        let share = lessons.total > 0 ? min(1, Double(lessons.done) / Double(lessons.total)) : 0

        readout(
          share: share, text: goalProgressPercent(share),
          line: Text(
            "Lessons you've studied or already knew, out of your plan's.", tableName: "Plan",
            comment: "What the goal's progress number is made of"))

        Section {
          LabeledContent {
            Text(
              "\(lessons.done) of \(lessons.total)", tableName: "Plan",
              comment: "Lessons studied or already known, of the plan's lessons"
            )
            .monospacedDigit()
          } label: {
            Text("Lessons", tableName: "Plan", comment: "Row of the plan's lessons done")
          }
        }

        calculated(
          Text(
            "The share of your plan's lessons you've studied or already knew. Right answers, what you remember and weekly challenges show how well you know them.",
            tableName: "Plan", comment: "How the goal's progress number is worked out"))
      }
    }
    .navigationTitle(title)
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        PlanSheetDoneButton()
      }
    }
  }

  private func readout(share: Double, text: String, line: Text) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        BigQuantity(text)

        Meter(value: share, fill: .success)
          .accessibilityHidden(true)

        line
          .foregroundStyle(.mutedForeground)
      }
      .padding(.vertical, 4)
      .accessibilityElement(children: .combine)
    }
  }

  private func calculated(_ explanation: Text) -> some View {
    Section {
      DisclosureGroup {
        explanation
          .foregroundStyle(.mutedForeground)
      } label: {
        Text(
          "How it's calculated", tableName: "Plan",
          comment: "Shows how a plan's number is worked out")
      }
    }
  }

  private var title: Text {
    context.goal.kind == .exam
      ? Text("Your preparation", tableName: "Plan", comment: "Title of the exam preparation sheet")
      : Text("Your progress", tableName: "Plan", comment: "Title of the goal progress sheet")
  }
}

/// "Your schedule": the plan's state, at most one sentence on what to do about it, and the week.
struct PlanScheduleSheet: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.dismiss) private var dismiss

  let context: PlanContext
  let adjust: () -> Void

  var body: some View {
    let plan = context.plan
    let status =
      plan.status
      ?? GoalPlan.Status(
        challenges: nil, days: nil, extraMinutesPerDay: nil, kind: .onTrack, lessons: nil)
    let resting = planIsResting(status, isPaused: context.isPaused)

    ZoonkList {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(planStatusText(status, isPaused: context.isPaused))
            .typeStyle(.body.weight(.semibold))

          if let sentence = sentence(status, resting: resting) {
            Text(sentence)
              .foregroundStyle(.mutedForeground)
          }

          if !resting, status.kind == .needsAdjusting {
            Button(action: adjust) {
              Text(
                "Adjust plan", tableName: "Plan",
                comment: "Opens the plan's settings to change them")
            }
            .buttonStyle(.outline)
            .padding(.top, 4)
          } else if !resting, status.kind == .behind, (status.lessons ?? 0) > 0 {
            Button {
              dismiss()
              router.select(.today)
            } label: {
              Text(
                "Go to Today", tableName: "Plan",
                comment: "Opens Today, which puts the lessons from earlier days first")
            }
            .buttonStyle(.outline)
            .padding(.top, 4)
          }
        }
        .padding(.vertical, 4)
      }

      Section {
        PlanWeekRings(plan: plan)
      } header: {
        SectionTitle(
          Text("This week", tableName: "Plan", comment: "Section of the plan's week")
        ) {
          if plan.weekTime.targetMinutes > 0 {
            Text(
              "\(planDurationText(minutes: Double(plan.weekTime.studiedMinutes))) of \(planDurationText(minutes: plan.weekTime.targetMinutes))",
              tableName: "Plan", comment: "Time studied this week of the week's planned time"
            )
            .monospacedDigit()
          }
        }
      }

      Section {
        PlanRouteLink(route: .logbook) {
          Text("Last week's recap", tableName: "Plan", comment: "Opens last week's recap")
        }
      }
    }
    .navigationTitle(
      Text("Your schedule", tableName: "Plan", comment: "Title of the sheet about the plan's state")
    )
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        PlanSheetDoneButton()
      }
    }
  }

  private func sentence(_ status: GoalPlan.Status, resting: Bool) -> String? {
    if resting {
      return String(
        localized: "Nothing is planned until you resume it.", table: "Plan",
        comment: "Explains a paused goal")
    }

    let lessons = status.lessons ?? 0
    let days = status.days ?? 0

    switch status.kind {
    case .behind where lessons > 0:
      return String(
        localized: "They come first on Today.", table: "Plan",
        comment: "Where the lessons from earlier days a learner is behind on are")
    case .behind:
      let minutes = status.extraMinutesPerDay ?? 0

      return String(
        localized: "Study \(minutes) more min a day for \(days) days to be up to date.",
        table: "Plan",
        comment:
          "How much more time a day catches up with the plan; the first number is minutes, the second days"
      )
    case .needsAdjusting:
      return String(
        localized: "You have more lessons than days left. Add time a day or pick a later date.",
        table: "Plan", comment: "A plan with more lessons than days left before its date")
    case .pastDate:
      return context.goal.kind == .exam
        ? String(
          localized: "Your exam date has passed with \(lessons) lessons left.", table: "Plan",
          comment: "Lessons left once the exam's date passed")
        : String(
          localized: "Your end date has passed with \(lessons) lessons left.", table: "Plan",
          comment: "Lessons left once the goal's end date passed")
    case .challengesLeft:
      return (status.challenges ?? 0) == 1
        ? String(
          localized: "Every lesson is done. Win the challenge to finish your plan.", table: "Plan",
          comment: "What's left once every lesson is done: one challenge")
        : String(
          localized: "Every lesson is done. Win the challenges to finish your plan.",
          table: "Plan", comment: "What's left once every lesson is done: several challenges")
    case .ahead, .finished, .onTrack:
      return nil
    }
  }
}

/// A study day missed is dashed, never red.
private struct PlanWeekRings: View {
  @ScaledMetric(relativeTo: .body) private var ringSize = 28.0

  let plan: GoalPlan

  var body: some View {
    HStack {
      ForEach(plan.week.days) { day in
        VStack(spacing: 6) {
          Text(PlanDate.weekday(day.date))
            .typeStyle(.small.weight(.medium))
            .textCase(.uppercase)
            .foregroundStyle(day.state == .today ? Color(.foreground) : .mutedForeground)

          ring(day)
            .frame(width: ringSize, height: ringSize)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(PlanDate.text(day.date, today: plan.today)))
        .accessibilityValue(status(day))
      }
    }
    .padding(.vertical, 4)
  }

  private func ring(_ day: PlanWeekDay) -> some View {
    let lineWidth = ringSize / 7

    return ZStack {
      Circle()
        .stroke(
          track(day),
          style: StrokeStyle(lineWidth: lineWidth, dash: day.state == .missed ? [2, 3] : []))

      Circle()
        .trim(from: 0, to: day.share)
        .stroke(.success, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
        .rotationEffect(.degrees(-90))
    }
    .padding(lineWidth / 2)
  }

  private func track(_ day: PlanWeekDay) -> Color {
    switch day.state {
    case .today: Color.mutedForeground
    case .rest: Color.muted
    default: Color.surface3
    }
  }

  private func status(_ day: PlanWeekDay) -> Text {
    switch day.state {
    case .done: Text("done", tableName: "Plan", comment: "Spoken state of a day studied")
    case .missed:
      Text("not studied", tableName: "Plan", comment: "Spoken state of a study day missed")
    case .rest: Text("rest day", tableName: "Plan", comment: "Spoken state of a rest day")
    case .today: Text("today", tableName: "Plan", comment: "Spoken state of today")
    case .upcoming: Text("planned", tableName: "Plan", comment: "Spoken state of a day ahead")
    }
  }
}
