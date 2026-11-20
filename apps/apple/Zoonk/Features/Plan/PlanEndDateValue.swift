import Foundation

struct PlanEndDateValue: Equatable {
  struct Line: Equatable {
    let shown: String
    let spoken: String
  }

  let shown: String
  let spoken: String
  var detail: Line?
  var isDate = false

  init(
    targetDate: String?, isExam: Bool,
    finish: (isoDate: String, estimate: Bool, month: Bool)?, today: String
  ) {
    guard let finish, !isExam || targetDate != nil else {
      shown =
        isExam
        ? String(localized: "To be confirmed", table: "Plan")
        : String(localized: "None set", table: "Plan")
      spoken = shown
      return
    }

    if finish.estimate {
      if targetDate == nil {
        shown = String(localized: "None set", table: "Plan")
        spoken = shown
        detail = Self.estimatedFinish(finish.isoDate, today: today, month: finish.month)
      } else {
        let value = PlanDate.estimate(finish.isoDate, today: today, month: finish.month)
        shown = value.text
        spoken = value.spoken
        isDate = true
      }
    } else {
      shown = PlanDate.text(finish.isoDate, today: today, month: finish.month)
      spoken = shown
      isDate = true
    }
  }

  static func estimatedFinish(_ isoDate: String, today: String, month: Bool) -> Line {
    let date = PlanDate.estimate(isoDate, today: today, month: month)
    return Line(shown: estimatedFinish(date.text), spoken: estimatedFinish(date.spoken))
  }

  private static func estimatedFinish(_ date: String) -> String {
    String(
      localized: "Estimated finish \(date)", table: "Plan",
      comment: "Estimated end of a plan that has no deadline")
  }
}
