import Foundation

extension EssayRubric {
  /// What the learner writes: an essay for ENEM, an answer for every other exam.
  var writingName: String {
    self == .enem
      ? String(localized: "Your essay", table: "Essay", comment: "The box for an ENEM essay")
      : String(localized: "Your answer", table: "Essay", comment: "The box for a written answer")
  }

  /// The writing task's name, by its rubric.
  var promptLabel: String {
    switch self {
    case .ap:
      String(
        localized: "Free response · AP scoring guidelines", table: "Essay",
        comment: "An AP free response task")
    case .enem:
      String(localized: "Essay · ENEM rubric", table: "Essay", comment: "An ENEM essay task")
    case .custom, .oab:
      String(localized: "Writing practice", table: "Essay", comment: "A writing task")
    }
  }

  /// What the texts to read before writing are, in the exam's own words where it has some.
  var textsLabel: String {
    switch self {
    case .ap, .custom:
      String(localized: "Supporting texts", table: "Essay", comment: "Texts to read first")
    case .enem:
      String(localized: "Motivating texts", table: "Essay", comment: "ENEM's texts to read first")
    case .oab:
      String(localized: "The case", table: "Essay", comment: "OAB's case to read first")
    }
  }
}

extension EssayGrade.InterventionElements {
  /// ENEM's five elements of the intervention proposal, in order, each present or not.
  var named: [(name: String, present: Bool)] {
    [
      (String(localized: "Who acts", table: "Essay", comment: "ENEM proposal element"), agent),
      (String(localized: "What they do", table: "Essay", comment: "ENEM proposal element"), action),
      (String(localized: "By what means", table: "Essay", comment: "ENEM proposal element"), means),
      (String(localized: "To what end", table: "Essay", comment: "ENEM proposal element"), effect),
      (String(localized: "A detail", table: "Essay", comment: "ENEM proposal element"), detail),
    ]
  }
}
