import Foundation

struct PlanEndDateValue: Equatable {
  let shown: String
  let spoken: String

  init(
    targetDate: String?, isExam: Bool,
    finish: (isoDate: String, estimate: Bool, month: Bool)?, today: String
  ) {
    guard targetDate != nil else {
      if isExam {
        shown = String(localized: "To be confirmed", table: "Plan")
        spoken = shown
      } else if let finish {
        let value = PlanDate.estimate(finish.isoDate, today: today, month: finish.month)
        shown = String(localized: "None set · \(value.text)", table: "Plan")
        spoken = String(localized: "None set · \(value.spoken)", table: "Plan")
      } else {
        shown = String(localized: "None set", table: "Plan")
        spoken = shown
      }
      return
    }

    guard let finish else {
      shown = ""
      spoken = ""
      return
    }

    if finish.estimate {
      let value = PlanDate.estimate(finish.isoDate, today: today, month: finish.month)
      shown = value.text
      spoken = value.spoken
    } else {
      shown = PlanDate.text(finish.isoDate, today: today, month: finish.month)
      spoken = shown
    }
  }
}
