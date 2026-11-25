import Foundation

struct PlanEndDateValue: Equatable {
  struct Line: Equatable {
    let shown: String
    let spoken: String
  }

  let shown: String
  let spoken: String
  var isDate = false

  /// The date the learner set, or with none the finish the plan works out, as the timeline says
  /// it. Never the day a finished plan was done.
  init(
    target: (isoDate: String, estimate: Bool, month: Bool)?,
    finish: (isoDate: String, month: Bool)? = nil, isExam: Bool, today: String
  ) {
    guard let target = target ?? finish.map({ ($0.isoDate, true, $0.month) }) else {
      shown =
        isExam
        ? String(localized: "To be confirmed", table: "Plan")
        : String(localized: "None set", table: "Plan")
      spoken = shown
      return
    }

    if target.estimate {
      let value = PlanDate.estimate(target.isoDate, today: today, month: target.month)
      shown = value.text
      spoken = value.spoken
    } else {
      shown = PlanDate.text(target.isoDate, today: today, month: target.month)
      spoken = shown
    }
    isDate = true
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
