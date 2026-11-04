import Charts
import SwiftUI

struct LessonRichText: View {
  let text: String
  let literalNumbers: Bool

  init(_ text: String, literalNumbers: Bool = false) {
    self.text = text
    self.literalNumbers = literalNumbers
  }

  var body: some View {
    Text(Self.typeset(text, literalNumbers: literalNumbers))
  }

  static func typeset(_ text: String, literalNumbers: Bool = false) -> RichInline {
    // An escaped dollar is a price, never the edge of a formula.
    let escaped = text.replacingOccurrences(of: "\\$", with: dollarPlaceholder)
    var result = RichInline(text: AttributedString())
    var rest = Substring(escaped)

    while let match = rest.firstMatch(
      of: /\$\$(.+?)\$\$|\$([^$\s][^$]*?[^$\s]|[^$\s])\$(?!\d)/.dotMatchesNewlines())
    {
      result += markdown(rest[..<match.range.lowerBound], literalNumbers: literalNumbers)
      let formula = String(match.output.1 ?? match.output.2 ?? "")
      result +=
        match.output.1 != nil || isFormula(formula)
        ? LessonMath.typeset(formula.replacingOccurrences(of: dollarPlaceholder, with: "\\$"))
        : markdown(match.output.0, literalNumbers: literalNumbers)
      rest = rest[match.range.upperBound...]
    }

    return result + markdown(rest, literalNumbers: literalNumbers)
  }

  private static let dollarPlaceholder = "\u{FFFC}"

  private static func markdown(_ text: Substring, literalNumbers: Bool) -> RichInline {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace)
    let restored = text.replacingOccurrences(of: dollarPlaceholder, with: "$")
    let parsed =
      (try? AttributedString(markdown: restored, options: options)) ?? AttributedString(restored)
    return RichInline(text: literalNumbers ? parsed : RichTextTypography.typesetNumbers(in: parsed))
  }

  /// Prices ("$5 and $10") stay text: a formula between single dollars has math in it.
  private static func isFormula(_ text: String) -> Bool {
    text.contains { "\\^_={}+-*/<>()".contains($0) } || text.allSatisfy(\.isLetter)
  }
}

struct LessonTextBlocks: View {
  let text: String
  let mark: String?

  init(_ text: String, mark: String? = nil) {
    self.text = text
    self.mark = mark
  }

  var body: some View {
    RichTextBlocks(text, mark: mark) { LessonRichText.typeset($0) }
  }
}

/// Main's `LessonEyebrow`: what kind of screen this is, as a chip over its question.
struct LessonEyebrow: View {
  let title: Text
  let systemImage: String

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 6) {
      Image(systemName: systemImage)
        .imageScale(.small)
        .accessibilityHidden(true)
      title
    }
    .chip(wraps: true)
  }
}

struct LessonQuestionText: View {
  let text: String

  var body: some View {
    LessonRichText(text)
      .typeStyle(.question)
      .dimsOnceChecked()
      .fixedSize(horizontal: false, vertical: true)
      .accessibilityAddTraits(.isHeader)
  }
}

extension EnvironmentValues {
  @Entry var lessonScreenHeight: CGFloat = .infinity
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
  @Environment(\.imageLoader) private var images
  @Environment(\.lessonScreenHeight) private var screenHeight
  @Environment(SessionStore.self) private var session

  let image: LessonStepImage?
  let alt: String?
  let isPending: Bool
  /// A question's picture says what it shows until it's there, since the question may need it.
  var asks = false
  var hero = false

  var body: some View {
    if let image, let url = URL(string: image.url) {
      picture(url: url, image: image)
    } else if let alt, isPending {
      LessonPicturePlaceholder(alt: asks ? alt : nil, saysItIsDrawing: true)
        .pictureFrame(aspectRatio: LessonPicturePlaceholder.aspectRatio, maxHeight: maxHeight)
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
      .background(Color.muted.opacity(0.5), in: .rect(cornerRadius: Radius.xl, style: .continuous))
    }
  }

  private var maxHeight: CGFloat {
    let frame: LessonPictureFrame = asks ? .question : hero ? .hero : .inline
    return frame.maxHeight(screen: screenHeight)
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
      aspectRatio: aspectRatio ?? LessonPicturePlaceholder.aspectRatio, maxHeight: maxHeight
    )
    .accessibilityElement()
    .accessibilityLabel(Text(alt ?? ""))
    .accessibilityAddTraits(.isImage)
  }
}

/// Holds a picture's place until it's drawn and loaded, so nothing moves when it comes. Its
/// description says what the question needs meanwhile; only the fill pulses, so it stays readable.
struct LessonPicturePlaceholder: View {
  /// Pictures are drawn at 1024 by 1280, as main's default.
  static let aspectRatio: CGFloat = 4 / 5

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
  func pictureFrame(aspectRatio: CGFloat, maxHeight: CGFloat = .infinity) -> some View {
    PictureFrameLayout(aspectRatio: aspectRatio, maxHeight: maxHeight) { self }
      .clipShape(.rect(cornerRadius: Radius.xl, style: .continuous))
      .frame(maxWidth: .infinity, alignment: .leading)
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

private struct LessonChartView: View {
  let chart: LessonChart

  private struct Point: Identifiable {
    let series: String
    let category: String
    let value: Double
    var id: String { "\(series)-\(category)" }
  }

  private var points: [Point] {
    chart.series.flatMap { series in
      zip(chart.categories, series.values).map {
        Point(series: series.name, category: $0, value: $1)
      }
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(chart.title)
        .typeStyle(.body.weight(.semibold))

      Chart(points) { point in
        if chart.chart == .bar {
          BarMark(
            x: .value(chart.categoryLabel, point.category), y: .value(chart.valueLabel, point.value)
          )
          .foregroundStyle(by: .value(verbatim: "Series", point.series))
          .position(by: .value(verbatim: "Series", point.series))
        } else {
          LineMark(
            x: .value(chart.categoryLabel, point.category), y: .value(chart.valueLabel, point.value)
          )
          .foregroundStyle(by: .value(verbatim: "Series", point.series))
          .symbol(by: .value(verbatim: "Series", point.series))
        }
      }
      .chartYScale(domain: .automatic(includesZero: chart.axisStart == nil || chart.axisStart == 0))
      .lessonValueAxis()
      .chartYAxisLabel(chart.unit.map { "\(chart.valueLabel) (\($0))" } ?? chart.valueLabel)
      .chartXAxisLabel(chart.categoryLabel)
      .chartLegend(chart.series.count > 1 ? .visible : .hidden)
      .frame(minHeight: 200)

      if let source = chart.source {
        Text(source)
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
  }
}

extension View {
  func lessonValueAxis() -> some View {
    chartYAxis {
      AxisMarks { value in
        AxisGridLine().foregroundStyle(.vizGrid)
        AxisTick().foregroundStyle(.vizGrid)
        AxisValueLabel {
          if let y = value.as(Double.self) {
            Text(verbatim: ActivityNumberFormat.format(y, compact: true))
          }
        }
      }
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
