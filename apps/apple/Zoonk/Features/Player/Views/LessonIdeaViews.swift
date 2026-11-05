import SwiftUI

/// Where the lesson's ideas sit around their center, numbered clockwise: two face each other, an odd
/// count starts at the top, and four take the corners, as the opening map draws them.
enum LessonIdeaRing {
  static func angle(of index: Int, count: Int) -> Angle {
    let start = count.isMultiple(of: 2) ? -90 - 180 / Double(count) : -90
    return .degrees(start + Double(index) * 360 / Double(max(count, 1)))
  }

  /// On an ellipse with these radii around `center`.
  static func point(of index: Int, count: Int, center: CGPoint, radii: CGSize) -> CGPoint {
    let angle = angle(of: index, count: count).radians
    return CGPoint(
      x: center.x + radii.width * cos(angle), y: center.y + radii.height * sin(angle))
  }
}

struct LessonIdeaStrip: View {
  @Environment(\.stacksContent) private var isStacked
  @ScaledMetric(relativeTo: .headline) private var mapSize: CGFloat = 40

  let summary: LessonSummary
  let index: Int

  var body: some View {
    let idea = summary.ideas[index]

    HStack(spacing: 12) {
      if !isStacked {
        LessonIdeaMiniMap(count: summary.ideas.count, current: index)
          .frame(width: mapSize, height: mapSize)
      }

      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Idea \(index + 1) of \(summary.ideas.count)", tableName: "Player",
          comment:
            "Above a lesson screen: which of the lesson map's ideas (its main points) it teaches. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"%lld ideas to discover in this lesson\"."
        )
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)

        if let label = idea.label {
          Text(label)
            .font(.headline)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      // The idea's icon can come after the strip shows, so its place is kept for it.
      ZStack {
        if let icon = idea.icon {
          LessonIconImage(icon: icon, size: 44)
        }
      }
      .frame(width: 44, height: 44)
    }
    .padding(.bottom, 12)
    .overlay(alignment: .bottom) {
      Divider()
    }
    .accessibilityElement(children: .combine)
  }
}

extension LessonStep {
  func idea(in summary: LessonSummary?) -> Int? {
    guard let index = marks?.ideaIndex, let summary, summary.ideas.indices.contains(index) else {
      return nil
    }

    return index
  }
}

/// This idea in progress blue: the learner's place in the lesson.
private struct LessonIdeaMiniMap: View {
  let count: Int
  let current: Int

  var body: some View {
    Canvas { context, size in
      let center = CGPoint(x: size.width / 2, y: size.height / 2)
      let node = size.width * 0.1
      let radii = CGSize(width: size.width / 2 - node * 1.6, height: size.height / 2 - node * 1.6)
      let points = (0..<count).map {
        LessonIdeaRing.point(of: $0, count: count, center: center, radii: radii)
      }

      for point in points {
        var spoke = Path()
        spoke.move(to: center)
        spoke.addLine(to: point)
        context.stroke(
          spoke, with: .style(.tertiary), style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
      }

      context.fill(Self.dot(at: center, radius: node * 0.8), with: .style(.secondary))

      for (index, point) in points.enumerated() {
        if index == current {
          context.fill(
            Self.dot(at: point, radius: node * 1.6), with: .color(.success.opacity(0.25)))
          context.fill(Self.dot(at: point, radius: node), with: .color(.success))
        } else {
          context.fill(Self.dot(at: point, radius: node), with: .style(.background))
          context.stroke(
            Self.dot(at: point, radius: node), with: .style(.secondary), lineWidth: 1)
        }
      }
    }
    .accessibilityHidden(true)
  }

  private static func dot(at point: CGPoint, radius: CGFloat) -> Path {
    Path(
      ellipseIn: CGRect(
        x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2))
  }
}

/// A number opens what its idea is about, never its answer, which the lesson hasn't taught yet.
struct LessonOpeningMap: View {
  @ScaledMetric(relativeTo: .body) private var height: CGFloat = 200

  let summary: LessonSummary

  var body: some View {
    VStack(spacing: 8) {
      LessonIdeaRingLayout(count: summary.ideas.count) {
        center

        ForEach(Array(summary.ideas.enumerated()), id: \.offset) { index, idea in
          LessonOpeningIdea(index: index, idea: idea)
        }
      }
      .background { spokes }
      // Room for the ring, which doesn't grow past what large text needs around its numbers.
      .frame(height: min(height, 260))
      .frame(maxWidth: 360)

      Text(
        "\(summary.ideas.count) ideas to discover in this lesson", tableName: "Player",
        comment:
          "Under the lesson map on a lesson's opening screen; its numbers open each idea. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"%lld ideas to discover in this lesson\"."
      )
      .font(.footnote)
      .foregroundStyle(.secondary)
      .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .contain)
  }

