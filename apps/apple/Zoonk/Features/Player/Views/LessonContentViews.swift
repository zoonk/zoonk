import SwiftUI

/// Main's `LessonRichText`: one line of lesson text. A text that is one code block, such as an
/// option that is a program, shows as code.
struct LessonRichText: View {
  let text: String
  let literalNumbers: Bool

  init(_ text: String, literalNumbers: Bool = false) {
    self.text = text
    self.literalNumbers = literalNumbers
  }

  var body: some View {
    let inline = Self.typeset(text, literalNumbers: literalNumbers)

    if let snippet = inline.snippet {
      CodeSnippet(code: snippet.code, language: snippet.language)
    } else {
      RichInlineText(inline)
    }
  }

  nonisolated static func typeset(_ text: String, literalNumbers: Bool = false) -> RichInline {
    var line = CodeFence.line(text) { prose($0, literalNumbers: literalNumbers) }
    line.snippet = CodeFence.whole(text)
    return line
  }

  nonisolated private static func prose(_ text: String, literalNumbers: Bool) -> RichInline {
    LessonMathSegment.split(text).reduce(RichInline(text: AttributedString())) { result, segment in
      switch segment.kind {
      case .text: result + markdown(segment.text, literalNumbers: literalNumbers)
      case .math, .displayMath: result + LessonMath.typeset(segment.text)
      }
    }
  }

  /// Text that isn't valid Markdown stays as written.
  nonisolated private static func markdown(_ text: String, literalNumbers: Bool) -> RichInline {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace,
      failurePolicy: .returnPartiallyParsedIfPossible)
    let parsed = CodeBreaks.inserted(
      into: (try? AttributedString(markdown: text, options: options)) ?? AttributedString(text))
    return RichInline(text: literalNumbers ? parsed : RichTextTypography.typesetNumbers(in: parsed))
  }
}

struct LessonSummaryIdeas: View {
  let ideas: [String]

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      ForEach(Array(ideas.enumerated()), id: \.offset) { index, idea in
        if index > 0 { Divider() }
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(index + 1, format: .number)
            .typeStyle(.data)
            .foregroundStyle(.mutedForeground)
          LessonRichText(idea)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
      }
    }
  }
}

struct LessonTextBlocks: View {
  @Environment(\.highlightsLessonTerms) private var highlightsTerms

  let text: String
  let mark: String?
  let underline: String?
  let wordTraits: AccessibilityTraits

  init(
    _ text: String, mark: String? = nil, underline: String? = nil,
    wordTraits: AccessibilityTraits = []
  ) {
    self.text = text
    self.mark = mark
    self.underline = underline
    self.wordTraits = wordTraits
  }

  var body: some View {
    RichTextBlocks(
      text, mark: mark,
      marks: underline != nil || highlightsTerms
        ? RichTextMarks(underline: underline, highlightsTerms: highlightsTerms) : nil,
      wordTraits: wordTraits
    ) { LessonRichText.typeset($0) }
  }
}

/// Main's `LessonContext`: the table, code or words a check asks about, over its question.
struct LessonContextText: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    LessonTextBlocks(text)
      .typeStyle(.lessonContext)
  }
}

/// A question as a VoiceOver heading, with any table or code it asks about above it as a check's
/// context.
struct LessonQuestionText: View {
  let text: String

  var body: some View {
    let parts = LessonQuestionParts(text)

    if let data = parts.data {
      LessonContextText(data)
    }

    if !parts.question.isEmpty {
      LessonRichText(parts.question)
        .typeStyle(.question)
        .dimsOnceChecked()
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityAddTraits(.isHeader)
    }
  }
}

/// Main's `splitQuestionData`: in a question with a table or a code block, the last run of prose
/// lines asks, and the rest is its data.
struct LessonQuestionParts: Equatable {
  let data: String?
  let question: String
}

extension LessonQuestionParts {
  init(_ text: String) {
    let lines = RichTextBlock.lines(text)
    let dataLines = RichTextBlock.tableLines(lines).union(CodeFence.lines(in: lines))

    guard !dataLines.isEmpty else {
      self.init(data: nil, question: text)
      return
    }

    let isProse = { (index: Int) in
      !dataLines.contains(index) && !lines[index].trimmingCharacters(in: .whitespaces).isEmpty
    }

    guard let end = lines.indices.last(where: isProse) else {
      self.init(data: text, question: "")
      return
    }

    let start = (lines.indices.last { $0 < end && !isProse($0) } ?? -1) + 1
    let data = (lines[..<start] + lines[(end + 1)...]).joined(separator: "\n")

    self.init(
      data: data.trimmingCharacters(in: .whitespacesAndNewlines),
      question: lines[start...end].joined(separator: "\n"))
  }
}

