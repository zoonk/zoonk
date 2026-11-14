import SwiftUI

/// A month the learner named stays a month until they pick its day. Dropping an end date says what
/// it changes first; an exam keeps its date.
struct PlanDateSection: View {
  @State private var isPicking = false
  @State private var picked: Date?
  @State private var saved: Date?

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan
  var asksStudyEverything = false

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
          planNoticeDayText(noticeDay, document: plan.examDocument)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)

          Button {
            Task { await save(noticeDay.date) }
          } label: {
            Text("Use this date", tableName: "Plan", comment: "Takes the notice's day as the date")
          }
          .buttonStyle(.outline)
          .controlSize(.small)
        }
      }

      if !isExam, schedule.targetDate != nil {
        dropDeadline()
      }
    } footer: {
      SectionFooter {
        if namedMonth, let date = schedule.targetDate {
          Text(
            "\(PlanDate.text(date, today: plan.today, month: true)) for now. Pick the day when you know it.",
            tableName: "Plan",
            comment:
              "A month the learner named stands until they pick the day; the argument is the month the learner named, like 'May 2027'"
          )
        }
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
      : Text("End date", tableName: "Plan", comment: "Setting: the goal's end date")
  }

  /// True once saved.
  @discardableResult
  private func save(_ isoDate: String) async -> Bool {
    await editor.change([.targetDate(isoDate)])
  }

  private func dropDeadline() -> some View {
    let title = Text(
      "Study everything", tableName: "Plan",
      comment: "Title asking to drop the goal's end date, and its button")

    return PreviewedPlanChange(
      editor: editor, plan: plan, edits: [.targetDate(nil)], title: title, button: title,
      what: String(
        localized: "Every part of your goal, with no end date.", table: "Plan",
        comment: "What dropping the goal's end date does"),
      asksOnAppear: asksStudyEverything
    ) { isPreviewing, ask in
      BusyButton(isBusy: isPreviewing, isRow: true, action: ask) {
        title
      }
    }
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

/// The exam's day as its notice or official calendar gives it, or its likely day.
func planNoticeDayText(_ noticeDay: GoalPlan.Schedule.NoticeDay, document: ExamDocument) -> Text {
  let date =
    PlanDate.date(noticeDay.date).map {
      $0.formatted(Date.FormatStyle(date: .long, time: .omitted, timeZone: .gmt))
    } ?? noticeDay.date

  if noticeDay.estimated {
    return Text(
      "The exam's likely date is now \(date).", tableName: "Plan",
      comment:
        "The exam's likely day while its notice isn't out; the argument is a date like 'May 5, 2027'"
    )
  }

  return Text(
    "The exam is on \(date).", tableName: "Plan",
    comment:
      "The exam's day its notice or official calendar gives; the argument is a date like 'May 5, 2027'"
  )
}
