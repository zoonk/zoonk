import CoreFoundation
import SwiftUI

/// Main's `AnswerOptionResult`. A guess counts as neither right nor wrong.
enum AnswerOptionResult: Equatable {
  case guess
  case right
  case wrong
}

/// Main's `AnswerOption`: its words, a mark at its end that shows what's picked, a ring where the
/// question takes one answer and a square where it takes several, and once checked the word its
/// result shows. On a hardware keyboard the first ten answer to their number key (the tenth to 0),
/// as on the web, and show it before the words; once checked, that room shows the verdict's mark.
struct AnswerOption: View {
  var marker: Int?
  var shortcut: Int?
  var picks: ChoiceMark.Kind = .one
  var isPicked = false
  var result: AnswerOptionResult?
  /// The learner's pick was a guess, so once checked it says "Your guess".
  var isGuessed = false
  var isLocked = false
  var tag: AnyView?
  let text: RichInline
  var detail: String?
  /// Without one, the answer is shown after the fact: the same look, with nothing to press and no
  /// mark, led by its marker (such as a step's place) in ink once picked, or else by its verdict's.
  let action: (() -> Void)?

  @Environment(\.hasHardwareKeyboard) private var hasKeyboard

  var body: some View {
    if let action {
      button(action)
    } else {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        if let marker {
          KeyMarker(number: marker, isPicked: isPicked && result == nil)
        } else if let result {
          VerdictMark(result: result)
        }
        answerContent
      }
      .answerOptionFrame(AnswerOptionStyle.tone(isPicked: isPicked, result: result))
      .accessibilityElement(children: .combine)
    }
  }

  /// The mark holds its room from the first draw, so a pick or a check moves no word. Words too
  /// wide to share their line go under the key and the mark.
  private func button(_ action: @escaping () -> Void) -> some View {
    let key = hasKeyboard ? marker : nil

    return Button(action: action) {
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          if let key {
            pickKey(key)
          }
          answerContent
          ChoiceMark(kind: picks, isPicked: isPicked)
        }

        VStack(alignment: .leading, spacing: 12) {
          HStack(spacing: 12) {
            if let key {
              pickKey(key)
            }
            Spacer(minLength: 0)
            ChoiceMark(kind: picks, isPicked: isPicked)
          }
          answerContent
        }
      }
    }
    .buttonStyle(AnswerOptionStyle(isPicked: isPicked, result: result))
    .disabled(isLocked)
    .modifier(PickKey(index: isLocked ? nil : (shortcut ?? marker).map { $0 - 1 }))
    .choiceTraits(picks, isPicked: isPicked)
  }

  /// Once locked the key answers nothing, so it hides in its room, which shows the verdict's mark
  /// once checked, and the words stay put.
  private func pickKey(_ number: Int) -> some View {
    KeyMarker(number: number)
      .opacity(isLocked || result != nil ? 0 : 1)
      .overlay {
        if let result {
          VerdictMark(result: result)
        }
      }
  }

  private var answerContent: some View {
    TagBesideOrUnder(
      text: text, detail: detail, tag: hasTag ? AnyView(tagContent) : nil,
      hasMarker: marker != nil || action != nil)
  }

  @ViewBuilder
  private var tagContent: some View {
    if let tag {
      tag
    } else if let result, let label = resultLabel(result) {
      Text(label)
        .typeStyle(.tag)
        .foregroundStyle(tagColor(result))
    }
  }

  private var hasTag: Bool {
    tag != nil || result.flatMap(resultLabel) != nil
  }

  /// The right option says "Correct" when the learner missed it. A pick needs no word of its own:
  /// its mark, its color and the verdict say it. Only a guess, which counts as neither right nor
  /// wrong, says so once it's checked; before, its mark shows the pick.
  private func resultLabel(_ result: AnswerOptionResult) -> LocalizedStringResource? {
    if result == .guess || (isPicked && isGuessed) {
      return LocalizedStringResource(
        "Your guess", table: "Practice",
        comment: "Mark beside the learner's pick when it counts as neither right nor wrong.")
    }

    guard result == .right, !isPicked else {
      return nil
    }

    return LocalizedStringResource(
      "Correct", table: "Practice",
      comment: "Mark beside the right option once a question is graded.")
  }

  private func tagColor(_ result: AnswerOptionResult) -> Color {
    switch result {
    case .guess: .mutedForeground
    case .right: .successText
    case .wrong: .destructiveText
    }
  }
}

