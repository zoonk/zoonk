import SwiftUI

/// A month the learner named stays a month until they pick its day. Dropping a deadline says what it
/// changes first; an exam keeps its date and offers "Study everything, even after the exam" instead.
struct PlanDateSection: View {
  @State private var isPicking = false
  @State private var picked: Date?
  @State private var saved: Date?

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan

  var body: some View {
    let schedule = plan.schedule
    let isExam = goal.kind == .exam
    let namedMonth = schedule.targetDateNamedMonth && schedule.targetDate != nil
    let stored = schedule.targetDate.flatMap(PlanDate.date)
    // A named month's first day isn't a day the learner chose.
    let day = namedMonth ? nil : stored
    let bounds = Self.bounds(today: plan.today)

    Section {
      if day != nil || isPicking {
        DatePicker(
          selection: Binding(
            get: { picked ?? day ?? Self.clamp(stored ?? bounds.lowerBound, to: bounds) },
            set: { picked = $0 }),
          in: bounds, displayedComponents: .date
        ) {
          label
        }
      } else {
        Button {
          isPicking = true
        } label: {
          LabeledContent {
            if namedMonth, let date = schedule.targetDate {
              Text(PlanDate.text(date, today: plan.today, month: true))
            } else if isExam {
              Text("To be confirmed", tableName: "Plan", comment: "An exam's date not known yet")
            } else {
              Text("No date", tableName: "Plan", comment: "A goal without a date")
            }
          } label: {
            label.foregroundStyle(.primary)
          }
        }
      }

      if let picked, picked != saved, PlanDate.isoDate(picked) != schedule.targetDate || namedMonth
      {
        Button {
          Task {
            if await save(PlanDate.isoDate(picked)) {
              saved = picked
            }
          }
        } label: {
          Text("Save", tableName: "Plan", comment: "Saves the goal's date")
        }
      }

      if let noticeDay = schedule.noticeDay {
        VStack(alignment: .leading, spacing: 8) {
          noticeDayText(noticeDay)
            .font(.subheadline)
            .foregroundStyle(.secondary)

          Button {
            Task { await save(noticeDay.date) }
          } label: {
            Text("Use this date", tableName: "Plan", comment: "Takes the notice's day as the date")
          }
          .buttonStyle(.bordered)
          .controlSize(.small)
        }
      }

      if !isExam, let date = schedule.targetDate {
        dropDeadline(date: date, namedMonth: namedMonth)
      }
    } footer: {
      if namedMonth, let date = schedule.targetDate {
        Text(
          "\(PlanDate.text(date, today: plan.today, month: true)) for now. Pick the day when you know it.",
          tableName: "Plan", comment: "A month the learner named stands until they pick the day")
      } else if schedule.targetDate == nil && !isExam {
        Text(
          "No deadline: you study everything at your own pace.", tableName: "Plan",
          comment: "A goal without a deadline")
      }
    }
    .environment(\.timeZone, .gmt)
    .onChange(of: schedule.targetDate) {
      isPicking = false
      picked = nil
      saved = nil
    }
  }

  private var label: Text {
    goal.kind == .exam
      ? Text("Exam date", tableName: "Plan", comment: "Setting: the exam's date")
      : Text("Deadline", tableName: "Plan", comment: "Setting: the goal's deadline")
  }

  private func noticeDayText(_ noticeDay: GoalPlan.Schedule.NoticeDay) -> Text {
    let date = PlanDate.date(noticeDay.date).map(Self.longDate) ?? noticeDay.date

    if noticeDay.estimated {
      return Text(
        "The exam's likely date is now \(date).", tableName: "Plan",
        comment: "The exam's likely day while its notice isn't out")
    }

    if plan.examDocument == .notice {
      return Text(
        "The exam notice says \(date).", tableName: "Plan",
        comment: "The exam's day its notice gives")
    }

    return Text(
      "The exam's official calendar says \(date).", tableName: "Plan",
      comment: "A language certificate's day its official calendar gives")
  }

  /// True once saved.
  @discardableResult
  private func save(_ isoDate: String) async -> Bool {
    let date = PlanDate.date(isoDate).map(Self.longDate) ?? isoDate
    let isFirstDay = plan.schedule.targetDate == nil || plan.schedule.targetDateNamedMonth

    return await editor.change(
      [.targetDate(isoDate)],
      sentence: isFirstDay
        ? String(localized: "Date set to \(date).", table: "Plan", comment: "Says the goal's date")
        : String(
          localized: "Date moved to \(date).", table: "Plan", comment: "Says the goal's date moved")
    )
  }

  private func dropDeadline(date: String, namedMonth: Bool) -> some View {
    let shown = PlanDate.text(date, today: plan.today, month: namedMonth)

    return PreviewedPlanChange(
      editor: editor, plan: plan, edits: [.targetDate(nil)],
      title: Text(
        "Study everything", tableName: "Plan",
        comment: "Title asking to drop the deadline, and its button"),
      what: String(
        localized: "Every part of your goal, at your own pace, with no end date.", table: "Plan",
        comment: "What dropping the deadline does"),
      sentence: String(
        localized: "Your deadline of \(shown) comes off your plan. You can set one again anytime.",
        table: "Plan", comment: "Says the goal's deadline was dropped")
    ) { isPreviewing, ask in
      Button(action: ask) {
        LabeledContent {
          if isPreviewing {
            ProgressView()
          }
        } label: {
          Text("Study everything", tableName: "Plan", comment: "Drops the goal's deadline")
        }
      }
    }
  }

  private static func longDate(_ date: Date) -> String {
    date.formatted(Date.FormatStyle(date: .long, time: .omitted, timeZone: .gmt))
  }

  /// Core's `getTargetDateBounds`.
  private static func bounds(today: String) -> ClosedRange<Date> {
    let start = PlanDate.date(today) ?? .now
    let day: TimeInterval = 24 * 60 * 60
    return start.addingTimeInterval(day)...start.addingTimeInterval(3650 * day)
  }

  private static func clamp(_ date: Date, to bounds: ClosedRange<Date>) -> Date {
    min(max(date, bounds.lowerBound), bounds.upperBound)
  }
}
