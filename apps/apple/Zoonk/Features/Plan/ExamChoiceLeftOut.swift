import Foundation

/// What the plan and mocks leave out while an exam's choice is unpicked: the test its options make up
/// (a specialty's own test) or the choice itself. Each count is nil when the notice doesn't say.
/// The screens say only that picking brings it in: the counts read as bookkeeping.
struct ExamChoiceLeftOut: Decodable, Hashable, Sendable {
  let examPoints: Int?
  let examQuestions: Int?
  let name: String
  let points: Int?
  let questions: Int?

  /// Under the question of which option the learner takes; until they pick, the plan has none.
  var line: String {
    String(
      localized: "Pick one so your plan includes it.", table: "Plan",
      comment:
        "Under a question asking which option of an exam the learner will take, such as its foreign language. Until they pick, their plan has none of the options."
    )
  }
}
