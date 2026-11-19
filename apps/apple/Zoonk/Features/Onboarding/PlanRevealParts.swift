import SwiftUI

/// Main's `RevealReadouts`: the time a day and when it ends, side by side.
struct RevealReadouts: View {
  let plan: GoalPlan
  let isExam: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 0) {
      readout(label: timeLabel) {
        BigQuantity(planDurationText(minutes: Double(plan.schedule.shape.weekdays)))
      }
      .padding(.trailing, 12)

      if let finish {
        Divider()
        readout(label: finish.label) {
          finish.value
        }
        .padding(.leading, 12)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(.vertical, 12)
    .overlay(alignment: .top) { Divider() }
    .overlay(alignment: .bottom) { Divider() }
  }

  private func readout<Value: View>(label: String, @ViewBuilder value: () -> Value) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      value()
        .lineLimit(1)
        .minimumScaleFactor(0.7)

      Text(label)
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .accessibilityElement(children: .combine)
  }

  private var timeLabel: String {
    let schedule = plan.schedule

    if let weekend = schedule.shape.weekend {
      return String(
        localized: "\(planDurationText(minutes: Double(weekend))) on weekends",
        table: "Onboarding",
        comment: "Under the plan's time a day when weekends have their own time")
    }

    return schedule.weekdayMinutes.allSatisfy { $0 > 0 }
      ? String(
        localized: "a day", table: "Onboarding",
        comment: "Under the plan's time a day, as in \"15 min a day\"")
      : studyDaysText(schedule.weekdayMinutes)
  }

  private var finish: (value: AnyView, label: String)? {
    let schedule = plan.schedule

    if let targetDate = schedule.targetDate {
      let days = max(0, PlanDate.days(from: plan.today, to: targetDate))
      let text =
        schedule.targetDateEstimated
        ? String(
          localized: "About \(days) days", table: "Onboarding",
          comment: "How long until a goal's estimated date")
        : String(
          localized: "\(days) days", table: "Onboarding", comment: "How long until a goal's date")

      return (
        AnyView(BigQuantity(text)),
        isExam
          ? String(
            localized: "until the exam", table: "Onboarding",
            comment: "Under the days left before the exam on the plan's reveal")
          : String(
            localized: "until your date", table: "Onboarding",
            comment: "Under the days left before the learner's date on the plan's reveal")
      )
    }

    guard let endDate = plan.estimate.endDate, let date = PlanDate.date(endDate) else {
      return nil
    }

    // A language course ends at its aim, so the reveal names the level and when it's reached.
    if let aim = plan.languageAim?.aimAhead {
      return (
        AnyView(Text(verbatim: aim).typeStyle(.readout).monospaced()),
        String(
          localized: "by \(PlanDate.longText(endDate, month: true))", table: "Onboarding",
          comment: "Under the level a language plan reaches, as in 'B1 by Nov 2027'")
      )
    }

    return (
      AnyView(MonthYear(date: date)),
      String(
        localized: "estimated finish", table: "Onboarding",
        comment: "Under the month a plan without a date ends at this pace")
    )
  }
}

/// The month reads first and big, its year small, in the locale's order.
private struct MonthYear: View {
  let date: Date

  var body: some View {
    let parts = PlanDate.monthAndYear(date)

    HStack(alignment: .firstTextBaseline, spacing: 0) {
      ForEach(Array(parts.runs.enumerated()), id: \.offset) { _, run in
        let text = Text(verbatim: String(parts[run.range].characters))

        if run.dateField == .year {
          text
            .typeStyle(.rowTitle)
            .foregroundStyle(.mutedForeground)
        } else {
          text
            .typeStyle(.readout)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(String(parts.characters))
  }
}

extension StudyBlock {
  var opensFromReveal: Bool {
    !isFinished && waitReason == nil
  }
}
