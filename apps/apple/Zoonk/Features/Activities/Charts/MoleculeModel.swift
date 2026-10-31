import Foundation

struct MoleculeBuilderFields: Decodable, Hashable, Sendable {
  let elements: [String]
  let formula: String
}

/// A build as the API takes it: atoms with ids and bonds between them (core's `molecule` answer).
struct MoleculeBuild: Codable, Hashable, Sendable {
  struct Atom: Codable, Hashable, Sendable {
    let element: String
    let id: String
  }

  struct Bond: Codable, Hashable, Sendable {
    let from: String
    var order: Int
    let to: String
  }

  var kind = "molecule"
  var atoms: [Atom] = []
  var bonds: [Bond] = []

  static let empty = MoleculeBuild()
}

/// Mirrors core's `chemistry.ts` and `molecule-structure.ts` and main's `molecule-model.ts`.
enum MoleculeModel {
  static let maxBondOrder = 3

  private static let valence: [String: Int] = [
    "B": 3, "Br": 1, "C": 4, "Cl": 1, "F": 1, "H": 1, "I": 1, "N": 3, "O": 2, "P": 3, "S": 2,
    "Si": 4,
  ]

  static func valence(of element: String) -> Int { valence[element] ?? 0 }

  /// Reads "CO2" or "C6H12O6" into element counts, in the formula's order; nil when it isn't one.
  static func parse(_ formula: String) -> [(element: String, count: Int)]? {
    let matches = formula.matches(of: /([A-Z][a-z]?)(\d*)/)

    guard !matches.isEmpty, matches.map({ String($0.output.0) }).joined() == formula else {
      return nil
    }

    var counts: [(element: String, count: Int)] = []

    for match in matches {
      let element = String(match.output.1)
      let count = Int(match.output.2) ?? 1

      if let index = counts.firstIndex(where: { $0.element == element }) {
        counts[index].count += count
      } else {
        counts.append((element, count))
      }
    }

    return counts
  }

  /// The number of bonds a complete build has, counting a double bond as two.
  static func bondCount(_ counts: [(element: String, count: Int)]) -> Int {
    counts.reduce(0) { $0 + valence(of: $1.element) * $1.count } / 2
  }

  static func bondsUsed(_ build: MoleculeBuild, _ id: String) -> Int {
    build.bonds.filter { $0.from == id || $0.to == id }.reduce(0) { $0 + $1.order }
  }

  static func bondOrder(_ build: MoleculeBuild, _ first: String, _ second: String) -> Int {
    build.bonds.first { Set([$0.from, $0.to]) == Set([first, second]) }?.order ?? 0
  }

  /// A build is right when it has exactly the formula's atoms, every atom has all its bonds and
  /// nothing floats apart. Any valid structure passes, so isomers are never marked wrong.
  static func isComplete(_ build: MoleculeBuild, _ counts: [(element: String, count: Int)]) -> Bool
  {
    var built: [String: Int] = [:]
    for atom in build.atoms {
      built[atom.element, default: 0] += 1
    }

    let sameAtoms =
      built.count == counts.count && counts.allSatisfy { built[$0.element] == $0.count }
    let ids = Set(build.atoms.map(\.id))
    let pairs = build.bonds.map { [$0.from, $0.to].sorted().joined(separator: "|") }
    let validBonds =
      ids.count == build.atoms.count && Set(pairs).count == pairs.count
      && build.bonds.allSatisfy {
        $0.from != $0.to && ids.contains($0.from) && ids.contains($0.to) && $0.order >= 1
          && $0.order <= maxBondOrder
      }

    guard sameAtoms, validBonds, let first = build.atoms.first else {
      return false
    }

    let filled = build.atoms.allSatisfy { bondsUsed(build, $0.id) == valence(of: $0.element) }
    var reached: Set<String> = [first.id]
    var grew = true

    while grew {
      let next = reached.union(
        build.bonds.flatMap { bond in
          reached.contains(bond.from) ? [bond.to] : reached.contains(bond.to) ? [bond.from] : []
        })
      grew = next.count > reached.count
      reached = next
    }

    return filled && reached.count == build.atoms.count
  }

  static func formulaText(_ counts: [(element: String, count: Int)]) -> String {
    let subscripts = Array("₀₁₂₃₄₅₆₇₈₉")

    return counts.filter { $0.count > 0 }.map { item in
      let digits =
        item.count == 1
        ? "" : String(String(item.count).compactMap { $0.wholeNumberValue.map { subscripts[$0] } })
      return item.element + digits
    }.joined()
  }

