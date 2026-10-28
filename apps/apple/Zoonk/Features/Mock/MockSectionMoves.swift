import Foundation

/// How the running section lets the learner move, as the notice says: a forward-only section opens
/// one question after another and never an earlier one, until the review at its end (when the
/// notice gives one), which changes only so many answers; `mustAnswer` asks for an answer before
/// moving on, and `itemSeconds` gives each question its own clock.
struct MockSectionMoves: Equatable {
  /// Whether the current answer lets the learner move on or hand in.
  var canAdvance: Bool
  /// The answers the review may still change; nil outside a review or without a limit.
  var changesLeft: Int?
  var forwardOnly: Bool
  var itemSeconds: Int?
  var mustAnswer: Bool
  /// In a forward-only section's review, once its last question is reached.
  var reviewing: Bool

  private var changed: [Int]
  private var position: Int
  private var reached: Int
  private var total: Int

  /// - Parameters:
  ///   - answered: whether the current question has an answer.
  ///   - changed: the questions the review changed already, which change again for free.
  ///   - changesLeft: the review's changes the server still allows, before this screen's.
  ///   - reached: the furthest question opened in the section.
  init(
    answered: Bool, changed: [Int], changesLeft: Int?, navigation: MockSection.Navigation?,
    position: Int, reached: Int, total: Int
  ) {
    forwardOnly = navigation?.forwardOnly ?? false
    mustAnswer = navigation?.mustAnswer ?? false
    reviewing = forwardOnly && navigation?.answerChanges != nil && reached >= total - 1
    self.changesLeft = reviewing ? changesLeft.map { max(0, $0 - changed.count) } : nil
    canAdvance = !mustAnswer || answered || (reviewing && position < reached)
    itemSeconds = reviewing ? nil : navigation?.itemSeconds
    self.changed = changed
    self.position = position
    self.reached = reached
    self.total = total
  }

  private func canReach(_ target: Int) -> Bool {
    target >= 0 && target < total
      && (!forwardOnly || reviewing || target == reached || target == reached + 1)
  }

  /// Whether a question can be opened now: the next one only, in a forward-only section.
  func canOpen(_ target: Int) -> Bool {
    canReach(target) && (target == position || canAdvance)
  }

  /// A question's clock running out opens only the next question, answered or not.
  func canOpenAfterTimeout(_ target: Int) -> Bool {
    target == position + 1 && canReach(target)
  }

  /// Whether a question's answer can change now: one left behind can't, but in the review.
  func canChange(_ target: Int) -> Bool {
    !forwardOnly || target >= reached || changed.contains(target) || (changesLeft ?? 0) > 0
  }
}
