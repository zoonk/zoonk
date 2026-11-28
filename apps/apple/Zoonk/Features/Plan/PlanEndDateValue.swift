import Foundation

struct PlanEndDateValue: Equatable {
  let shown: String
  let spoken: String
  var isDate = false

  /// The date the learner set, or with none the finish the plan works out, as the timeline says
  /// it. Never the day a finished plan was done.
  init(
    target: (isoDate: String, estimate: Bool, grain: DateGrain)?,
    finish: (isoDate: String, grain: DateGrain)? = nil, isExam: Bool, today: String
  ) {
    guard let target = target ?? finish.map({ ($0.isoDate, true, $0.grain) }) else {
      shown =
        isExam
        ? String(localized: "To be confirmed", table: "Plan")
        : String(localized: "None set", table: "Plan")
      spoken = shown
      return
    }

    if target.estimate {
      let value = PlanDate.estimate(target.isoDate, today: today, grain: target.grain)
      shown = value.text
      spoken = value.spoken
    } else {
      shown = PlanDate.text(target.isoDate, today: today, grain: target.grain)
      spoken = shown
    }
    isDate = true
  }
}