/// An answer's words, or its code, and its tag. The tag moves under the words rather than leave them
/// less than half the row or narrower than their widest line-break unit. Code keeps its shape, so its
/// tag holds the card's end edge: on its last line while that line leaves room, and otherwise under
/// it. Code never wraps to make room.
struct TagBesideOrUnder: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.locale) private var locale

  let text: RichInline
  var detail: String?
  var tag: AnyView?
  var hasMarker = false

  var body: some View {
    AnswerOptionLayout(
      isStacked: isStacked, isCode: text.snippet != nil, hasTag: tag != nil, hasMarker: hasMarker
    ) {
      VStack(alignment: .leading, spacing: 2) {
        if let snippet = text.snippet {
          CodeSnippet(code: snippet.code, language: snippet.language)
        } else {
          RichInlineText(text)
        }

        if let detail {
          Text(verbatim: detail)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .multilineTextAlignment(.leading)

      VStack(alignment: .leading, spacing: 0) {
        if let tag {
          tag
        }
      }
      .layoutPriority(1)

      if tag != nil || hasMarker {
        ForEach(readingUnits(in: text.text), id: \.self) { unit in
          Text(unit, legibility: legibilityWeight)
            .hidden()
            .accessibilityHidden(true)
        }

        if let detail {
          ForEach(readingUnits(in: AttributedString(detail)), id: \.self) { unit in
            Text(unit)
              .typeStyle(.note)
              .hidden()
              .accessibilityHidden(true)
          }
        }
      }

      if let snippet = text.snippet, tag != nil {
        CodeSnippet(code: lastLine(of: snippet.code), language: snippet.language)
          .hidden()
          .accessibilityHidden(true)
      }
    }
  }

  private func lastLine(of code: String) -> String {
    String(code.split(separator: "\n", omittingEmptySubsequences: false).last ?? "")
  }

  private func readingUnits(in text: AttributedString) -> [AttributedString] {
    let plain = String(text.characters)
    let tokenizer = CFStringTokenizerCreate(
      nil, plain as CFString, CFRange(location: 0, length: plain.utf16.count),
      CFOptionFlags(kCFStringTokenizerUnitLineBreak),
      CFLocaleCreate(nil, CFLocaleIdentifier(rawValue: locale.identifier as CFString)))
    var units = Set<AttributedString>()

    while CFStringTokenizerAdvanceToNextToken(tokenizer).rawValue != 0 {
      let range = CFStringTokenizerGetCurrentTokenRange(tokenizer)
      let lower = String.Index(utf16Offset: range.location, in: plain)
      let upper = String.Index(utf16Offset: range.location + range.length, in: plain)
      let unit = plain[lower..<upper].drop(while: \.isWhitespace)
      var end = unit.endIndex
      while end > unit.startIndex, unit[unit.index(before: end)].isWhitespace {
        end = unit.index(before: end)
      }
      if unit.startIndex < end {
        let start = text.characters.index(
          text.startIndex, offsetBy: plain.distance(from: plain.startIndex, to: unit.startIndex))
        let finish = text.characters.index(
          start, offsetBy: plain.distance(from: unit.startIndex, to: end))
        units.insert(AttributedString(text[start..<finish]))
      }
    }
    return units.sorted { String($0.characters) < String($1.characters) }
  }
}

/// Text's minimum width can split a word or its punctuation, so probes measure whole line-break units.
private struct AnswerOptionLayout: Layout {
  var isStacked: Bool
  var isCode = false
  var hasTag: Bool
  var hasMarker: Bool
  private let spacing: CGFloat = 12

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let content = subviews.prefix(hasTag ? 2 : 1)
    // ViewThatFits can keep the key and the mark beside a multiline answer when its words still
    // fit there.
    let fitting =
      proposal.width == nil && hasMarker
      ? ProposedViewSize(width: widestUnit(in: subviews), height: proposal.height) : proposal

    if let width = fitting.width, tagEndsLastLine(width: width, subviews: subviews) {
      let words = subviews[0].sizeThatFits(ProposedViewSize(width: width, height: nil))
      return CGSize(width: width, height: words.height)
    }

    let layout = layout(for: fitting, subviews: subviews)
    var layoutCache = layout.makeCache(subviews: content)
    return layout.sizeThatFits(proposal: fitting, subviews: content, cache: &layoutCache)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    if tagEndsLastLine(width: bounds.width, subviews: subviews) {
      let wordsProposal = ProposedViewSize(width: bounds.width, height: nil)
      let lastBaseline = subviews[0].dimensions(in: wordsProposal)[
        VerticalAlignment.lastTextBaseline]
      let tag = subviews[1].dimensions(in: .unspecified)
      subviews[0].place(at: bounds.origin, proposal: wordsProposal)
      subviews[1].place(
        at: CGPoint(
          x: bounds.maxX - tag.width,
          y: bounds.minY + lastBaseline - tag[VerticalAlignment.firstTextBaseline]),
        proposal: .unspecified)
      return
    }

    let content = subviews.prefix(hasTag ? 2 : 1)
    let layout = layout(
      for: ProposedViewSize(width: bounds.width, height: proposal.height), subviews: subviews)
    var layoutCache = layout.makeCache(subviews: content)
    layout.placeSubviews(in: bounds, proposal: proposal, subviews: content, cache: &layoutCache)
  }

  /// Code's last line is the last subview, measured on its own.
  private func tagEndsLastLine(width: CGFloat, subviews: Subviews) -> Bool {
    guard isCode, hasTag, !isStacked, width.isFinite, let lastLine = subviews.last else {
      return false
    }

    let tagWidth = subviews[1].sizeThatFits(.unspecified).width
    return lastLine.sizeThatFits(.unspecified).width + spacing + tagWidth <= width
  }

  private func layout(for proposal: ProposedViewSize, subviews: Subviews) -> AnyLayout {
    var stacked = isStacked

    if hasTag, let width = proposal.width, width.isFinite {
      let tagWidth = subviews[1].sizeThatFits(.unspecified).width
      let readingWidth = isCode ? width : max(width / 2, min(widestUnit(in: subviews), width))
      stacked = stacked || width - tagWidth - spacing < readingWidth
    }

    // Under code, the tag keeps the card's end edge it holds on code's last line.
    return stacked
      ? AnyLayout(VStackLayout(alignment: isCode ? .trailing : .leading, spacing: spacing))
      : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: spacing))
  }

  private func widestUnit(in subviews: Subviews) -> CGFloat {
    subviews.dropFirst(2).dropLast(isCode && hasTag ? 1 : 0)
      .map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
  }
}