extension EnvironmentValues {
  @Entry var highlightsLessonTerms = false
  @Entry var lessonScreenHeight: CGFloat = .infinity
  /// Between the lesson's bars: what a screen and its action bar share.
  @Entry var lessonPageHeight: CGFloat = .infinity
  @Entry var isLessonStepChecked = false
}

extension View {
  /// Main's question text: once checked, it steps back so the learner's eyes go to the verdict.
  func dimsOnceChecked() -> some View {
    modifier(DimsOnceChecked())
  }
}

private struct DimsOnceChecked: ViewModifier {
  @Environment(\.isLessonStepChecked) private var isChecked

  func body(content: Content) -> some View {
    content.foregroundStyle(isChecked ? Color.mutedForeground : .primary)
  }
}

/// Main's caps on a lesson picture's height, as shares of the screen's: a read screen's lead
/// picture, one inside a step, and a question's, which keeps its options in view.
enum LessonPictureFrame {
  case hero
  case inline
  case question

  func maxHeight(screen: CGFloat) -> CGFloat {
    switch self {
    case .hero: screen * 0.55
    case .inline: screen * 0.45
    case .question: screen * 0.4
    }
  }
}

struct LessonPictureView: View {
  @Environment(\.horizontalSizeClass) private var horizontalSizeClass
  @Environment(\.imageLoader) private var images
  @Environment(\.lessonScreenHeight) private var screenHeight
  @Environment(\.lessonPageHeight) private var pageHeight
  @Environment(\.isPaneSplit) private var isPaneSplit
  /// What the opening guess's page holds besides its picture: the chip, a three-line question,
  /// three options and the action bar.
  @ScaledMetric(relativeTo: .title2) private var openingReserve: CGFloat = 520
  @Environment(SessionStore.self) private var session

  let image: LessonStepImage?
  let alt: String?
  let isPending: Bool
  /// A question's picture says what it shows until it's there, since the question may need it.
  var asks = false
  var hero = false
  /// The opening guess's picture comes before its question, so in one column it gives up its height
  /// for the question and options, down to a floor where it still reads. On a spread they face it.
  var opens = false
  /// The shape pictures of this kind are drawn at, held while one draws.
  var drawnAspectRatio = LessonPicturePlaceholder.screenAspectRatio

  var body: some View {
    if let image, let url = URL(string: image.url) {
      picture(url: url, image: image)
    } else if let alt, isPending {
      LessonPicturePlaceholder(alt: asks ? alt : nil, saysItIsDrawing: true)
        .pictureFrame(aspectRatio: drawnAspectRatio, maxHeight: maxHeight, alignment: alignment)
    } else if let alt, asks {
      Label {
        Text(alt)
      } icon: {
        Image(systemName: "photo")
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .well()
    }
  }

  private var maxHeight: CGFloat {
    let frame: LessonPictureFrame = asks ? .question : hero ? .hero : .inline
    let cap = frame.maxHeight(screen: screenHeight)
    return opens && !isPaneSplit ? max(140, min(pageHeight - openingReserve, cap)) : cap
  }

  private var alignment: Alignment {
    horizontalSizeClass == .regular && !asks ? .leading : .center
  }

  private func picture(url: URL, image: LessonStepImage) -> some View {
    let aspectRatio = image.width.flatMap { width in
      image.height.map { CGFloat(width) / CGFloat(max($0, 1)) }
    }
    let alt = image.alt ?? self.alt
    let loading = LessonPicturePlaceholder(alt: asks ? alt : nil, isDrawing: false)

    return Group {
      if let images, images.requiresSession(url) {
        LessonPrivatePicture(
          loader: images, token: session.authenticatedSession?.bearerToken, url: url,
          placeholder: loading)
      } else {
        AsyncImage(url: url) { phase in
          if let picture = phase.image {
            picture.resizable().scaledToFit()
          } else {
            loading
          }
        }
      }
    }
    .pictureFrame(
      aspectRatio: aspectRatio ?? drawnAspectRatio, maxHeight: maxHeight, alignment: alignment
    )
    .accessibilityElement()
    .accessibilityLabel(Text(alt ?? ""))
    .accessibilityAddTraits(.isImage)
  }
}

/// Holds a picture's place until it's drawn and loaded, so nothing moves when it comes. Its
/// description says what the question needs meanwhile; only the fill pulses, so it stays readable.
struct LessonPicturePlaceholder: View {
  /// New screen pictures are drawn at 1536 by 1024 and option pictures at 1024 by 1024; a stored
  /// picture keeps the size it says it has.
  static let screenAspectRatio: CGFloat = 3 / 2
  static let optionAspectRatio: CGFloat = 1