  static func builtCounts(_ build: MoleculeBuild, order: [String]) -> [(
    element: String, count: Int
  )] {
    var elements = order.filter { element in build.atoms.contains { $0.element == element } }
    elements += build.atoms.map(\.element).filter { !elements.contains($0) }.reduce(into: []) {
      if !$0.contains($1) { $0.append($1) }
    }
    return elements.map { element in (element, build.atoms.filter { $0.element == element }.count) }
  }

  /// Adds an atom, bonded once to `bondTo` when an atom is selected, which is how builds grow.
  static func add(_ element: String, to build: MoleculeBuild, bondTo: String?) -> (
    MoleculeBuild, String
  ) {
    let prefix = element.lowercased()
    let taken = Set(build.atoms.map(\.id))
    let number =
      (1...(build.atoms.count + 1)).first { !taken.contains("\(prefix)\($0)") } ?? build.atoms.count
      + 1
    let id = "\(prefix)\(number)"
    var next = build
    next.atoms.append(.init(element: element, id: id))

    if let bondTo {
      next.bonds.append(.init(from: bondTo, order: 1, to: id))
    }

    return (next, id)
  }

  static func remove(_ id: String, from build: MoleculeBuild) -> MoleculeBuild {
    var next = build
    next.atoms.removeAll { $0.id == id }
    next.bonds.removeAll { $0.from == id || $0.to == id }
    return next
  }

  /// Tapping two atoms steps their bond: none, single, double, triple, then none again.
  static func stepBond(_ build: MoleculeBuild, _ first: String, _ second: String) -> MoleculeBuild {
    let order = (bondOrder(build, first, second) + 1) % (maxBondOrder + 1)
    var next = build
    next.bonds.removeAll { Set([$0.from, $0.to]) == Set([first, second]) }

    if order > 0 {
      next.bonds.append(.init(from: first, order: order, to: second))
    }

    return next
  }

  /// One complete structure for the formula, found by a bounded search that grows a backbone from
  /// the atoms with the most bonds; nil past the search budget.
  static func findStructure(_ counts: [(element: String, count: Int)]) -> MoleculeBuild? {
    let atoms = counts.sorted { first, second in
      valence(of: first.element) != valence(of: second.element)
        ? valence(of: first.element) > valence(of: second.element) : first.element < second.element
    }
    .flatMap { item in
      (1...max(item.count, 1)).prefix(item.count).map {
        (element: item.element, id: "\(item.element.lowercased())\($0)")
      }
    }

    guard !atoms.isEmpty, atoms.allSatisfy({ valence(of: $0.element) > 0 }) else {
      return nil
    }

    var budget = 20_000
    let start = atoms.map { valence(of: $0.element) }

    func key(_ a: Int, _ b: Int) -> Int { min(a, b) * 1000 + max(a, b) }

    func component(_ bonds: [Int: Int], from index: Int) -> Set<Int> {
      var reached: Set<Int> = [index]
      var grew = true

      while grew {
        let next = reached.union(
          bonds.keys.flatMap { pair -> [Int] in
            let (a, b) = (pair / 1000, pair % 1000)
            return reached.contains(a) ? [b] : reached.contains(b) ? [a] : []
          })
        grew = next.count > reached.count
        reached = next
      }

      return reached
    }

    func search(_ bonds: [Int: Int], _ remaining: [Int]) -> [Int: Int]? {
      guard budget > 0 else { return nil }
      budget -= 1

      guard let index = remaining.firstIndex(where: { $0 > 0 }) else {
        return component(bonds, from: 0).count == atoms.count ? bonds : nil
      }

      let reached = component(bonds, from: index)
      let isUntouched = { (atom: Int) in remaining[atom] == start[atom] }
      let open = atoms.indices.filter {
        $0 != index && remaining[$0] > 0 && (bonds[key(index, $0)] ?? 0) < maxBondOrder
      }
      let candidates = open.filter { atom in
        !open.contains { earlier in
          earlier < atom && isUntouched(atom) && isUntouched(earlier)
            && atoms[earlier].element == atoms[atom].element
        }
      }
      .enumerated()
      .sorted { first, second in
        let (a, b) = (first.element, second.element)
        if reached.contains(a) != reached.contains(b) { return !reached.contains(a) }
        if remaining[a] != remaining[b] { return remaining[a] > remaining[b] }
        return first.offset < second.offset
      }
      .map(\.element)

      for atom in candidates {
        var nextBonds = bonds
        nextBonds[key(index, atom), default: 0] += 1
        var nextRemaining = remaining
        nextRemaining[index] -= 1
        nextRemaining[atom] -= 1

        if let found = search(nextBonds, nextRemaining) {
          return found
        }
      }

      return nil
    }

    guard let found = search([:], start) else {
      return nil
    }

    return MoleculeBuild(
      atoms: atoms.map { .init(element: $0.element, id: $0.id) },
      bonds: found.sorted { $0.key < $1.key }.map { pair, order in
        .init(from: atoms[pair / 1000].id, order: order, to: atoms[pair % 1000].id)
      })
  }

