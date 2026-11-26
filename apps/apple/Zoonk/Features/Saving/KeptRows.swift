/// A list of saves for one visit: a row whose bookmark the learner tapped keeps its place until they
/// leave the page, its bookmark empty once it's removed, so nothing moves under their thumb and a
/// second tap saves it again where it was.
struct KeptRows<Row: Identifiable> {
  private var kept: [(index: Int, row: Row)] = []

  /// As the learner taps a row's bookmark, in the rows shown then.
  mutating func keep(_ row: Row, shown: [Row]) {
    guard !kept.contains(where: { $0.row.id == row.id }),
      let index = shown.firstIndex(where: { $0.id == row.id })
    else {
      return
    }

    kept.append((index, row))
  }

  /// The list read, with each kept row where it was: the newest read of it, or what it showed when
  /// the read no longer lists it.
  func rows(_ read: [Row]) -> [Row] {
    let ids = Set(kept.map(\.row.id))
    var rows = read.filter { !ids.contains($0.id) }

    for (index, row) in kept.sorted(by: { $0.index < $1.index }) {
      rows.insert(read.first { $0.id == row.id } ?? row, at: min(index, rows.count))
    }

    return rows
  }
}
