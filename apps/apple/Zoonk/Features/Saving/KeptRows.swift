/// A list of saves for one visit: a row whose bookmark the learner tapped keeps its place until they
/// leave the page, its bookmark empty once it's removed, so nothing moves under their thumb and a
/// second tap saves it again where it was.
struct KeptRows<Row: Identifiable> {
  /// Each kept row with the row that was above it when it was tapped, nil at the top.
  private var kept: [(after: Row.ID?, row: Row)] = []

  /// As the learner taps a row's bookmark, in the rows shown then.
  mutating func keep(_ row: Row, shown: [Row]) {
    guard !kept.contains(where: { $0.row.id == row.id }),
      let index = shown.firstIndex(where: { $0.id == row.id })
    else {
      return
    }

    kept.append((index > 0 ? shown[index - 1].id : nil, row))
  }

  /// The list read, with each kept row back after the row that was above it: the newest read of it,
  /// or what it showed once the read no longer lists it. One whose row above has gone since goes
  /// back to the top.
  func rows(_ read: [Row]) -> [Row] {
    let ids = Set(kept.map(\.row.id))
    var rows = read.filter { !ids.contains($0.id) }

    var waiting = kept

    // A row kept after another kept row waits for that one to be back.
    while !waiting.isEmpty {
      let next =
        waiting.firstIndex { entry in
          entry.after.map { above in rows.contains { $0.id == above } } ?? true
        } ?? waiting.firstIndex { entry in !waiting.contains { $0.row.id == entry.after } }
        ?? 0
      let (after, row) = waiting.remove(at: next)
      let index = after.flatMap { above in rows.firstIndex { $0.id == above }.map { $0 + 1 } } ?? 0
      rows.insert(read.first { $0.id == row.id } ?? row, at: index)
    }

    return rows
  }
}
