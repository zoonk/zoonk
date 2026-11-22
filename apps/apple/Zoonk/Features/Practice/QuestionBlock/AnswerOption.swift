import CoreFoundation
import SwiftUI

/// Main's `AnswerOptionResult`. A guess counts as neither right nor wrong.
enum AnswerOptionResult: Equatable {
  case guess
  case right
  case wrong
}

/// Main's `AnswerOption`: its number key, its words and, once checked, the word its result shows.
/// The first nine answer to their number key on a hardware keyboard, as on the web.
struct AnswerOption: View {
  var marker: Int?
  var isPicked = false
  var result: AnswerOptionResult?
  /// The learner's pick was a guess, so it says "Your guess".
  var isGuessed = false
  var isLocked = false
  var tag: AnyView?
  let text: RichInline
  var detail: String?
  /// Without one, the answer is shown after the fact: the same look, with nothing to press.
  let action: (() -> Void)?

  var body: some View {
    if let action {
      button(action)
    } else {
      markedContent
        .answerOptionFrame(AnswerOptionStyle.tone(isPicked: isPicked, result: result))
        .accessibilityElement(children: .combine)
    }
  }

  private func button(_ action: @escaping () -> Void) -> some View {
    Button(action: action) {
      if let marker {
        ViewThatFits(in: .horizontal) {
          markedContent

          VStack(alignment: .leading, spacing: 12) {
            KeyMarker(number: marker, isPicked: isPicked && result == nil)
            answerContent
          }
        }
      } else {
        markedContent
      }
    }
    .buttonStyle(AnswerOptionStyle(isPicked: isPicked, result: result))
    .disabled(isLocked)
    .modifier(NumberKeyShortcut(number: marker, isEnabled: !isLocked))
    .accessibilityAddTraits(isPicked ? .isSelected : [])
  }

  private var markedContent: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      if let marker {
        KeyMarker(number: marker, isPicked: isPicked && result == nil)
      }
      answerContent
    }
  }

  private var answerContent: some View {
    TagBesideOrUnder(
      text: text, detail: detail, tag: hasTag ? AnyView(tagContent) : nil,
      hasMarker: marker != nil)
  }

  @ViewBuilder
  private var tagContent: some View {
    if let tag {
      tag
    } else if let result, let label = resultLabel(result) {
      Text(label)
        .typeStyle(.tag)
        .foregroundStyle(tagColor(result))
    } else if isPicked && isGuessed {
      // Unspoken: VoiceOver already says the option is selected.
      Text(yourGuess)
        .typeStyle(.tag)
        .foregroundStyle(Color(.foreground))
        .accessibilityHidden(true)
    }
  }

  private var hasTag: Bool {
    if tag != nil {
      return true
    }

    if let result {
      return resultLabel(result) != nil
    }

    return isPicked && isGuessed
  }

  private var yourGuess: LocalizedStringResource {
    LocalizedStringResource(
      "Your guess", table: "Practice",
      comment: "Mark beside the learner's pick when it counts as neither right nor wrong.")
  }

  /// The right option says "Correct" when the learner missed it. A pick needs no word of its own:
  /// its color and the verdict say it, and only a guess, which counts as neither, says so.
  private func resultLabel(_ result: AnswerOptionResult) -> LocalizedStringResource? {
    if result == .guess || (isPicked && isGuessed) {
      return yourGuess
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
    // ViewThatFits can keep the key beside a multiline answer when its words still fit there.
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

/// Main's `Kbd`: the key that picks an option. A picked option's key turns ink: the option's mark,
/// as a radio's dot is.
private struct KeyMarker: View {
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

private struct NumberKeyShortcut: ViewModifier {
  let number: Int?
  let isEnabled: Bool

  func body(content: Content) -> some View {
    if let number, isEnabled, (1...9).contains(number), let key = String(number).first {
      content.keyboardShortcut(KeyEquivalent(key), modifiers: [])
    } else {
      content
    }
  }
}
