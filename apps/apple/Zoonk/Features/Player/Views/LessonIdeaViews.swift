import SwiftUI

/// The idea's name shows even when it repeats the screen's title: the strip, the opening map and the
/// end map all name an idea by its `label`.
struct LessonIdeaStrip: View {
  @Environment(\.stacksContent) private var isStacked

  let summary: LessonSummary
  let index: Int

  var body: some View {
    let idea = summary.ideas[index]

    HStack(spacing: 12) {
      if !isStacked {
        LessonIdeaMiniMap(count: summary.ideas.count, current: index)
      }

      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Idea \(index + 1) of \(summary.ideas.count)", tableName: "Player",
          comment:
            "Above a lesson screen: which of the lesson map's ideas (its main points) it teaches. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"Tap an idea to see what it covers\"."
        )
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)

        if let label = idea.label {
          Text(label)
            .font(.headline)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if let icon = idea.icon {
        LessonIconImage(icon: icon, size: 44)
      }
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
  @ScaledMetric(relativeTo: .headline) private var scale: CGFloat = 1.25

  let count: Int
  let current: Int

  private static let gaps = CGSize(width: 14, height: 12)
  private static let margin: CGFloat = 6

  var body: some View {
    let slots = LessonIdeaSlot.slots(count: count)
    let rows = LessonIdeaSlot.rows(of: slots)
    let scale = scale
    let gaps = CGSize(width: Self.gaps.width * scale, height: Self.gaps.height * scale)
    let margin = Self.margin * scale

    Canvas { context, size in
      let center = CGPoint(x: size.width / 2, y: margin + CGFloat(-rows.lowerBound) * gaps.height)
      let points = LessonIdeaSlot.points(of: slots, around: center, gaps: gaps)

      for point in points {
        var spoke = Path()
        spoke.move(to: center)
        spoke.addLine(to: point)
        context.stroke(
          spoke, with: .style(.tertiary), style: StrokeStyle(lineWidth: 1, dash: [2, 2]))
      }

      context.fill(Self.dot(at: center, radius: 2 * scale), with: .style(.secondary))

      for (index, point) in points.enumerated() {
        if index == current {
          context.fill(
            Self.dot(at: point, radius: 6 * scale), with: .color(.success.opacity(0.25)))
          context.fill(Self.dot(at: point, radius: 3.5 * scale), with: .color(.success))
        } else {
          context.fill(Self.dot(at: point, radius: 3 * scale), with: .style(.background))
          context.stroke(
            Self.dot(at: point, radius: 3 * scale), with: .style(.secondary), lineWidth: 1)
        }
      }
    }
    .frame(
      width: gaps.width * 2 + margin * 2,
      height: CGFloat(rows.count - 1) * gaps.height + margin * 2
    )
    .accessibilityHidden(true)
  }

  private static func dot(at point: CGPoint, radius: CGFloat) -> Path {
    Path(
      ellipseIn: CGRect(
        x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2))
  }
}

/// A number opens its idea's name and what it covers, never its answer, which the lesson hasn't
/// taught yet.
struct LessonOpeningMap: View {
  let summary: LessonSummary

  private static let gaps = CGSize(width: 92, height: 80)
  private static let centerSize: CGFloat = 14

  var body: some View {
    let slots = LessonIdeaSlot.slots(count: summary.ideas.count)
    let rows = LessonIdeaSlot.rows(of: slots)
    let node = LessonOpeningIdea.size
    let size = CGSize(
      width: Self.gaps.width * 2 + node, height: CGFloat(rows.count - 1) * Self.gaps.height + node)
    let center = CGPoint(
      x: size.width / 2, y: node / 2 + CGFloat(-rows.lowerBound) * Self.gaps.height)
    let points = LessonIdeaSlot.points(of: slots, around: center, gaps: Self.gaps)

    VStack(spacing: 8) {
      ZStack {
        Self.spokes(from: center, to: points)

        Circle()
          .fill(.secondary)
          .frame(width: Self.centerSize, height: Self.centerSize)
          .position(center)
          .accessibilityHidden(true)

        ForEach(Array(summary.ideas.enumerated()), id: \.offset) { index, idea in
          LessonOpeningIdea(index: index, idea: idea)
            .position(points[index])
        }
      }
      .frame(width: size.width, height: size.height)

      Text(
        "Tap an idea to see what it covers", tableName: "Player",
        comment:
          "Under the lesson map on a lesson's opening screen. Tapping one of its ideas shows its name and what it covers."
      )
      .font(.footnote)
      .foregroundStyle(.secondary)
      .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .contain)
  }

  private static func spokes(from center: CGPoint, to points: [CGPoint]) -> some View {
    Canvas { context, _ in
      for end in points {
        let length = hypot(end.x - center.x, end.y - center.y)
        let from = centerSize / 2 + 4
        let to = length - LessonOpeningIdea.size / 2

        guard to > from else {
          continue
        }

        let along = { (distance: CGFloat) in
          CGPoint(
            x: center.x + (end.x - center.x) * distance / length,
            y: center.y + (end.y - center.y) * distance / length)
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
}

private struct LessonOpeningIdea: View {
  /// The icon, or the ring that stands in for it.
  static let size: CGFloat = 52

  @State private var isShowingIdea = false

  let index: Int
  let idea: LessonSummary.Idea

  var body: some View {
    if let about = idea.about {
      Button {
        isShowingIdea = true
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
      .popover(isPresented: $isShowingIdea, arrowEdge: .top) {
        // A popover takes its content's ideal size, which measures a flexible width unwrapped, and
        // at the largest text sizes a long name with its line can outgrow the room under the map.
        ScrollView {
          VStack(alignment: .leading, spacing: 4) {
            if let label = idea.label {
              Text(label)
                .font(.headline)
                .accessibilityAddTraits(.isHeader)
            }

            Text(about)
              .font(.body)
          }
          .foregroundStyle(.primary)
          .frame(width: 280, alignment: .leading)
          .padding(.horizontal)
          .padding(.vertical, 12)
        }
        .scrollBounceBehavior(.basedOnSize)
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
        "VoiceOver: one of the lesson map's ideas (its main points), by its number. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"Tap an idea to see what it covers\"."
    )
  }

  /// The idea's icon with its number on the corner, or the number alone in a dashed ring.
  @ViewBuilder
  private var mark: some View {
    if let icon = idea.icon {
      LessonIconImage(icon: icon, size: Self.size - 8)
        .frame(width: Self.size, height: Self.size)
        .overlay(alignment: .bottomTrailing) {
          // The map keeps its size at every text size; past this one the number outgrows its ring.
          number
            .dynamicTypeSize(...DynamicTypeSize.xxLarge)
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
