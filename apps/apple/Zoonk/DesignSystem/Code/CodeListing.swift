import SwiftUI
import UIKit

/// Where code sits: `inset` flush in an activity's card, `panel` on its own muted panel, in text.
enum CodeFrameVariant {
  case inset, panel
}

extension EnvironmentValues {
  /// A narrow frame wraps a program's lines; a wider one keeps their shape and scrolls sideways.
  @Entry fileprivate var codeWraps = true
  /// The ground under a scrolling program's line numbers, which the code scrolls under.
  @Entry fileprivate var codeSurface: Color?
}

/// Main's `CodeFrame`: lines of code, read left to right in every language. In a narrow frame each
/// line wraps, its extra rows marked under its number; in a wider one, lines keep their shape and
/// the code scrolls sideways under numbers that stay put. The frame's own width decides, so a
/// program in an iPad's aside or the buddy's panel wraps as one on a phone does.
struct CodeFrame<Content: View>: View {
  var variant = CodeFrameVariant.inset
  @ViewBuilder let content: Content

  /// Main's `@lg` container width: from it a program keeps its lines' shape.
  private static var keepsShapeFrom: CGFloat { 512 }

  @State private var width: CGFloat = 0
  @State private var gutter: CGFloat = 0

  var body: some View {
    let wraps = width < Self.keepsShapeFrom
    // Main's 12 on a panel; at the end, a line's own padding makes up the rest.
    let start: CGFloat = variant == .panel ? 12 : 0
    let end: CGFloat = variant == .panel ? 6 : 0

    Group {
      if wraps {
        lines
          .padding(.leading, start)
          .padding(.trailing, end)
      } else {
        // The start padding stays outside what scrolls, so the numbers stay put at its edge.
        HorizontalScroll(leadingInset: gutter) {
          lines
            .padding(.trailing, end)
            .fixedSize(horizontal: true, vertical: false)
        }
        .padding(.leading, start)
        .onPreferenceChange(CodeGutterKey.self) { gutter = $0 }
        .environment(\.codeSurface, variant == .panel ? .muted : .boxBackground)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      width = $0
    }
    .background {
      if variant == .panel {
        RoundedRectangle(cornerRadius: Radius.xl, style: .continuous).fill(.muted)
      }
    }
    .typeStyle(.code)
    .environment(\.codeWraps, wraps)
    .environment(\.layoutDirection, .leftToRight)
  }

  private var lines: some View {
    VStack(alignment: .leading, spacing: 0) {
      content
    }
    .padding(.vertical, variant == .panel ? 10 : 0)
  }
}

/// Main's `CodeLine`: a numbered line of a program. Wrapped, an arrow under its number marks each
/// extra row. Its tone starts after its number, which stays put while the code scrolls under it.
/// VoiceOver says `spoken` for the line (`SpokenCode`), in place of its code; a line of fields
/// leaves it out and labels its fields.
struct CodeLine<Content: View>: View {
  enum Tone {
    /// `editable` marks the learner's line around its code, never by moving it: in Python, a moved
    /// line reads as indented.
    case plain, current, editable, error
  }

  let number: Int
  /// How many digits the program's last line number has, so every number takes the same width.
  let digits: Int
  var tone = Tone.plain
  var spoken: String?
  @ViewBuilder let content: Content

  @Environment(\.codeWraps) private var wraps
  @Environment(\.codeSurface) private var surface
  @Environment(\.colorSchemeContrast) private var contrast
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    // Wide enough for an arrow under a one-digit number.
    let gutter =
      max(CGFloat(digits), 1.25) * codeColumn(dynamicTypeSize, legibility: legibilityWeight)
    let rowPadding = TypeStyle.code.rowGap(dynamicTypeSize) / 2

    let row = HStack(alignment: .firstTextBaseline, spacing: 0) {
      Text(verbatim: "\(number)")
        .foregroundStyle(.mutedForeground)
        .frame(width: gutter, alignment: .trailing)
        .padding(.vertical, rowPadding)
        .padding(.trailing, 6)
        .background(surface ?? .clear)
        .background {
          GeometryReader { place in
            Color.clear.preference(key: CodeGutterKey.self, value: place.size.width)
          }
        }
        .visualEffect { [pinned = surface != nil] number, place in
          number.offset(
            x: pinned ? max(0, -place.frame(in: .scrollView(axis: .horizontal)).minX) : 0)
        }
        .zIndex(1)
        .accessibilityHidden(true)

      content
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, rowPadding)
        .padding(.horizontal, 6)
        .background(background, in: .rect(cornerRadius: Radius.sm))
        .overlay(alignment: .leading) {
          if tone == .current {
            Rectangle().fill(.vizHighlight).frame(width: 3)
          }
        }
        .overlay {
          if tone == .editable {
            RoundedRectangle(cornerRadius: Radius.sm)
              .strokeBorder(Color.vizAccent.opacity(contrast == .increased ? 1 : 0.4))
          }
        }
    }
    .overlay(alignment: .topLeading) {
      if wraps {
        ContinuationMarks(rowHeight: TypeStyle.code.rowHeight(dynamicTypeSize))
          .frame(width: gutter)
      }
    }

