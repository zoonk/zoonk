import SwiftUI

/// A card on a match board: its column and its place in that column.
struct MatchCardRef: Hashable, Sendable {
  enum Side: Hashable, Sendable {
    case left, right
  }

  let side: Side
  let index: Int

  static func left(_ index: Int) -> Self { Self(side: .left, index: index) }
  static func right(_ index: Int) -> Self { Self(side: .right, index: index) }
}

/// A pair the learner tried, by the places of its cards in the shown columns: main's `MatchAnswer`
/// miss.
struct MatchTry: Hashable, Sendable, Codable {
  let left: Int
  let right: Int

  /// Core keeps the earliest of a board's misses up to this many.
  static let maxMisses = 32
}

/// Main's match hook: the tap rule every match board shares. A card on either side, then one on the
/// other side, makes a try. Another card on the same side takes the selection over, and the
/// selected card again clears it. After a try that doesn't go together, the card picked first stays
/// selected, so its next partner is one tap away.
struct MatchPicking: Equatable, Sendable {
  private(set) var selected: MatchCardRef?
  /// The last try that didn't go together, for its moment on screen.
  private(set) var miss: MatchTry?
  /// Names each miss, so a second one on the same cards cues again.
  private(set) var missCount = 0
  /// The last pair kept, for its moment on screen before it settles; other taps leave it, and only
  /// the next pair kept takes its place.
  private(set) var lock: MatchTry?
  private(set) var lockCount = 0

  /// The try a tap makes, if any, with `goesTogether`'s verdict on it.
  mutating func tap(_ card: MatchCardRef, goesTogether: (MatchTry) -> Bool) -> (
    attempt: MatchTry, isRight: Bool
  )? {
    miss = nil

    guard let first = selected, first != card else {
      selected = selected == card ? nil : card
      return nil
    }

    guard first.side != card.side else {
      selected = card
      return nil
    }

    let attempt =
      first.side == .left
      ? MatchTry(left: first.index, right: card.index)
      : MatchTry(left: card.index, right: first.index)
    let isRight = goesTogether(attempt)

    if isRight {
      selected = nil
      lock = attempt
      lockCount += 1
    } else {
      miss = attempt
      missCount += 1
    }

    return (attempt, isRight)
  }

  /// A test's board, which holds its pairs until Check: a tap on a paired card undoes the pair and
  /// picks that card, so the next tap gives it a new partner, and two cards on either side pair.
  /// The pairs after the tap and the pair it made or undid, or nil when it changed none.
  mutating func tapHeld(_ card: MatchCardRef, pairs: [Int?]) -> (
    pairs: [Int?], attempt: MatchTry, isUndone: Bool
  )? {
    let owner = card.side == .left ? card.index : pairs.firstIndex(of: card.index)
    var next = pairs

    if let owner, pairs.indices.contains(owner), let partner = pairs[owner] {
      next[owner] = nil
      clear()
      selected = card
      return (next, MatchTry(left: owner, right: partner), true)
    }

    guard let (attempt, _) = tap(card, goesTogether: { _ in true }) else {
      return nil
    }

    next[attempt.left] = attempt.right
    return (next, attempt, false)
  }

  /// Lets go of the picked card (Esc).
  mutating func drop() {
    selected = nil
    miss = nil
  }

  mutating func clear() {
    selected = nil
    miss = nil
    lock = nil
  }

  /// The miss's cue ends; a later one keeps its own.
  mutating func endMiss(_ count: Int) {
    if count == missCount {
      miss = nil
    }
  }

  /// The kept pair's cue ends; a later one keeps its own.
  mutating func endLock(_ count: Int) {
    if count == lockCount {
      lock = nil
    }
  }

  func isMissed(_ card: MatchCardRef) -> Bool {
    miss?.holds(card) == true
  }

  /// A kept pair's card: its right cue for a moment after the tap that kept it, then quiet with the
  /// pair's number, so the eye goes to the cards still to match.
  func kept(_ card: MatchCardRef, pair: Int) -> MatchEntryState {
    lock?.holds(card) == true ? .right : .done(pair)
  }
}