  private let centerSize: CGFloat = 14

  private var spokes: some View {
    Canvas { context, size in
      let count = summary.ideas.count
      let middle = CGPoint(x: size.width / 2, y: size.height / 2)
      let node = LessonOpeningIdea.size
      let radii = LessonIdeaRingLayout.radii(in: size, node: CGSize(width: node, height: node))

      for index in 0..<count {
        let end = LessonIdeaRing.point(of: index, count: count, center: middle, radii: radii)
        let length = hypot(end.x - middle.x, end.y - middle.y)
        let from = centerSize / 2 + 4
        let to = length - node / 2

        guard to > from else {
          continue
        }

        let along = { (distance: CGFloat) in
          CGPoint(
            x: middle.x + (end.x - middle.x) * distance / length,
            y: middle.y + (end.y - middle.y) * distance / length)
        }
        var spoke = Path()
        spoke.move(to: along(from))
        spoke.addLine(to: along(to))
        context.stroke(
          spoke, with: .style(.tertiary), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
      }
    }
    .accessibilityHidden(true)
  }

  private var center: some View {
    Circle()
      .fill(.secondary)
      .frame(width: centerSize, height: centerSize)
      .accessibilityHidden(true)
  }
}

private struct LessonOpeningIdea: View {
  /// The icon, or the ring that stands in for it.
  static let size: CGFloat = 52

  @State private var isShowingAbout = false

  let index: Int
  let idea: LessonSummary.Idea

  var body: some View {
    if let about = idea.about {
      Button {
        isShowingAbout = true
      } label: {
        mark
      }
      .buttonStyle(.plain)
      .accessibilityLabel(name)
      .accessibilityHint(
        Text(
          "Shows what it covers", tableName: "Player",
          comment: "VoiceOver hint on an idea of the lesson map on a lesson's opening screen")
      )
      .popover(isPresented: $isShowingAbout, arrowEdge: .top) {
        Text(about)
          .font(.body)
          .foregroundStyle(.primary)
          .fixedSize(horizontal: false, vertical: true)
          .frame(maxWidth: 280, alignment: .leading)
          .padding(.horizontal)
          .padding(.vertical, 12)
          .presentationCompactAdaptation(.popover)
          .accessibilitySizeStyles()
      }
    } else {
      mark
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
    }
  }

  private var name: Text {
    Text(
      "Idea \(index + 1)", tableName: "Player",
      comment:
        "VoiceOver: one of the lesson map's ideas (its main points), by its number. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"%lld ideas to discover in this lesson\"."
    )
  }

  /// The idea's icon with its number on the corner, or the number alone in a dashed ring.
  @ViewBuilder
  private var mark: some View {
    if let icon = idea.icon {
      LessonIconImage(icon: icon, size: Self.size - 8)
        .frame(width: Self.size, height: Self.size)
        .overlay(alignment: .bottomTrailing) {
          number
            .frame(minWidth: 22, minHeight: 22)
            .background(Color(.systemBackground), in: .circle)
            .overlay {
              Circle().strokeBorder(.separator)
            }
        }
        .contentShape(.rect)
    } else {
      number
        .frame(width: Self.size, height: Self.size)
        .overlay {
          Circle()
            .strokeBorder(.tertiary, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
            .padding(4)
        }
        .contentShape(.rect)
    }
  }

  private var number: some View {
    Text(index + 1, format: .number)
      .font(.footnote.weight(.semibold).monospacedDigit())
  }
}

private struct LessonIdeaRingLayout: Layout {
  let count: Int

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    proposal.replacingUnspecifiedDimensions(by: CGSize(width: 320, height: 200))
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    guard let center = subviews.first else {
      return
    }

    let middle = CGPoint(x: bounds.midX, y: bounds.midY)
    center.place(at: middle, anchor: .center, proposal: .unspecified)

    let ideas = subviews.dropFirst()
    let largest = ideas.map { $0.sizeThatFits(.unspecified) }.reduce(CGSize.zero) {
      CGSize(width: max($0.width, $1.width), height: max($0.height, $1.height))
    }
    let radii = Self.radii(in: bounds.size, node: largest)

    for (index, idea) in ideas.enumerated() {
      idea.place(
        at: LessonIdeaRing.point(of: index, count: count, center: middle, radii: radii),
        anchor: .center, proposal: .unspecified)
    }
  }

  static func radii(in size: CGSize, node: CGSize) -> CGSize {
    CGSize(
      width: max(size.width / 2 - node.width / 2 - 8, 0),
      height: max(size.height / 2 - node.height / 2, 0))
  }
}
