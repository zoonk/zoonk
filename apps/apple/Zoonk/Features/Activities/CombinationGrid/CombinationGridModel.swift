import Foundation

struct CombinationGridFields: Decodable, Hashable, Sendable {
  struct Side: Decodable, Hashable, Sendable {
    let label: String
    /// Alleles ("P", "p") or numbers, as text the way main writes them ("7", "2.5").
    let values: [String]

    private enum CodingKeys: String, CodingKey {
      case label, values
    }

    init(from decoder: any Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      label = try container.decode(String.self, forKey: .label)
      values = try container.decode([JSONValue].self, forKey: .values).map { value in
        switch value {
        case .number(let number): CombinationGrid.text(number)
        case .string(let text): text
        default: ""
        }
      }
    }
  }

  struct Traits: Decodable, Hashable, Sendable {
    let dominant: String
    let recessive: String
  }

  /// "alleles", "sum" or "product".
  let rule: String
  let title: String
  let rows: Side
  let columns: Side
  let traits: Traits?

  var isAllele: Bool { rule == "alleles" }
}

/// Mirrors core's `combination-grid` template and main's `grid-model`.
enum CombinationGrid {
  /// Past this many cells, filling every one by hand is busywork: the grid is shown filled.
  static let maxFilledCells = 9

  static func cells(_ fields: CombinationGridFields) -> [String] {
    fields.rows.values.flatMap { row in
      fields.columns.values.map { column in combine(fields, row: row, column: column) }
    }
  }

  static func isFillable(_ fields: CombinationGridFields) -> Bool {
    cells(fields).count <= maxFilledCells
  }

  private static func combine(_ fields: CombinationGridFields, row: String, column: String)
    -> String
  {
    switch fields.rule {
    case "alleles": return genotype(row, column)
    case "sum": return text((Double(row) ?? 0) + (Double(column) ?? 0))
    default: return text((Double(row) ?? 0) * (Double(column) ?? 0))
    }
  }

  /// Writes a genotype the standard way, dominant allele first: "pP" becomes "Pp".
  static func genotype(_ first: String, _ second: String) -> String {
    [first, second].sorted().joined()
  }

  /// A genotype shows the dominant trait when it has at least one uppercase allele.
  static func isDominant(_ cell: String) -> Bool {
    cell != cell.lowercased()
  }

  /// Whether a cell counts toward a check's `output`: "dominant", "recessive", a genotype like "Pp",
  /// or a cell value like "7".
  static func cellMatches(_ cell: String, output: String) -> Bool {
    if output == "dominant" {
      return isDominant(cell)
    }

    if output == "recessive" {
      return !isDominant(cell)
    }

    if output.count == 2, output.allSatisfy({ $0.isASCII && $0.isLetter }) {
      return cell == genotype(String(output.prefix(1)), String(output.suffix(1)))
    }

    guard let number = Double(output), let value = Double(cell) else {
      return false
    }

    return abs(value - number) <= 1e-9 * max(1, abs(number))
  }

  static func options(_ fields: CombinationGridFields) -> [String] {
    if fields.isAllele {
      let letter = fields.rows.values.first ?? ""
      let (dominant, recessive) = (letter.uppercased(), letter.lowercased())
      return [dominant + dominant, genotype(dominant, recessive), recessive + recessive]
    }

    return Array(Set(cells(fields))).sorted { (Double($0) ?? 0) < (Double($1) ?? 0) }
  }

  /// Whether two cell values are the same: genotypes in either order, numbers as written.
  static func same(_ first: String, _ second: String) -> Bool {
    ActivityExpectedAnswer.cellKey(first) == ActivityExpectedAnswer.cellKey(second)
  }

  static func nextEmpty(_ fill: [String?], after: Int?) -> Int? {
    let start = after.map { $0 + 1 } ?? 0
    return fill.indices.map { (start + $0) % fill.count }.first { fill[$0] == nil }
  }

  /// What the check counts: its `output`, or the recessive trait on a Punnett grid.
  static func output(_ fields: CombinationGridFields, check: ActivityCheck?) -> String? {
    let fallback = fields.isAllele ? "recessive" : nil

    switch check {
    case .choice(_, _, _, let output), .numeric(_, _, _, _, _, _, let output):
      return output ?? fallback
    default:
      return fallback
    }
  }

  /// The share of cells that count toward `output`, or nil while any cell is empty.
  static func share(_ fill: [String?], output: String) -> Double? {
    let cells = fill.compactMap(\.self)

    guard cells.count == fill.count, !cells.isEmpty else {
      return nil
    }

    return Double(cells.filter { cellMatches($0, output: output) }.count) / Double(cells.count)
  }

  /// A number as JavaScript's `String(number)` writes it: "7", "2.5", "-3".
  static func text(_ number: Double) -> String {
    number.rounded() == number && abs(number) < 1e15
      ? String(Int(number)) : String(number)
  }
}
