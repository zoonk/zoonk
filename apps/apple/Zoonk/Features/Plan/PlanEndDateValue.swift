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
        let unset = String(localized: "None set", table: "Plan")
        shown = [unset, value.text].joinedFacts()
        spoken = [unset, value.spoken].joinedFacts()
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
