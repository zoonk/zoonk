import Foundation

struct DecisionTreeFields: Decodable, Hashable, Sendable {
  struct Branch: Decodable, Hashable, Sendable {
    let label: String
    let next: String
  }

  struct Question: Hashable, Sendable {
    let id: String
    let question: String
    let branches: [Branch]
  }

  struct Outcome: Hashable, Sendable {
    let id: String
    let label: String
  }

  enum Node: Decodable, Hashable, Sendable {
    case question(Question)
    case outcome(Outcome)

    private enum CodingKeys: String, CodingKey {
      case branches, id, kind, label, question
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      let id = try container.decode(String.self, forKey: .id)

      if try container.decode(String.self, forKey: .kind) == "question" {
        self = .question(
          Question(
            id: id, question: try container.decode(String.self, forKey: .question),
            branches: try container.decode([Branch].self, forKey: .branches)))
      } else {
        self = .outcome(Outcome(id: id, label: try container.decode(String.self, forKey: .label)))
      }
    }

    var id: String {
      switch self {
      case .question(let question): question.id
      case .outcome(let outcome): outcome.id
      }
    }
  }

  struct Case: Decodable, Hashable, Sendable {
    struct Answer: Decodable, Hashable, Sendable {
      let branch: String
      let nodeId: String
    }

    let answers: [Answer]
    let description: String
    let outcomeId: String
  }

  let `case`: Case
  let nodes: [Node]
  let rootId: String

  func node(_ id: String?) -> Node? {
    nodes.first { $0.id == id }
  }
}

/// Mirrors core's `walkCase` and main's `decision-tree-walk`.
enum DecisionTreeWalk {
  struct Step: Hashable {
    let question: String
    let branch: String
  }

  /// Walks the tree the way the case answers each question: the node ids visited, ending at an
  /// outcome, or nil when an answer is missing or the walk loops.
  static func casePath(_ fields: DecisionTreeFields) -> [String]? {
    var path = [fields.rootId]

    while path.count <= fields.nodes.count, let node = fields.node(path.last) {
      guard case .question(let question) = node else {
        return path
      }

      let answer = fields.case.answers.first { $0.nodeId == question.id }
      guard let next = question.branches.first(where: { $0.label == answer?.branch })?.next else {
        return nil
      }

      path.append(next)
    }

    return nil
  }

  static func reachableOutcomes(_ fields: DecisionTreeFields, from id: String)
    -> [DecisionTreeFields.Outcome]
  {
    reachableOutcomes(fields, from: id, depth: 0)
  }

  private static func reachableOutcomes(
    _ fields: DecisionTreeFields, from id: String, depth: Int
  ) -> [DecisionTreeFields.Outcome] {
    guard depth <= fields.nodes.count, let node = fields.node(id) else {
      return []
    }

    switch node {
    case .outcome(let outcome):
      return [outcome]
    case .question(let question):
      return question.branches.flatMap {
        reachableOutcomes(fields, from: $0.next, depth: depth + 1)
      }
    }
  }

  static func steps(_ fields: DecisionTreeFields, path: [String]) -> [Step] {
    zip(path, path.dropFirst()).compactMap { id, next in
      guard case .question(let question)? = fields.node(id),
        let branch = question.branches.first(where: { $0.next == next })
      else {
        return nil
      }

      return Step(question: question.question, branch: branch.label)
    }
  }

  /// Where a walk first left the expected path, as an index into the paths; nil when it didn't.
  static func firstDivergence(expected: [String], walked: [String]) -> Int? {
    if let index = expected.indices.first(where: {
      $0 >= walked.count || walked[$0] != expected[$0]
    }) {
      return index
    }

    return walked.count > expected.count ? expected.count : nil
  }
}