extension MatchTry {
  func holds(_ card: MatchCardRef) -> Bool {
    card.side == .left ? left == card.index : right == card.index
  }
}

/// What a match card shows.
enum MatchEntryState: Equatable {
  case idle
  case selected
  /// In a pair a test's board holds until Check, with the pair's number.
  case paired(Int)
  /// A pair checked and kept: for a moment as it's kept, and on a solved board.
  case right
  /// A pair kept earlier on a board still being played, with the pair's number, receded so it doesn't
  /// pull the eye.
  case done(Int)
  /// Part of a try that didn't go together, for a moment; the miss's count, so a second miss on the
  /// card cues again.
  case wrong(Int)
  /// On a solved board, a pair whose left card had a wrong try first: right, so checked, but quiet,
  /// since the lines under the verdict carry the mistake.
  case missed

  /// Settled: nothing to press.
  var isKept: Bool {
    switch self {
    case .right, .done, .missed: true
    case .idle, .selected, .paired, .wrong: false
    }
  }

  /// Out of the way: the page's ground, the rest border and muted words, so it never reads as picked.
  var isQuiet: Bool {
    switch self {
    case .done, .missed: true
    case .idle, .selected, .paired, .right, .wrong: false
    }
  }

  /// A solved board's pair, by whether its left card had a wrong try on the way.
  static func solved(missed: Bool) -> Self { missed ? .missed : .right }
}

/// Main's `MatchEntry`: one side of a pair, on every board that asks to match these with those. Its
/// words start at the card's edge, and its mark (a pick's dot, a check, an ✕ or the pair's number)
/// sits level with the first line at the end, in room every state keeps, so pairing moves no text.
/// `partner` is what VoiceOver says it's matched with.
struct MatchEntry<Label: View>: View {
  let state: MatchEntryState
  /// Its place on the board, the left column first, for the number key that picks it.
  var keyIndex: Int?
  var partner: String?
  /// Without one, it shows an answer after the fact: the same look, with nothing to press.
  let action: (() -> Void)?
  @ViewBuilder let label: Label

  var body: some View {
    Button {
      action?()
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        label
          .frame(maxWidth: .infinity, alignment: .leading)
          .multilineTextAlignment(.leading)

        MatchMark(state: state)
      }
    }
    .buttonStyle(MatchEntryStyle(state: state))
    .disabled(action == nil || state.isKept)
    .modifier(MatchShake(missNumber: missNumber))
    .modifier(PickKey(index: action == nil || state.isKept ? nil : keyIndex))
    .accessibilityValue(value)
    .accessibilityAddTraits(state == .selected ? .isSelected : [])
  }

  private var missNumber: Int? {
    if case .wrong(let number) = state { number } else { nil }
  }

  private var value: Text {
    guard let partner else { return Text(verbatim: "") }

    return Text(
      "Matched with \(partner)", tableName: "Practice",
      comment: "VoiceOver value of a match card already paired, naming the card it is paired with.")
  }
}

/// Main's `animate-shake`, once per miss; with reduced motion the miss shows by its tone alone.
private struct MatchShake: ViewModifier {
  let missNumber: Int?

  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var shakes = 0

  func body(content: Content) -> some View {
    content
      .keyframeAnimator(initialValue: 0.0, trigger: shakes) { content, offset in
        content.offset(x: offset)
      } keyframes: { _ in
        KeyframeTrack {
          LinearKeyframe(-4.0, duration: 0.08)
          LinearKeyframe(4.0, duration: 0.08)
          LinearKeyframe(-3.0, duration: 0.08)
          LinearKeyframe(3.0, duration: 0.08)
          LinearKeyframe(0.0, duration: 0.08)
        }
      }
      .onChange(of: missNumber) { _, number in
        if number != nil, !reduceMotion {
          shakes += 1
        }
      }
  }
}

/// Disabled cards keep their colors, so a checked board stays readable.
private struct MatchEntryStyle: ButtonStyle {
  let state: MatchEntryState