    if let spoken {
      row
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(verbatim: spoken))
    } else {
      row
    }
  }

  private var background: Color {
    switch tone {
    case .plain: .clear
    case .current: .vizHighlight.opacity(0.15)
    case .editable: .boxBackground
    case .error: Color.destructive.opacity(0.12)
    }
  }
}

/// How wide a scrolling program's numbers are, so its start fade begins past them.
private struct CodeGutterKey: PreferenceKey {
  static let defaultValue: CGFloat = 0

  static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
    value = max(value, nextValue())
  }
}

/// One arrow for each row of a wrapped line after its first, as an editor marks them: at the end of
/// its frame under a line's number, or at its start where a snippet's rows hang in.
private struct ContinuationMarks: View {
  let rowHeight: CGFloat
  var anchor = UnitPoint.trailing

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    let size = TypeStyle.code.pointSize(dynamicTypeSize) * 0.7

    Canvas { context, canvas in
      let rows = Int((canvas.height / rowHeight).rounded())

      guard rows > 1 else {
        return
      }

      let arrow = context.resolve(
        Text(Image(systemName: "arrow.turn.down.right"))
          .font(.system(size: size))
          .foregroundStyle(.mutedForeground))

      for row in 1..<rows {
        context.draw(
          arrow,
          at: CGPoint(x: canvas.width * anchor.x, y: (CGFloat(row) + 0.5) * rowHeight),
          anchor: anchor)
      }
    }
    .accessibilityHidden(true)
  }
}

/// Main's `CodeTokens`: a line's colored runs. Wrapped, its extra rows start at its own
/// indentation, `hang` columns further in, each after an arrow there.
struct CodeText: View {
  let tokens: [CodeHighlight.Token]
  /// For a line with no number to carry the arrows that mark its extra rows.
  var hang = 0

  @Environment(\.codeWraps) private var wraps
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    let line = CodeLineText(tokens)
    let column = codeColumn(dynamicTypeSize, legibility: legibilityWeight)
    let hang = wraps ? CGFloat(hang) * column : 0

    Text(line.drawn(breaks: wraps))
      .textRenderer(HangingIndent(width: hang))
      .padding(.leading, CGFloat(line.indent) * column + hang)
      .fixedSize(horizontal: !wraps, vertical: true)
      .overlay(alignment: .topLeading) {
        if hang > 0 {
          // Half a row's gap above and below, as a numbered line's own padding gives its arrows.
          ContinuationMarks(
            rowHeight: TypeStyle.code.rowHeight(dynamicTypeSize), anchor: .leading
          )
          .frame(width: hang)
          .padding(.vertical, -TypeStyle.code.rowGap(dynamicTypeSize) / 2)
          .offset(x: CGFloat(line.indent) * column)
        }
      }
      .accessibilityLabel(Text(verbatim: line.written))
      .accessibilityHidden(line.written.allSatisfy(\.isWhitespace))
  }
}

/// Draws the first row `width` further out than the rest, outside the text's frame: a side
/// `displayPadding` would make SwiftUI lay the rows out wider than it measured them.
private struct HangingIndent: TextRenderer {
  let width: CGFloat

  func draw(layout: Text.Layout, in context: inout GraphicsContext) {
    for (index, line) in layout.enumerated() {
      if index == 0, width > 0 {
        var first = context
        first.translateBy(x: -width, y: 0)
        first.draw(line)
      } else {
        context.draw(line)
      }
    }
  }
}

/// A line of code as drawn: its indentation in columns, then its runs, each tab reaching the next
/// of main's 4-column stops.
struct CodeLineText {
  static let tabSize = 4

  let indent: Int
  let runs: [CodeHighlight.Token]
  /// As written, for VoiceOver.
  let written: String

  init(_ tokens: [CodeHighlight.Token]) {
    var column = 0
    var expanded: [CodeHighlight.Token] = []

    for token in tokens {
      var text = ""

      for character in token.text {
        if character == "\t" {
          let spaces = Self.tabSize - column % Self.tabSize
          text += String(repeating: " ", count: spaces)
          column += spaces
        } else {
          text.append(character)
          column += 1
        }
      }

      expanded.append(CodeHighlight.Token(kind: token.kind, text: text))
    }

    var indent = 0

    while let first = expanded.first, first.text.first == " " {
      let spaces = first.text.prefix { $0 == " " }.count
      indent += spaces
      expanded[0].text.removeFirst(spaces)

      if expanded[0].text.isEmpty {
        expanded.removeFirst()
      }
    }

    self.indent = indent
    self.runs = expanded
    self.written = tokens.map(\.text).joined()
  }

