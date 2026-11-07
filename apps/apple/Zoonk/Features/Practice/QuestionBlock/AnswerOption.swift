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
  @Environment(\.stacksContent) private var isStacked
  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.locale) private var locale

  var marker: Int?
  var isPicked = false
  var result: AnswerOptionResult?
  /// The learner's pick was a guess, so it's "Your guess", never "Your answer".
  var isGuessed = false
  var isLocked = false
  var tag: AnyView?
  let text: RichInline
  var detail: String?
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      if let marker {
        ViewThatFits(in: .horizontal) {
          markedContent

          VStack(alignment: .leading, spacing: 12) {
            KeyMarker(number: marker)
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
        KeyMarker(number: marker)
      }
      answerContent
    }
  }

  private var answerContent: some View {
    AnswerOptionLayout(isStacked: isStacked, hasTag: hasTag, hasMarker: marker != nil) {
      VStack(alignment: .leading, spacing: 2) {
        Text(text, legibility: legibilityWeight)

        if let detail {
          Text(verbatim: detail)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .multilineTextAlignment(.leading)

      VStack(alignment: .leading, spacing: 0) {
        tagContent
      }
      .layoutPriority(1)

      if hasTag || marker != nil {
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
    }
  }

  @ViewBuilder
  private var tagContent: some View {
    if let tag {
      tag
    } else if let result {
      Text(resultLabel(result))
        .typeStyle(.tag)
        .foregroundStyle(tagColor(result))
    }
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

  private var hasTag: Bool { tag != nil || result != nil }

  /// A right pick says whose it is, so it isn't called correct twice under its verdict.
  private func resultLabel(_ result: AnswerOptionResult) -> LocalizedStringResource {
    let yourGuess = LocalizedStringResource(
      "Your guess", table: "Practice",
      comment: "Mark beside the learner's pick when it counts as neither right nor wrong.")
    let yourAnswer = LocalizedStringResource(
      "Your answer", table: "Practice",
      comment: "Mark beside the learner's wrong pick once a question is graded.")

    switch result {
    case .guess:
      return yourGuess
    case .right:
      if isPicked {
        return isGuessed ? yourGuess : yourAnswer
      }

      return LocalizedStringResource(
        "Correct", table: "Practice",
        comment: "Mark beside the right option once a question is graded.")
    case .wrong:
      return yourAnswer
    }
  }

  private func tagColor(_ result: AnswerOptionResult) -> Color {
    switch result {
    case .guess: .mutedForeground
    case .right: .successText
    case .wrong: .destructiveText
    }
  }
}

/// Text's minimum width can split a word or its punctuation, so probes measure whole line-break units.
private struct AnswerOptionLayout: Layout {
  var isStacked: Bool
  var hasTag: Bool
  var hasMarker: Bool
  private let spacing: CGFloat = 12

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let content = subviews.prefix(hasTag ? 2 : 1)
    // ViewThatFits can keep the key beside a multiline answer when its words still fit there.
    let fitting =
      proposal.width == nil && hasMarker
      ? ProposedViewSize(width: widestUnit(in: subviews), height: proposal.height) : proposal
    let layout = layout(for: fitting, subviews: subviews)
    var layoutCache = layout.makeCache(subviews: content)
    return layout.sizeThatFits(proposal: fitting, subviews: content, cache: &layoutCache)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    let content = subviews.prefix(hasTag ? 2 : 1)
    let layout = layout(
      for: ProposedViewSize(width: bounds.width, height: proposal.height), subviews: subviews)
    var layoutCache = layout.makeCache(subviews: content)
    layout.placeSubviews(in: bounds, proposal: proposal, subviews: content, cache: &layoutCache)
  }

  private func layout(for proposal: ProposedViewSize, subviews: Subviews) -> AnyLayout {
    var stacked = isStacked

    if hasTag, let width = proposal.width, width.isFinite {
      let tagWidth = subviews[1].sizeThatFits(.unspecified).width
      let readingWidth = max(width / 2, min(widestUnit(in: subviews), width))
      stacked = stacked || width - tagWidth - spacing < readingWidth
    }

    return stacked
      ? AnyLayout(VStackLayout(alignment: .leading, spacing: spacing))
      : AnyLayout(HStackLayout(alignment: .firstTextBaseline, spacing: spacing))
  }

  private func widestUnit(in subviews: Subviews) -> CGFloat {
    subviews.dropFirst(2).map { $0.sizeThatFits(.unspecified).width }.max() ?? 0
  }
}

/// Main's `Kbd`: the key that picks an option.
private struct KeyMarker: View {
  let number: Int

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: Radius.sm, style: .continuous)

    Text(number, format: .number)
      .typeStyle(.small.monospaced().weight(.medium))
      .foregroundStyle(.mutedForeground)
      .padding(.horizontal, 4)
      .frame(minWidth: 20, minHeight: 20)
      .background(Color(.foreground).opacity(0.04), in: shape)
      .overlay(shape.strokeBorder(Color(.foreground).opacity(0.12)))
      .accessibilityHidden(true)
  }
}

/// Disabled options keep their colors, so a graded question stays readable.
struct AnswerOptionStyle: ButtonStyle {
  var isPicked: Bool
  var result: AnswerOptionResult?

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .typeStyle(.button)
      .foregroundStyle(Color(.foreground))
      .padding(.horizontal, 14)
      .padding(.vertical, 13)
      .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
      .answerSurface(tone, isPressed: configuration.isPressed)
  }

  private var tone: AnswerTone {
    switch result {
    case .guess: .guess
    case .right: .right
    case .wrong: .wrong
    case nil: isPicked ? .picked : .idle
    }
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
