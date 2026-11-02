import Foundation

/// What the plan and mocks leave out while an exam's choice is unpicked: the test its options make up
/// (a specialty's own test) or the choice itself. Each count is nil when the notice doesn't say.
struct ExamChoiceLeftOut: Decodable, Hashable, Sendable {
  let examPoints: Int?
  let examQuestions: Int?
  let name: String
  let points: Int?
  let questions: Int?

  var line: String {
    if let points, let examPoints {
      return String(
        localized:
          "Until you pick, your plan and mocks leave out \(name): \(points) of the exam's \(examPoints) points.",
        table: "Plan",
        comment:
          "The first argument is a part of the exam, such as a specialty's own test or a foreign language, that the plan skips until the learner picks an option; the numbers are points of the exam's score"
      )
    }

    if let questions, let examQuestions {
      return String(
        localized:
          "Until you pick, your plan and mocks leave out \(name): \(questions) of the exam's \(examQuestions) questions.",
        table: "Plan",
        comment:
          "The first argument is a part of the exam, such as a specialty's own test or a foreign language, that the plan skips until the learner picks an option"
      )
    }

    if let questions {
      return String(
        localized: "Until you pick, your plan and mocks leave out \(name): \(questions) questions.",
        table: "Plan",
        comment:
          "The first argument is a part of the exam, such as a specialty's own test or a foreign language, that the plan skips until the learner picks an option"
      )
    }

    return String(
      localized: "Until you pick, your plan and mocks leave out \(name).", table: "Plan",
      comment:
        "The argument is a part of the exam, such as a specialty's own test or a foreign language, that the plan skips until the learner picks an option"
    )
  }
}