  @Environment(\.horizontalSizeClass) private var sizeClass
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  func makeBody(configuration: Configuration) -> some View {
    let shape = RoundedRectangle(cornerRadius: Radius.xl, style: .continuous)
    let text = sizeClass == .regular ? Self.wideText : Self.text

    configuration.label
      .typeStyle(text)
      .foregroundStyle(state.isQuiet ? Color(.mutedForeground) : Color(.foreground))
      .padding(.horizontal, 12)
      // Main's lines are 24 tall with their words in the middle, so half the space between lines
      // sits over the first and under the last too, one line included.
      .padding(.vertical, 13 + text.rowGap(dynamicTypeSize) / 2)
      // Top, so the two cards of a row start level, however many lines each has.
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
      .answerSurface(tone, cornerRadius: Radius.xl, isPressed: configuration.isPressed)
      // As on the page, on a lesson's tinted canvas too.
      .background(Color(.background), in: shape)
      .scaleEffect(configuration.isPressed ? 0.99 : 1)
      .animation(MatchMotion.settle(duration: 0.15), value: state)
  }

  // Main's board text: 14 on a phone and 16 wider, on 24-point lines.
  private static let text = TypeStyle(
    size: 14, relativeTo: .subheadline, weight: .medium, lineHeight: 24.0 / 14)
  private static let wideText = TypeStyle(
    size: 16, relativeTo: .callout, weight: .medium, lineHeight: 24.0 / 16)

  private var tone: AnswerTone {
    switch state {
    case .idle, .paired, .done, .missed: .idle
    case .selected: .picked
    case .right: .right
    case .wrong: .wrong
    }
  }
}

/// The mark at a card's end: a dot on the learner's pick, a check on a kept pair (muted in a solved
/// row a wrong try came first), an ✕ on a wrong try, and a held or settled pair's number in a
/// circle, which tells it apart from a key, muted once settled, so two finished cards read as a pair
/// only when their numbers match. Its column is there in every state. The marks are main's thin
/// ones.
private struct MatchMark: View {
  let state: MatchEntryState

  @ScaledMetric(relativeTo: .subheadline) private var width = 20.0
  @ScaledMetric(relativeTo: .subheadline) private var dot = 10.0
  /// `TypeStyle.tag`'s size.
  @ScaledMetric(relativeTo: .caption2) private var numberSize = 11.5

  var body: some View {
    Group {
      switch state {
      case .selected:
        // Centered on the first line, which the hidden text sets as the words beside it do.
        Text(verbatim: " ")
          .hidden()
          .overlay {
            Circle()
              .fill(Color(.foreground))
              .frame(width: dot, height: dot)
          }
      case .right:
        check.foregroundStyle(.success)
      case .missed:
        check.foregroundStyle(.mutedForeground)
      case .wrong:
        Image(systemName: "xmark")
          .fontWeight(.regular)
          .foregroundStyle(.destructive)
      case .paired(let number):
        pairNumber(number, ink: Color(.foreground))
      case .done(let number):
        pairNumber(number, ink: Color(.mutedForeground))
      case .idle:
        Color.clear.frame(height: 1)
      }
    }
    .frame(width: width)
    .accessibilityHidden(true)
  }

  private var check: some View {
    Image(systemName: "checkmark").fontWeight(.regular)
  }

  /// Geist Mono's medium with its plain zero (`ss09`): its own zero is slashed, which reads as "Ø".
  private static func plainZeroMono(size: Double) -> Font {
    let descriptor = UIFontDescriptor(fontAttributes: [
      .family: "Geist Mono",
      .traits: [UIFontDescriptor.TraitKey.weight: UIFont.Weight.medium],
      .featureSettings: [
        [
          UIFontDescriptor.FeatureKey.type: kStylisticAlternativesType,
          .selector: kStylisticAltNineOnSelector,
        ]
      ],
    ])
    return Font(UIFont(descriptor: descriptor, size: size))
  }

  private func pairNumber(_ number: Int, ink: Color) -> some View {
    Text(number, format: .number)
      .font(Self.plainZeroMono(size: numberSize))
      .foregroundStyle(Color(.background))
      .frame(minWidth: width, minHeight: width)
      .background(ink, in: Circle())
  }
}

