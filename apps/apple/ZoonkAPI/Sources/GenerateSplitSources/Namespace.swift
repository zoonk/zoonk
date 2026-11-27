import Foundation

struct Namespace {
  let file: String
  let opening: String
  let memberIndent: String
  let shardOpening: String
  var movedDeclaration: String?
  var usedByMovedDeclarations: [String] = []

  static let all = [
    Namespace(
      file: "Types+Components+Schemas.swift",
      opening: "    public enum Schemas {",
      memberIndent: "        ",
      shardOpening: "extension Components.Schemas {"),
    Namespace(
      file: "Types+Operations.swift",
      opening: "public enum Operations {",
      memberIndent: "    ",
      shardOpening: "extension Operations {"),
    Namespace(
      file: "Client.swift",
      opening: "public struct Client: APIProtocol {",
      memberIndent: "    ",
      shardOpening: "extension Client {",
      movedDeclaration: "public func ",
      usedByMovedDeclarations: [
        "let client: UniversalClient",
        "var converter: Converter",
      ]),
  ]

  func isShard(_ url: URL) -> Bool {
    url.lastPathComponent.hasPrefix(file.dropLast(".swift".count) + "+")
  }

  func split(_ source: String, into count: Int) throws -> (kept: String, shards: [String]) {
    var lines = source.split(separator: "\n", omittingEmptySubsequences: false)[...]

    while lines.last?.isEmpty == true {
      lines = lines.dropLast()
    }

    let closingCount = memberIndent.count / 4

    guard
      let lastImport = lines.lastIndex(where: isImport),
      let openingIndex = lines.firstIndex(where: { $0 == opening }),
      lines.count - closingCount > openingIndex
    else {
      throw Failure("\(file) no longer has the layout this splits. Expected `\(opening)`.")
    }

    let preamble = lines[...lastImport]
    let closing = lines.suffix(closingCount)
    let members = try members(in: lines[(openingIndex + 1)..<closing.startIndex])
    var kept = Array(lines[...openingIndex])
    var shards = Array(repeating: Array(preamble) + [Substring(shardOpening)], count: count)

    for member in members {
      if movedDeclaration.map({ member.declaration.hasPrefix($0) }) ?? true {
        shards[Int(stableHash(member.declaration) % UInt64(count))] += member.lines
      } else {
        kept += member.lines
      }
    }

    var keptSource = (kept + closing).joined(separator: "\n") + "\n"

    for declaration in usedByMovedDeclarations {
      guard keptSource.contains("private \(declaration)") else {
        throw Failure("\(file) no longer declares `private \(declaration)`.")
      }

      keptSource = keptSource.replacingOccurrences(of: "private \(declaration)", with: declaration)
    }

    return (keptSource, shards.map { ($0 + ["}"]).joined(separator: "\n") + "\n" })
  }

  private func isImport(_ line: Substring) -> Bool {
    !line.hasPrefix(" ") && !line.hasPrefix("/") && line.contains("import ")
  }

  private func members(
    in body: ArraySlice<Substring>
  ) throws -> [(declaration: Substring, lines: ArraySlice<Substring>)] {
    var members: [(declaration: Substring, lines: ArraySlice<Substring>)] = []
    var start = body.startIndex
    var declaration: Substring?

    for index in body.indices {
      let line = body[index].dropFirst(memberIndent.count)

      guard body[index].hasPrefix(memberIndent), !line.hasPrefix(" ") else {
        continue
      }

      if declaration == nil {
        if line.hasPrefix("//") || (line.hasPrefix("@") && !line.hasSuffix("{")) {
          continue
        }

        declaration = line
      }

      let opensBlock = line.hasSuffix("{") || line.hasSuffix("(")

      if let declared = declaration, line == "}" || (line == declared && !opensBlock) {
        members.append((declared, body[start...index]))
        start = index + 1
        declaration = nil
      }
    }

    guard start == body.endIndex else {
      throw Failure("\(file) has a declaration this couldn't find the end of.")
    }

    return members
  }
}

/// Swift's own hashing changes between runs, which would move declarations between files.
private func stableHash(_ text: Substring) -> UInt64 {
  text.utf8.reduce(14_695_981_039_346_656_037) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
}
