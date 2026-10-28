import Foundation

/// Where a challenge's picks lead, walked the way core's `walkChallenge` does, so the device and
/// the server agree on where a path ends.
enum ChallengeWalk: Hashable, Sendable {
  struct Decision: Hashable, Sendable {
    let node: ChallengeContent.Node
    let choice: ChallengeContent.Choice
  }

  case deciding(node: ChallengeContent.Node, decisions: [Decision])
  case ended(ending: ChallengeContent.Ending, decisions: [Decision])
  /// A pick that isn't on its screen, or a path that goes on past an ending.
  case invalid

  init(_ content: ChallengeContent, choiceIds: [String]) {
    var nodeId = content.startNodeId
    var decisions: [Decision] = []
    var remaining = choiceIds[...]

    while true {
      if let ending = content.endings.first(where: { $0.id == nodeId }),
        content.nodes.allSatisfy({ $0.id != nodeId })
      {
        self = remaining.isEmpty ? .ended(ending: ending, decisions: decisions) : .invalid
        return
      }

      guard let node = content.nodes.first(where: { $0.id == nodeId }) else {
        self = .invalid
        return
      }

      guard let choiceId = remaining.popFirst() else {
        self = .deciding(node: node, decisions: decisions)
        return
      }

      guard let choice = node.choices.first(where: { $0.id == choiceId }) else {
        self = .invalid
        return
      }

      decisions.append(Decision(node: node, choice: choice))
      nodeId = choice.next
    }
  }

  var decisions: [Decision] {
    switch self {
    case .deciding(_, let decisions), .ended(_, let decisions): decisions
    case .invalid: []
    }
  }

  /// Strong decisions count 1, fair ones half and weak ones 0.
  static func score(_ decisions: [Decision]) -> Double {
    guard !decisions.isEmpty else {
      return 0
    }

    let total = decisions.reduce(0.0) { sum, decision in
      switch decision.choice.quality {
      case .strong: sum + 1
      case .fair: sum + 0.5
      case .weak: sum
      }
    }

    return total / Double(decisions.count)
  }

  /// A finished path is right when at least half its decisions were good; every path ends, so the
  /// learner always finishes the case.
  static func grade(_ content: ChallengeContent, choiceIds: [String]) -> LocalGrade? {
    guard case .ended(let ending, let decisions) = ChallengeWalk(content, choiceIds: choiceIds)
    else {
      return nil
    }

    return LocalGrade(
      isCorrect: score(decisions) >= 0.5,
      answerText: decisions.map(\.choice.text).joined(separator: " → "),
      correctAnswer: nil,
      feedback: ending.outcome)
  }

  /// Each meter after the decisions so far, between 0 and 100, with how the last one moved it.
  static func meters(_ content: ChallengeContent, decisions: [Decision]) -> [(
    meter: ChallengeContent.Meter, value: Int, change: Int
  )] {
    content.meters.map { meter in
      let value = decisions.reduce(meter.start) { current, decision in
        let change = decision.choice.effects.first { $0.meter == meter.id }?.change ?? 0
        return min(100, max(0, current + change))
      }

      let change = decisions.last?.choice.effects.first { $0.meter == meter.id }?.change ?? 0
      return (meter, value, change)
    }
  }
}

/// Where a challenge screen stands. `shown` counts what's on screen: 0 is the intro, and each
/// confirmed decision shows one more. The answer holds the confirmed picks plus, while deciding,
/// the pick waiting for Confirm.
enum ChallengeProgress: Hashable, Sendable {
  case intro
  case deciding(
    node: ChallengeContent.Node, confirmed: [String], decisions: [ChallengeWalk.Decision],
    pendingChoiceId: String?)
  case ended(
    ending: ChallengeContent.Ending, confirmed: [String], decisions: [ChallengeWalk.Decision])

  init(content: ChallengeContent, picks: [String], shown: Int) {
    guard shown > 0 else {
      self = .intro
      return
    }

    let confirmed = Array(picks.prefix(shown - 1))

    switch ChallengeWalk(content, choiceIds: confirmed) {
    case .ended(let ending, let decisions):
      self = .ended(ending: ending, confirmed: confirmed, decisions: decisions)
    case .deciding(let node, let decisions):
      let pending = picks.count >= shown ? picks[shown - 1] : nil
      let isOnScreen = node.choices.contains { $0.id == pending }
      self = .deciding(
        node: node, confirmed: confirmed, decisions: decisions,
        pendingChoiceId: isOnScreen ? pending : nil)
    case .invalid:
      self = .intro
    }
  }
}