/// Main's `MatchBoard`: two columns 8 apart whose rows line up, the right column under the left
/// once text is at an accessibility size. Solved, each row holds a pair, every card sliding from its
/// place in its column to its row. VoiceOver reads the left column, then the right. A card's place in
/// its column is its identity, which `solvedRows` uses too.
struct MatchBoard<Card: View>: View {
  let leftCount: Int
  let rightCount: Int
  var solvedRows: [MatchTry]?
  @ViewBuilder let card: (MatchCardRef) -> Card

  @Environment(\.stacksContent) private var isStacked
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    MatchBoardLayout(rows: rows) {
      ForEach(cards, id: \.self) { ref in
        card(ref)
          .layoutValue(key: MatchCardPlace.self, value: ref)
          .accessibilitySortPriority(Double(sortPriority(ref)))
      }
    }
    .animation(reduceMotion ? nil : MatchMotion.settle(duration: 0.2), value: solvedRows)
    .accessibilityElement(children: .contain)
  }

  private var cards: [MatchCardRef] {
    (0..<leftCount).map(MatchCardRef.left) + (0..<rightCount).map(MatchCardRef.right)
  }

  /// Side by side, a row is two cells; stacked, each card has its own, a pair's 8 apart and the
  /// columns or pairs 16 apart.
  private var rows: [MatchBoardLayout.Row] {
    if let solvedRows {
      return isStacked
        ? solvedRows.flatMap { pair in
          [.init(cells: [.left(pair.left)], gap: 16), .init(cells: [.right(pair.right)], gap: 8)]
        }
        : solvedRows.map { .init(cells: [.left($0.left), .right($0.right)], gap: 8) }
    }

    if isStacked {
      return (0..<leftCount).map { .init(cells: [.left($0)], gap: 8) }
        + (0..<rightCount).map { .init(cells: [.right($0)], gap: $0 == 0 ? 16 : 8) }
    }

    return (0..<max(leftCount, rightCount)).map {
      .init(
        cells: [$0 < leftCount ? .left($0) : nil, $0 < rightCount ? .right($0) : nil], gap: 8)
    }
  }

  /// The left column first, top to bottom, then the right: rows would read it row by row.
  private func sortPriority(_ ref: MatchCardRef) -> Int {
    let place = ref.side == .left ? ref.index : leftCount + ref.index
    return leftCount + rightCount - place
  }
}

private struct MatchCardPlace: LayoutValueKey {
  static let defaultValue: MatchCardRef? = nil
}

/// Places each card in its cell, a row as tall as its tallest card, so the same cards move, rather
/// than new ones appearing, when the board changes from columns to pairs.
private struct MatchBoardLayout: Layout {
  struct Row: Equatable {
    /// One or two cells, empty where a column is shorter.
    let cells: [MatchCardRef?]
    /// Space above the row; the first row's is ignored.
    let gap: CGFloat
  }

  let rows: [Row]

  private static let columnGap: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? 0
    let heights = rowHeights(width: width, subviews: subviews)
    return CGSize(width: width, height: heights.reduce(0, +) + gaps)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let views = byPlace(subviews)
    let heights = rowHeights(width: bounds.width, subviews: subviews)
    var y = bounds.minY

    for (index, row) in rows.enumerated() {
      if index > 0 { y += row.gap }
      let width = cellWidth(bounds.width, row: row)

      for (column, ref) in row.cells.enumerated() {
        guard let ref, let view = views[ref] else { continue }
        let x = bounds.minX + CGFloat(column) * (width + Self.columnGap)
        view.place(
          at: CGPoint(x: x, y: y), anchor: .topLeading,
          proposal: ProposedViewSize(width: width, height: heights[index]))
      }

      y += heights[index]
    }
  }

  private var gaps: CGFloat {
    rows.dropFirst().reduce(0) { $0 + $1.gap }
  }

  private func cellWidth(_ width: CGFloat, row: Row) -> CGFloat {
    let columns = CGFloat(max(row.cells.count, 1))
    return max(0, (width - Self.columnGap * (columns - 1)) / columns)
  }

  private func rowHeights(width: CGFloat, subviews: Subviews) -> [CGFloat] {
    let views = byPlace(subviews)

    return rows.map { row in
      let proposal = ProposedViewSize(width: cellWidth(width, row: row), height: nil)
      return row.cells.compactMap { $0.flatMap { views[$0] }?.sizeThatFits(proposal).height }
        .max() ?? 0
    }
  }

  private func byPlace(_ subviews: Subviews) -> [MatchCardRef: LayoutSubview] {
    Dictionary(
      subviews.compactMap { view in view[MatchCardPlace.self].map { ($0, view) } },
      uniquingKeysWith: { first, _ in first })
  }
}

