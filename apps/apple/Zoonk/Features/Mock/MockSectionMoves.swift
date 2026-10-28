import Foundation

/// As the notice says: a forward-only section never reopens an earlier question until the review at
/// its end, which changes only so many answers.
struct MockSectionMoves: Equatable {
  var canAdvance: Bool
  /// The answers the review may still change; nil outside a review or without a limit.
  var changesLeft: Int?
  var forwardOnly: Bool
  var itemSeconds: Int?
  var mustAnswer: Bool
  var reviewing: Bool

  private var changed: [Int]
  private var position: Int
  private var reached: Int
  private var total: Int

  /// - Parameters:
  ///   - changed: the questions the review changed already, which change again for free.
  ///   - changesLeft: the review's changes the server still allows, before this screen's.
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

  func canOpen(_ target: Int) -> Bool {
    canReach(target) && (target == position || canAdvance)
  }

  func canOpenAfterTimeout(_ target: Int) -> Bool {
    target == position + 1 && canReach(target)
  }

  func canChange(_ target: Int) -> Bool {
    !forwardOnly || target >= reached || changed.contains(target) || (changesLeft ?? 0) > 0
  }
}
