import Charts
import SwiftUI

/// Lesson text: bold, italics and code from its Markdown, and formulas between dollar signs set in
/// a monospaced run with their common symbols ("0.75 × 80 = 60").
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
    let withMath = escaped.replacing(/\$\$(.+?)\$\$|\$([^$\s][^$]*?[^$\s]|[^$\s])\$(?!\d)/) {
      match in
      let formula = String(match.output.1 ?? match.output.2 ?? "")
      return isFormula(formula) ? "`\(readable(formula))`" : String(match.output.0)
    }

    let options = AttributedString.MarkdownParsingOptions(
      interpretedSyntax: .inlineOnlyPreservingWhitespace)
    let markdown = withMath.replacingOccurrences(of: dollarPlaceholder, with: "$")
    return (try? AttributedString(markdown: markdown, options: options)) ?? AttributedString(text)
  }

  private static let dollarPlaceholder = "\u{FFFC}"

  /// Prices ("$5 and $10") stay text: a formula has math in it.
  private static func isFormula(_ text: String) -> Bool {
    text.contains { "\\^_={}+-*/<>()".contains($0) } || text.allSatisfy(\.isLetter)
  }

  /// A formula as plain symbols: "R$ 50.000.000 ÷ 10.000.000 = R$ 5".
  static func readable(_ formula: String) -> String {
    let symbols: [(String, String)] = [
      ("\\left", ""), ("\\right", ""), ("\\times", "×"), ("\\cdot", "·"), ("\\div", "÷"),
      ("\\leq", "≤"), ("\\le", "≤"),
      ("\\geq", "≥"), ("\\ge", "≥"), ("\\neq", "≠"), ("\\approx", "≈"), ("\\pm", "±"),
      ("\\pi", "π"), ("\\infty", "∞"), ("\\sqrt", "√"), ("\\%", "%"), ("\\$", "$"), ("\\,", " "),
      ("\\;", " "), ("\\ ", " "),
    ]
    var readable = formula.replacing(/\\frac\{([^}]*)\}\{([^}]*)\}/) {
      "(\($0.output.1))/(\($0.output.2))"
    }
    readable = readable.replacing(/\\(?:text|mathrm|mathbf|operatorname)\{([^}]*)\}/) {
      String($0.output.1)
    }

    for (command, symbol) in symbols {
      readable = readable.replacingOccurrences(of: command, with: symbol)
    }

    return readable.replacingOccurrences(of: "{", with: "").replacingOccurrences(of: "}", with: "")
      .replacingOccurrences(of: dollarPlaceholder, with: "$")
  }
}

/// A screen's title, question or prompt.
struct LessonQuestionText: View {
  let text: String

  var body: some View {
    LessonRichText(text)
      .font(.title2.weight(.semibold))
      .fixedSize(horizontal: false, vertical: true)
      .accessibilityAddTraits(.isHeader)
  }
}

/// A screen's picture once drawn; while it's drawn, or when it can't load, its description.
struct LessonPictureView: View {
  @Environment(\.privateImageLoader) private var privateImages
  @Environment(SessionStore.self) private var session

  let image: LessonStepImage?
  let description: LessonPictureDescription?
  let isPending: Bool

  var body: some View {
    if let image, let url = URL(string: image.url) {
      picture(url: url, alt: image.alt ?? description?.alt)
    } else if let description, isPending {
      Label {
        Text(
          "Drawing the picture…", tableName: "Player", comment: "While a screen's picture is drawn")
      } icon: {
        Image(systemName: "photo")
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
      .accessibilityHint(Text(description.alt))
    }
  }

  @ViewBuilder
  private func picture(url: URL, alt: String?) -> some View {
    let aspectRatio = image.flatMap { image in
      image.width.flatMap { width in image.height.map { CGFloat(width) / CGFloat(max($0, 1)) } }
    }

    Group {
      if let privateImages, privateImages.requiresSession(url) {
        LessonPrivatePicture(
          loader: privateImages, token: session.authenticatedSession?.bearerToken, url: url)
      } else {
        AsyncImage(url: url) { phase in
          if let picture = phase.image {
            picture.resizable().scaledToFit()
          } else {
            Color(.secondarySystemBackground)
          }
        }
      }
    }
    .aspectRatio(aspectRatio ?? 4 / 3, contentMode: .fit)
    .frame(maxWidth: .infinity)
    .clipShape(.rect(cornerRadius: 16))
    .accessibilityElement()
    .accessibilityLabel(Text(alt ?? ""))
    .accessibilityAddTraits(.isImage)
  }
}

private struct LessonPrivatePicture: View {
  let loader: PrivateImageLoader
  let token: String?
  let url: URL
  @State private var image: UIImage?

  var body: some View {
    Group {
      if let image {
        Image(uiImage: image).resizable().scaledToFit()
      } else {
        Color(.secondarySystemBackground)
      }
    }
    .task(id: url) {
      guard let token else { return }
      image = await loader.image(for: url, token: token)
    }
  }
}

/// A chart or a timeline drawn from a screen's data.
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
            .foregroundStyle(.blue)

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

/// Where a screen comes from, quietly under it.
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
