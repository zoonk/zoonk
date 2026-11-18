import Foundation

struct PlanEndDateValue: Equatable {
  let shown: String
  let spoken: String

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
      let value = PlanDate.estimate(finish.isoDate, today: today, month: finish.month)
      if targetDate == nil {
        shown = String(localized: "None set · \(value.text)", table: "Plan")
        spoken = String(localized: "None set · \(value.spoken)", table: "Plan")
      } else {
        shown = value.text
        spoken = value.spoken
      }
    } else {
      shown = PlanDate.text(finish.isoDate, today: today, month: finish.month)
      spoken = shown
    }
  }
}