  struct Point: Hashable {
    var x: Double
    var y: Double
  }

  static let size = (width: 320.0, height: 240.0)
  private static let bondLength = 68.0
  private static let margin = 33.0

  private static func clampToCanvas(_ point: Point) -> Point {
    Point(
      x: ChartsMath.clamp(point.x, margin, max(margin, size.width - margin)),
      y: ChartsMath.clamp(point.y, margin, max(margin, size.height - margin)))
  }

  private static func distance(_ a: Point, _ b: Point) -> Double { hypot(b.x - a.x, b.y - a.y) }

  /// The candidate farthest from every other atom; ties go to the one listed first.
  private static func roomiest(_ candidates: [Point], others: [Point]) -> Point {
    let room = { (point: Point) in
      others.isEmpty ? 0 : others.map { distance(point, $0) }.min() ?? 0
    }
    return candidates.dropFirst().reduce(candidates[0]) { best, point in
      room(point) > room(best) + 1 ? point : best
    }
  }

  static func place(anchor: String?, layout: [String: Point]) -> Point {
    let center = Point(x: size.width / 2, y: size.height / 2)
    let others = layout.filter { $0.key != anchor }.sorted { $0.key < $1.key }.map(\.value)

    guard let anchor, let from = layout[anchor] else {
      guard !others.isEmpty else {
        return center
      }

      let columns = max(Int((size.width - margin * 2) / 24), 1)
      let rows = max(Int((size.height - margin * 2) / 24), 1)
      let grid = (0..<((columns + 1) * (rows + 1))).map { index in
        Point(
          x: margin + Double(index % (columns + 1)) * 24,
          y: margin + Double(index / (columns + 1)) * 24)
      }
      .enumerated()
      .sorted { first, second in
        let (a, b) = (distance(first.element, center), distance(second.element, center))
        return a != b ? a < b : first.offset < second.offset
      }
      .map(\.element)

      return roomiest(grid, others: others)
    }

    let around = (0..<12).map { index in
      let angle = Double(index) / 12 * 2 * .pi
      return clampToCanvas(
        Point(x: from.x + bondLength * cos(angle), y: from.y + bondLength * sin(angle)))
    }

    return roomiest(around, others: others.isEmpty ? [center] : others)
  }

  static func relax(_ layout: [String: Point], bonds: [MoleculeBuild.Bond]) -> [String: Point] {
    let ids = layout.keys.sorted()
    let pairs = Set(bonds.map { [$0.from, $0.to].sorted().joined(separator: "|") })
    var current = layout

    for _ in 0..<160 {
      var next = current

      for (index, id) in ids.enumerated() {
        guard let point = current[id] else { continue }
        var force = (x: 0.0, y: 0.0)

        for (otherIndex, otherId) in ids.enumerated() where otherId != id {
          guard let other = current[otherId] else { continue }
          let gap = distance(point, other)
          let direction =
            gap == 0
            ? (cos(Double(index - otherIndex)), sin(Double(index - otherIndex)))
            : ((point.x - other.x) / gap, (point.y - other.y) / gap)
          let pull =
            pairs.contains([id, otherId].sorted().joined(separator: "|"))
            ? (bondLength - gap) * 0.12 : 0
          let push = gap < 110 ? (110 - gap) * 0.06 : 0
          force.x += direction.0 * (pull + push)
          force.y += direction.1 * (pull + push)
        }

        next[id] = clampToCanvas(Point(x: point.x + force.x, y: point.y + force.y))
      }

      current = next
    }

    return current
  }

  static func layout(_ build: MoleculeBuild) -> [String: Point] {
    var layout: [String: Point] = [:]

    for atom in build.atoms {
      let partners = build.bonds.compactMap { bond in
        bond.from == atom.id ? bond.to : bond.to == atom.id ? bond.from : nil
      }
      layout[atom.id] = place(anchor: partners.first { layout[$0] != nil }, layout: layout)
    }

    return relax(layout, bonds: build.bonds)
  }
}
