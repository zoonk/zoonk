import Foundation

struct PlanEndDateValue: Equatable {
  let shown: String
  let spoken: String
  var detail: String?
  var isDate = false

  init(
    targetDate: String?, isExam: Bool,
    finish: (isoDate: String, estimate: Bool, month: Bool)?, today: String
  ) {
    guard let finish, !isExam || targetDate != nil else {
      shown =
        isExam
        ? String(localized: "Date not set", table: "Plan", comment: "An exam date that is not set")
        : String(localized: "None set", table: "Plan")
      spoken = shown
      return
    }

    if finish.estimate {
      let value = PlanDate.estimate(finish.isoDate, today: today, month: finish.month)
      if targetDate == nil {
        shown = String(localized: "None set", table: "Plan")
        spoken = shown
        detail = String(
          localized: "Estimated finish \(value.text)", table: "Plan",
          comment: "Estimated end of a plan that has no deadline")
      } else {
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
}