/// Main's `Kbd`: the key that picks an option, or the marker of an answer shown after the fact, in
/// ink once picked.
struct KeyMarker: View {
  let number: Int
  var isPicked = false

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)

    Text(number, format: .number)
      .typeStyle(.small.monospaced().weight(.medium))
      .foregroundStyle(isPicked ? Color(.background) : .mutedForeground)
      .padding(.horizontal, 4)
      .frame(minWidth: 20, minHeight: 20)
      .background(Color(.foreground).opacity(isPicked ? 1 : 0.04), in: shape)
      .overlay(shape.strokeBorder(Color(.foreground).opacity(isPicked ? 0 : 0.12)))
      .accessibilityHidden(true)
  }
}

/// Main's verdict mark, in a key's room or before an answer shown after the fact: lucide's check,
/// cross or dash at main's size and weight, bare and in the words' color, so it never reads as a
/// ticked checkbox. VoiceOver hears the verdict from the row and its feedback.
struct VerdictMark: View {
  let result: AnswerOptionResult

  @Environment(\.typeStyle) private var lineStyle
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibility

  /// Main's 16px icon in its 20px room, growing with the words.
  @ScaledMetric(relativeTo: .subheadline) private var size = 16.0
  @ScaledMetric(relativeTo: .subheadline) private var room = 20.0

  var body: some View {
    let capHeight = lineStyle.uiFont(dynamicTypeSize, legibility: legibility).capHeight

    VerdictGlyph(result: result)
      .stroke(style: StrokeStyle(lineWidth: size / 12, lineCap: .round, lineJoin: .round))
      .frame(width: size, height: size)
      .frame(width: room)
      // Beside text, it centers on the first line's capitals, as the choice mark does.
      .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + capHeight / 2 }
      .accessibilityHidden(true)
  }
}

/// Lucide's check, x and minus, drawn in its 24-unit grid.
private struct VerdictGlyph: Shape {
  let result: AnswerOptionResult

  func path(in rect: CGRect) -> Path {
    let unit = rect.width / 24

    func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      CGPoint(x: rect.minX + x * unit, y: rect.minY + y * unit)
    }

    var path = Path()

    switch result {
    case .right:
      path.move(to: point(20, 6))
      path.addLine(to: point(9, 17))
      path.addLine(to: point(4, 12))
    case .wrong:
      path.move(to: point(18, 6))
      path.addLine(to: point(6, 18))
      path.move(to: point(6, 6))
      path.addLine(to: point(18, 18))
    case .guess:
      path.move(to: point(5, 12))
      path.addLine(to: point(19, 12))
    }

    return path
  }
}

/// Disabled options keep their colors, so a graded question stays readable.
struct AnswerOptionStyle: ButtonStyle {
  var isPicked: Bool
  var result: AnswerOptionResult?

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .answerOptionFrame(
        Self.tone(isPicked: isPicked, result: result), isPressed: configuration.isPressed)
  }

  static func tone(isPicked: Bool, result: AnswerOptionResult?) -> AnswerTone {
    switch result {
    case .guess: .guess
    case .right: .right
    case .wrong: .wrong
    case nil: isPicked ? .picked : .idle
    }
  }
}

extension View {
  fileprivate func answerOptionFrame(_ tone: AnswerTone, isPressed: Bool = false) -> some View {
    typeStyle(.button)
      .foregroundStyle(Color(.foreground))
      .padding(.horizontal, 16)
      .padding(.vertical, 13)
      .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
      .answerSurface(tone, isPressed: isPressed)
  }
}
