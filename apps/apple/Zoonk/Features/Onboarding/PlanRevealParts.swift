import SwiftUI

/// Main's `RevealReadouts`: the time a day and when it ends, side by side.
struct RevealReadouts: View {
  let plan: GoalPlan
  let isExam: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 0) {
      Readout(label: timeLabel) {
        BigQuantity(planDurationText(minutes: Double(plan.schedule.shape.weekdays)))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.trailing, 12)

      if plan.schedule.targetDate != nil || plan.estimate.forecast?.isoDate != nil {
        Divider()
        finishReadout
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.leading, 12)
      }
    }
    .fixedSize(horizontal: false, vertical: true)
    .padding(.vertical, 12)
    .overlay(alignment: .top) { Divider() }
    .overlay(alignment: .bottom) { Divider() }
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

  @ViewBuilder private var finishReadout: some View {
    let schedule = plan.schedule

    if let targetDate = schedule.targetDate {
      let days = max(0, PlanDate.days(from: plan.today, to: targetDate))

      Readout(
        label: isExam
          ? String(
            localized: "until the exam", table: "Onboarding",
            comment: "Under the days left before the exam on the plan's reveal")
          : String(
            localized: "until your date", table: "Onboarding",
            comment: "Under the days left before the learner's date on the plan's reveal")
      ) {
        BigQuantity(
          schedule.targetDateEstimated
            ? String(
              localized: "About \(days) days", table: "Onboarding",
              locale: .appLanguage, comment: "How long until a goal's estimated date")
            : String(
              localized: "\(days) days", table: "Onboarding", locale: .appLanguage,
              comment: "How long until a goal's date"))
      }
    } else if let forecast = plan.estimate.forecast, forecast.isoDate != nil {
      // A language course ends at its aim, so the reveal names the level and when it's reached.
      // Past the years a plan lays out, the time question said so: the reveal shows the plan.
      FinishReadout(forecast: forecast, aim: plan.languageAim?.aimAhead)
    }
  }
}

extension StudyBlock {
  var opensFromReveal: Bool {
    !isFinished && waitReason == nil
  }
}
