import SwiftUI

struct PlanStandingSheet: View {
  @Environment(PlanStore.self) private var store

  let context: PlanContext
  let syllabus: GoalSyllabus?

  var body: some View {
    List {
      if context.goal.kind == .exam,
        let preparation = store.standing(goalId: context.goal.id).value?.preparation
      {
        Section {
          LabeledContent {
            Text(preparation.value, format: .percent.precision(.fractionLength(0)))
              .monospacedDigit()
          } label: {
            Text("Preparation", tableName: "Plan", comment: "Label of the exam preparation number")
          }
        } footer: {
          Text(
            "How ready you are for the exam, from what you studied and how you answered.",
            tableName: "Plan", comment: "Explains the exam preparation number")
        }

        Section {
          ForEach(preparation.areas) { area in
            VStack(alignment: .leading, spacing: 6) {
              LabeledContent {
                Text(area.preparation, format: .percent.precision(.fractionLength(0)))
                  .monospacedDigit()
              } label: {
                Text(area.title)
              }

              ProgressView(value: area.preparation)
                .tint(.success)
                .accessibilityHidden(true)
            }
            .accessibilityElement(children: .combine)
          }
        } header: {
          Text("By topic", tableName: "Plan", comment: "Section of the preparation of each topic")
        }
      } else if let lessons = syllabus?.lessons {
        Section {
          LabeledContent {
            Text(lessons.done - lessons.known, format: .number).monospacedDigit()
          } label: {
            Text("Lessons studied", tableName: "Plan", comment: "Lessons the learner studied")
          }

          if lessons.known > 0 {
            LabeledContent {
              Text(lessons.known, format: .number).monospacedDigit()
            } label: {
              Text(
                "Lessons you already knew", tableName: "Plan",
                comment: "Lessons the learner tested out of")
            }
          }

          LabeledContent {
            Text(lessons.total, format: .number).monospacedDigit()
          } label: {
            Text("Lessons in your plan", tableName: "Plan", comment: "All the plan's lessons")
          }
        }
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

  private var title: Text {
    context.goal.kind == .exam
      ? Text("Your preparation", tableName: "Plan", comment: "Title of the exam preparation sheet")
      : Text("Your progress", tableName: "Plan", comment: "Title of the goal progress sheet")
  }
}

struct PlanPaceSheet: View {
  let context: PlanContext
  let adjust: () -> Void

  var body: some View {
    let plan = context.plan
    let status =
      plan.status
      ?? GoalPlan.Status(
        challenges: nil, days: nil, extraMinutesPerDay: nil, kind: .onTrack, lessons: nil)
    let resting =
      context.isPaused && ![.finished, .pastDate, .challengesLeft].contains(status.kind)
    let fix = resting ? nil : planPaceFix(plan, isExam: context.goal.kind == .exam)

    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(
            resting
              ? String(localized: "Paused", table: "Plan", comment: "Pace of a paused goal")
              : planStatusText(status)
          )
          .font(.headline)

          if resting {
            Text(
              "Nothing is planned until you resume it.", tableName: "Plan",
              comment: "Explains a paused goal"
            )
            .foregroundStyle(.secondary)
          }

          if let fix {
            Text(fix.text)
              .foregroundStyle(.secondary)
          }

          if fix?.adjust == true {
            Button(action: adjust) {
              Text(
                "Adjust plan", tableName: "Plan",
                comment: "Opens the plan's settings to change them")
            }
            .buttonStyle(.bordered)
            .padding(.top, 4)
          }
        }
        .padding(.vertical, 4)
      }

      Section {
        PlanWeekRings(plan: plan)
      } header: {
        HStack(alignment: .firstTextBaseline) {
          Text("This week", tableName: "Plan", comment: "Section of the plan's week")

          if plan.weekTime.targetMinutes > 0 {
            Spacer()
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
    .navigationTitle(Text("Your pace", tableName: "Plan", comment: "Title of the pace sheet"))
    .toolbarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        PlanSheetDoneButton()
      }
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
            .font(.caption2.weight(.medium))
            .textCase(.uppercase)
            .foregroundStyle(day.state == .today ? .primary : .secondary)

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
    case .today: Color(.secondaryLabel)
    case .rest: Color(.quaternarySystemFill)
    default: Color(.systemFill)
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