  let alt: String?
  var saysItIsDrawing = false
  /// A picture that's downloading, or didn't load, holds still.
  var isDrawing = true

  var body: some View {
    // A long description, or a large text size, scrolls inside the frame rather than being cut off.
    ViewThatFits(in: .vertical) {
      description
      ScrollView { description }
    }
    .typeStyle(.note)
    .foregroundStyle(.mutedForeground)
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background { MediaPendingFill(pulses: isDrawing) }
    .accessibilityElement(children: .combine)
  }

  private var description: some View {
    VStack(spacing: 8) {
      Image(systemName: "photo")
        .typeStyle(.section.weight(.regular))
        .accessibilityHidden(true)

      if saysItIsDrawing {
        Text(
          "Drawing the picture…", tableName: "Player", comment: "While a screen's picture is drawn")
      }

      if let alt {
        Text(alt)
      }
    }
    .padding(12)
  }
}

extension View {
  /// A picture's shape at the width it's offered, no taller than `maxHeight`; whatever holds its
  /// place gets the same frame.
  func pictureFrame(
    aspectRatio: CGFloat, maxHeight: CGFloat = .infinity, alignment: Alignment = .center
  ) -> some View {
    PictureFrameLayout(aspectRatio: aspectRatio, maxHeight: maxHeight) { self }
      .clipShape(.rect(cornerRadius: Radius.xl, style: .continuous))
      .frame(maxWidth: .infinity, alignment: alignment)
  }
}

private struct PictureFrameLayout: Layout {
  let aspectRatio: CGFloat
  let maxHeight: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = min(proposal.replacingUnspecifiedDimensions().width, maxHeight * aspectRatio)
    return CGSize(width: width, height: width / aspectRatio)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    for subview in subviews {
      subview.place(at: bounds.origin, proposal: ProposedViewSize(bounds.size))
    }
  }
}

private struct LessonPrivatePicture: View {
  let loader: ImageLoader
  let token: String?
  let url: URL
  let placeholder: LessonPicturePlaceholder
  @State private var image: UIImage?

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image).resizable().scaledToFit()
      } else {
        placeholder
      }
    }
    .task(id: url) {
      guard let token else { return }
      image = await loader.image(for: url, token: token)
    }
  }
}

struct LessonVisualView: View {
  let visual: LessonVisual

  var body: some View {
    switch visual {
    case .chart(let chart):
      LessonChartView(chart: chart)
    case .timeline(let timeline):
      LessonTimelineView(timeline: timeline)
    }
  }
}

private struct LessonTimelineView: View {
  let timeline: LessonTimeline

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(timeline.title)
        .typeStyle(.body.weight(.semibold))

      ForEach(Array(timeline.events.enumerated()), id: \.offset) { _, event in
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(event.date)
            .typeStyle(.body.weight(.semibold).monospaced())
            .foregroundStyle(.successText)

          VStack(alignment: .leading, spacing: 2) {
            Text(event.label)
              .typeStyle(.body.weight(.medium))
            if let detail = event.detail {
              Text(detail)
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
            }
          }
        }
        .accessibilityElement(children: .combine)
      }
    }
  }
}

struct LessonCitationView: View {
  let citation: LessonCitation

  var body: some View {
    switch citation {
    case .material(let title, let unit, let page):
      let source = CitationLabel.material(title: title, page: page, unit: unit)

      Label(source, systemImage: "doc.text")
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .accessibilityLabel(
          Text(
            "From your material: \(source)", tableName: "Player",
            comment: "A screen comes from the learner's own material"))
    case .source(let title, let publisher, let url, let checkedAt):
      SourcesChip(title: title, publisher: publisher, url: url, checkedAt: checkedAt)
    case .notInMaterial:
      Label {
        Text(
          "Not in your material", tableName: "Player",
          comment: "A screen that doesn't come from the learner's material")
      } icon: {
        Image(systemName: "doc.questionmark")
      }
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
    }
  }
}
