import Foundation

/// Mirrors core's `computeExpected` and `matchesExpectedAnswer`, so the app and the server agree.
enum ActivityExpectedAnswer: Hashable, Sendable {
  struct Link: Codable, Hashable, Sendable {
    let from: String
    let to: String
  }

  case assignment([String: String])
  case order([String])
  case selection([String])
  case links([Link])
  case grid([String])

  func matches(_ answer: ActivityAnswer) -> Bool {
    switch self {
    case .assignment(let pairs):
      return answer.kind == "assignment" && answer.pairs == pairs
    case .order(let ids):
      return answer.kind == "order" && answer.ids == ids
    case .selection(let ids):
      return answer.kind == "selection" && answer.ids.map { $0.sorted() } == ids.sorted()
    case .links(let links):
      guard answer.kind == "links", let answered = answer.links else {
        return false
      }

      return answered.count == links.count && Set(answered) == Set(links)
    case .grid(let cells):
      return answer.kind == "grid"
        && answer.cells.map { $0.map(Self.cellKey) } == cells.map(Self.cellKey)
    }
  }

  /// Genotypes compare with the dominant allele first, however the learner ordered the pair;
  /// numbers compare as written.
  static func cellKey(_ cell: String) -> String {
    let trimmed = cell.trimmingCharacters(in: .whitespacesAndNewlines)
    let isLetters = !trimmed.isEmpty && trimmed.allSatisfy { $0.isASCII && $0.isLetter }
    return isLetters ? String(trimmed.sorted()) : trimmed
  }

  /// Content whose fields don't decode is never right.
  static func grader<Fields: Decodable & Sendable>(
    _ type: Fields.Type, expected: @escaping @Sendable (Fields) -> ActivityExpectedAnswer?
  ) -> @Sendable (ActivityStepContent, ActivityAnswer) -> Bool {
    { content, answer in
      guard let fields = try? content.fields(as: Fields.self), let expected = expected(fields)
      else {
        return false
      }

      return expected.matches(answer)
    }
  }
}

extension ActivityAnswer {
  static func assignment(_ pairs: [String: String]) -> ActivityAnswer {
    ActivityAnswer(
      value: .object([
        "kind": .string("assignment"), "pairs": .object(pairs.mapValues(JSONValue.string)),
      ]))
  }

  static func order(_ ids: [String]) -> ActivityAnswer {
    ActivityAnswer(
      value: .object(["kind": .string("order"), "ids": .array(ids.map(JSONValue.string))]))
  }

  static func selection(_ ids: [String]) -> ActivityAnswer {
    ActivityAnswer(
      value: .object(["kind": .string("selection"), "ids": .array(ids.map(JSONValue.string))]))
  }

  static func links(_ links: [ActivityExpectedAnswer.Link]) -> ActivityAnswer {
    ActivityAnswer(
      value: .object([
        "kind": .string("links"),
        "links": .array(
          links.map { .object(["from": .string($0.from), "to": .string($0.to)]) }),
      ]))
  }

  static func grid(_ cells: [String]) -> ActivityAnswer {
    ActivityAnswer(
      value: .object(["kind": .string("grid"), "cells": .array(cells.map(JSONValue.string))]))
  }

  var pairs: [String: String]? {
    guard case .object(let object) = value["pairs"] else {
      return nil
    }

    return object.compactMapValues { if case .string(let text) = $0 { text } else { nil } }
  }

  var ids: [String]? {
    strings(at: "ids")
  }

  var cells: [String]? {
    strings(at: "cells")
  }

  var links: [ActivityExpectedAnswer.Link]? {
    guard case .array(let items) = value["links"] else {
      return nil
    }

    return items.compactMap { item in
      guard case .string(let from) = item["from"], case .string(let to) = item["to"] else {
        return nil
      }

      return ActivityExpectedAnswer.Link(from: from, to: to)
    }
  }

  private func strings(at key: String) -> [String]? {
    guard case .array(let items) = value[key] else {
      return nil
    }

    return items.compactMap { if case .string(let text) = $0 { text } else { nil } }
  }
}