extension View {
  /// What every match board does around its taps: a light tap in the hand as a pair locks, a
  /// warning one on a miss, each cue ending after its moment, and Esc letting go of a picked card
  /// before it leaves the task, while the board still takes taps (`isPlaying`).
  func matchBoardFeedback(_ picking: Binding<MatchPicking>, locked: Int, isPlaying: Bool)
    -> some View
  {
    holdsEscape(isPlaying && picking.wrappedValue.selected != nil) { picking.wrappedValue.drop() }
      .sensoryFeedback(.impact(weight: .light), trigger: locked) { old, new in new > old }
      .sensoryFeedback(.warning, trigger: picking.wrappedValue.missCount)
      .task(id: picking.wrappedValue.missCount) {
        let count = picking.wrappedValue.missCount
        guard picking.wrappedValue.miss != nil, await MatchCue.lasts() else { return }
        picking.wrappedValue.endMiss(count)
      }
      .task(id: picking.wrappedValue.lockCount) {
        let count = picking.wrappedValue.lockCount
        guard picking.wrappedValue.lock != nil, await MatchCue.lasts() else { return }
        picking.wrappedValue.endLock(count)
      }
  }
}

/// Main's `ease-out` curve, which a card settles and slides on.
private enum MatchMotion {
  static func settle(duration: Double) -> Animation {
    .timingCurve(0.22, 1, 0.36, 1, duration: duration)
  }
}

private enum MatchCue {
  /// Waits out a cue's moment on screen; false once the cue's task is cancelled.
  static func lasts() async -> Bool {
    try? await Task.sleep(for: .milliseconds(600))
    return !Task.isCancelled
  }
}

/// What VoiceOver says after each try on a board, or each pair a held board makes or undoes. A card that ends a sentence
/// itself takes the place of the line's own stop right after it, as main's lines do, so
/// "…di fronte." never reads "…di fronte..".
enum MatchAnnouncement {
  static func matched(_ left: String, _ right: String, matched: Int, total: Int) -> String {
    fill(
      String(
        localized:
          "Matched \(slot.left) with \(slot.right). Pairs matched: \(matched) of \(total).",
        table: "Activities", locale: .appLanguage),
      left: left, right: right)
  }

  static func unmatched(_ left: String, _ right: String) -> String {
    fill(
      String(localized: "Unmatched \(slot.left) and \(slot.right).", table: "Activities"),
      left: left, right: right)
  }

  static func missed(_ left: String, _ right: String) -> String {
    fill(
      String(
        localized: "\(slot.left) and \(slot.right) don't go together.", table: "Activities"),
      left: left, right: right)
  }

  /// Where each card's text goes in a line.
  private static let slot = (left: "\u{E000}", right: "\u{E001}")

  static func fill(_ line: String, left: String, right: String) -> String {
    fillSlot(fillSlot(line, slot: slot.left, text: left), slot: slot.right, text: right)
  }

  private static func fillSlot(_ line: String, slot: String, text: String) -> String {
    guard let range = line.range(of: slot) else {
      return line
    }

    var rest = line[range.upperBound...]

    if let end = text.last, endsSentence(end), let stop = rest.first, endsSentence(stop) {
      rest = rest.dropFirst()
    }

    return line[..<range.lowerBound] + text + rest
  }

  private static func endsSentence(_ character: Character) -> Bool {
    ".!?…。！？".contains(character)
  }
}
