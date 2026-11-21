import SwiftUI

extension StudyWeek.Day {
  /// Main's `getDayShare`: the day's list done so far, whole once it was finished. Minutes never
  /// fill it.
  var share: Double {
    if hitGoal {
      return 1
    }

    return total > 0 ? Double(completed) / Double(total) : 0
  }

  func isMissed(on localDate: String) -> Bool {
    kind == "study" && !studied && !isToday && date < localDate
  }

  /// Main's `useDayStatus`: how the day went, or what it is, in a few words.
  func status(on localDate: String, isExam: Bool) -> String {
    if hitGoal {
      return String(
        localized: "done", table: "Today",
        comment: "A day's status: the day's study time was met")
    }

    if studied {
      return String(localized: "studied", table: "Today", comment: "A day's status")
    }

    switch kind {
    case "exam":
      return String(localized: "exam day", table: "Today", comment: "A day's status")
    case "deadline":
      return String(localized: "end date", table: "Today", comment: "A day's status")
    case "beforeStart":
      return String(localized: "before your plan", table: "Today", comment: "A day's status")
    case "afterEnd":
      return isExam
        ? String(localized: "after your exam", table: "Today", comment: "A day's status")
        : String(localized: "after your end date", table: "Today", comment: "A day's status")
    case "rest":
      return String(localized: "rest day", table: "Today", comment: "A day's status")
    default:
      break
    }

    if isToday {
      return String(localized: "today", table: "Today", comment: "A day's status")
    }

    return date > localDate
      ? String(localized: "planned", table: "Today", comment: "A day's status")
      : String(localized: "not studied", table: "Today", comment: "A day's status")
  }

  fileprivate func track(on localDate: String) -> GoalRingTrack {
    if isToday {
      return .today
    }

    if isMissed(on: localDate) {
      return .missed
    }

    return kind == "rest" ? .rest : .standard
  }
}

/// Main's `WeekDayRing`: one day of a week, the same on Today, the Plan and the weekly summary. A
/// dash for a day outside the plan; otherwise its ring, with a check once done, a cap on an exam or
/// end date not studied, and else the caller's `mark`.
struct WeekDayRing<Mark: View>: View {
  let day: StudyWeek.Day
  /// The learner's calendar day, `YYYY-MM-DD`, which decides a missed day.
  let localDate: String
  let size: CGFloat
  @ViewBuilder var mark: Mark

  var body: some View {
    if !day.studied && (day.kind == "beforeStart" || day.kind == "afterEnd") && !day.isToday {
      Image(systemName: "minus")
        .foregroundStyle(Color(.foreground).opacity(0.2))
        .frame(width: size, height: size)
    } else {
      GoalRing(share: day.share, track: day.track(on: localDate), size: size) {
        if day.hitGoal {
          Image(systemName: "checkmark")
            .foregroundStyle(.success)
        } else if !day.studied && (day.kind == "exam" || day.kind == "deadline") {
          Image(systemName: "graduationcap")
            .foregroundStyle(.primary)
        } else {
          mark
        }
      }
    }
  }
}

extension WeekDayRing where Mark == EmptyView {
  init(day: StudyWeek.Day, localDate: String, size: CGFloat) {
    self.init(day: day, localDate: localDate, size: size) { EmptyView() }
  }
}
