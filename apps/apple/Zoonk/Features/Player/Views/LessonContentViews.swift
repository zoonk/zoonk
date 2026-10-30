import Charts
import SwiftUI

struct LessonRichText: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    Text(Self.attributed(text))
  }

  static func attributed(_ text: String) -> AttributedString {
    // An escaped dollar is a price, never the edge of a formula.
    let escaped = text.replacingOccurrences(of: "\\$", with: dollarPlaceholder)
    var result = AttributedString()
    var rest = Substring(escaped)

    while let match = rest.firstMatch(of: /\$\$(.+?)\$\$|\$([^$\s][^$]*?[^$\s]|[^$\s])\$(?!\d)/) {
      result += markdown(rest[..<match.range.lowerBound])
      let formula = String(match.output.1 ?? match.output.2 ?? "")
      result +=
        isFormula(formula)
        ? LessonMath.attributed(formula.replacingOccurrences(of: dollarPlaceholder, with: "\\$"))
        : markdown(match.output.0)
      rest = rest[match.range.upperBound...]
    }

    return result + markdown(rest)
  }

  private static let dollarPlaceholder = "\u{FFFC}"

  private static func markdown(_ text: Substring) -> AttributedString {
    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace)
    let restored = text.replacingOccurrences(of: dollarPlaceholder, with: "$")
    return RichTextTypography.typesetNumbers(
      in: (try? AttributedString(markdown: restored, options: options))
        ?? AttributedString(restored))
  }

  /// Prices ("$5 and $10") stay text: a formula has math in it.
  private static func isFormula(_ text: String) -> Bool {
    text.contains { "\\^_={}+-*/<>()".contains($0) } || text.allSatisfy(\.isLetter)
  }
}

struct LessonTextBlocks: View {
  let text: String

  init(_ text: String) {
    self.text = text
  }

  var body: some View {
    RichTextBlocks(text) { LessonRichText.attributed($0) }
  }
}

struct LessonQuestionText: View {
  let text: String

  var body: some View {
    LessonRichText(text)
      .font(.title2.weight(.semibold))
      .fixedSize(horizontal: false, vertical: true)
      .accessibilityAddTraits(.isHeader)
  }
}

extension EnvironmentValues {
  @Entry var lessonScreenHeight: CGFloat = .infinity
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
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding()
      .background(.fill.tertiary, in: .rect(cornerRadius: 16))
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
    .font(.subheadline)
    .foregroundStyle(.secondary)
    .multilineTextAlignment(.center)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background { MediaPendingFill(pulses: isDrawing) }
    .accessibilityElement(children: .combine)
  }

  private var description: some View {
    VStack(spacing: 8) {
      Image(systemName: "photo")
        .font(.title2)
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
      .clipShape(.rect(cornerRadius: 16))
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
        .font(.headline)

      Chart(points) { point in
        if chart.chart == .bar {
          BarMark(
            x: .value(chart.categoryLabel, point.category), y: .value(chart.valueLabel, point.value)
          )
          .foregroundStyle(by: .value("Series", point.series))
          .position(by: .value("Series", point.series))
        } else {
          LineMark(
            x: .value(chart.categoryLabel, point.category), y: .value(chart.valueLabel, point.value)
          )
          .foregroundStyle(by: .value("Series", point.series))
          .symbol(by: .value("Series", point.series))
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
          .font(.caption)
          .foregroundStyle(.secondary)
      }
    }
  }
}

extension View {
  func lessonValueAxis() -> some View {
    chartYAxis {
      AxisMarks { value in
        AxisGridLine()
        AxisTick()
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
        .font(.headline)

      ForEach(Array(timeline.events.enumerated()), id: \.offset) { _, event in
        HStack(alignment: .firstTextBaseline, spacing: 12) {
          Text(event.date)
            .font(.subheadline.monospacedDigit().weight(.semibold))
            .foregroundStyle(.success)

          VStack(alignment: .leading, spacing: 2) {
            Text(event.label)
              .font(.subheadline.weight(.medium))
            if let detail = event.detail {
              Text(detail)
                .font(.subheadline)
                .foregroundStyle(.secondary)
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
    case .material(let title, _, _):
      Label {
        Text(
          "From your material: \(title)", tableName: "Player",
          comment: "A screen comes from the learner's own material")
      } icon: {
        Image(systemName: "doc.text")
      }
      .font(.footnote)
      .foregroundStyle(.secondary)
    case .source(let title, let publisher, let url, _):
      if let url = url.flatMap(URL.init(string:)) {
        Link(destination: url) {
          Label(publisher.map { "\(title) · \($0)" } ?? title, systemImage: "link")
        }
        .font(.footnote)
      } else {
        Label(publisher.map { "\(title) · \($0)" } ?? title, systemImage: "book.closed")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    case .notInMaterial:
      Label {
        Text(
          "Not in your material", tableName: "Player",
          comment: "A screen that doesn't come from the learner's material")
      } icon: {
        Image(systemName: "doc.badge.ellipsis")
      }
      .font(.footnote)
      .foregroundStyle(.secondary)
    }
  }
}