  /// `breaks` lets a wrapped line split where main's does.
  func drawn(breaks: Bool) -> AttributedString {
    guard !runs.isEmpty else {
      return AttributedString(" ")
    }

    var text = AttributedString()
    var previous: Character?

    for token in runs {
      if breaks, let previous, let first = token.text.first,
        CodeBreaks.breaks(between: previous, and: first)
      {
        text += AttributedString(String(CodeBreaks.mark))
      }

      text += CodeHighlight.styled(
        breaks && token.kind == .plain ? CodeBreaks.inserted(into: token.text) : token.text,
        token.kind)
      previous = token.text.last
    }

    return text
  }
}

extension CodeHighlight {
  /// Main's colors by token: each a viz role's word color, which reads on any panel or tint.
  static func styled(_ text: String, _ kind: Kind) -> AttributedString {
    var run = AttributedString(text)

    switch kind {
    case .keyword:
      run.foregroundColor = .vizAccentText
    case .builtin:
      run.foregroundColor = .vizSecondaryText
    case .number, .string:
      run.foregroundColor = .vizHighlightText
    case .comment:
      run.foregroundColor = .mutedForeground
      run.inlinePresentationIntent = .emphasized
    case .plain:
      break
    }

    return run
  }
}

/// One column of code: Geist Mono's figures and letters are all this wide.
private func codeColumn(_ dynamicTypeSize: DynamicTypeSize, legibility: LegibilityWeight?)
  -> CGFloat
{
  TypeStyle.code.width(of: "0", dynamicTypeSize: dynamicTypeSize, legibility: legibility)
}

/// Main's `CodeListing`: a program with its lines numbered. `language` is a fence's name for it,
/// or nil; `current` is the line a trace is on.
struct CodeListing: View {
  let code: String
  let language: String?
  var variant = CodeFrameVariant.inset
  var current: Int?

  var body: some View {
    let lines = CodeHighlight.lines(of: code, language: language)

    CodeFrame(variant: variant) {
      ForEach(Array(lines.enumerated()), id: \.offset) { index, tokens in
        let number = index + 1

        CodeLine(
          number: number, digits: String(lines.count).count,
          tone: current == number ? .current : .plain,
          spoken: SpokenCode.line(tokens.map(\.text).joined(), number: number)
        ) {
          CodeText(tokens: tokens)
        }
        .accessibilityAddTraits(current == number ? .isSelected : [])
      }
    }
  }
}

/// Main's `CodeBlock`: a fenced block in a lesson's, a question's or the buddy's text, in the ink
/// color whatever the text around it, so a dimmed question's program stays readable. Its lines draw
/// their indentation as room and their break points as zero-width spaces, so selecting one would
/// copy neither as written: a long press copies the program instead, as the web's selection does.
struct CodeBlock: View {
  let code: String
  let language: String?

  var body: some View {
    CodeListing(code: code, language: language, variant: .panel)
      .foregroundStyle(Color(.foreground))
      .textSelection(.disabled)
      .contentShape(.contextMenuPreview, .rect(cornerRadius: Radius.xl, style: .continuous))
      .contextMenu {
        Button {
          UIPasteboard.general.string = code
        } label: {
          Label {
            Text("Copy", tableName: "DesignSystem", comment: "Copies a block of program code")
          } icon: {
            Image(systemName: "doc.on.doc")
          }
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text(
          "Code", tableName: "DesignSystem",
          comment:
            "Name of a block of program code in a lesson or a question, read by screen readers."))
  }
}

/// Main's `CodeSnippet`: code inside something the learner presses or reads in one line, such as an
/// answer option. No panel and no line numbers: each line wraps, its extra rows two columns further
/// in than it, after an arrow, as a block marks them under its numbers.
struct CodeSnippet: View {
  let code: String
  let language: String?

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize

  var body: some View {
    VStack(alignment: .leading, spacing: TypeStyle.code.rowGap(dynamicTypeSize)) {
      ForEach(
        Array(CodeHighlight.lines(of: code, language: language).enumerated()), id: \.offset
      ) { _, tokens in
        CodeText(tokens: tokens, hang: 2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .typeStyle(.code)
    .environment(\.codeWraps, true)
    .environment(\.layoutDirection, .leftToRight)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(Text(verbatim: SpokenCode.snippet(code)))
  }
}
