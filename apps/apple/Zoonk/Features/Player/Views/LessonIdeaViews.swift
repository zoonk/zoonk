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
            "Above a lesson screen: which of the lesson map's ideas (its main points) it teaches. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"%lld ideas to discover in this lesson\"."
        )
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)

        if let label = idea.label {
          Text(label)
            .typeStyle(.reading.weight(.semibold))
            .foregroundStyle(Color(.foreground))
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)

      if let icon = idea.icon {
        LessonIconImage(icon: icon, size: 44)
      }
    }
    .padding(.bottom, 12)
    .overlay(alignment: .bottom) {
      Rectangle()
        .fill(.border)
        .frame(height: 1)
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
        context.stroke(spoke, with: .color(.faint.opacity(0.6)), lineWidth: scale)
      }

      context.fill(Self.dot(at: center, radius: 2 * scale), with: .color(.faint))

      for (index, point) in points.enumerated() {
        if index == current {
          context.fill(
            Self.dot(at: point, radius: 6 * scale), with: .color(.success.opacity(0.25)))
          context.fill(Self.dot(at: point, radius: 3.5 * scale), with: .color(.success))
        } else {
          context.fill(Self.dot(at: point, radius: 3 * scale), with: .color(.faint))
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
  @Environment(\.colorSchemeContrast) private var contrast

  let summary: LessonSummary

  private static let gaps = CGSize(width: 92, height: 80)
  private static let centerSize: CGFloat = 10

  var body: some View {
    let slots = LessonIdeaSlot.slots(count: summary.ideas.count)
    let rows = LessonIdeaSlot.rows(of: slots)
    let node = LessonOpeningIdea.size
    let size = CGSize(
      width: Self.gaps.width * 2 + node, height: CGFloat(rows.count - 1) * Self.gaps.height + node)
    let center = CGPoint(
      x: size.width / 2, y: node / 2 + CGFloat(-rows.lowerBound) * Self.gaps.height)
    let points = LessonIdeaSlot.points(of: slots, around: center, gaps: Self.gaps)

    VStack(spacing: 16) {
      ZStack {
        spokes(from: center, to: points)

        Circle()
          .fill(Color(.foreground).opacity(0.3))
          .frame(width: Self.centerSize, height: Self.centerSize)
          .position(center)
          .accessibilityHidden(true)

        ForEach(Array(summary.ideas.enumerated()), id: \.offset) { index, idea in
          LessonOpeningIdea(index: index, count: summary.ideas.count, idea: idea)
            .position(points[index])
        }
      }
      .frame(width: size.width, height: size.height)

      Text(
        "\(summary.ideas.count) ideas to discover in this lesson", tableName: "Player",
        comment:
          "Under the lesson map on a lesson's opening screen; its numbers open each idea. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"%lld ideas to discover in this lesson\"."
      )
      .typeStyle(.body)
      .foregroundStyle(.mutedForeground)
      .multilineTextAlignment(.center)
    }
    .padding(.top, 8)
    .frame(maxWidth: .infinity)
    .accessibilityElement(children: .contain)
  }

  /// Main's spokes run from the center to each idea, under its ring.
  private func spokes(from center: CGPoint, to points: [CGPoint]) -> some View {
    let ink = Color(.foreground).opacity(contrast == .increased ? 1 : 0.25)

    return Canvas { context, _ in
      for end in points {
        var spoke = Path()
        spoke.move(to: center)
        spoke.addLine(to: end)
        context.stroke(spoke, with: .color(ink), style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
      }
    }
    .accessibilityHidden(true)
  }
}

/// Main's `OpeningMapIdea`: the idea's icon in a dashed ring, in ink while its popover is open,
/// with its number on the top corner; without an icon, the number in the ring.
private struct LessonOpeningIdea: View {
  static let size: CGFloat = 64

  @Environment(\.colorSchemeContrast) private var contrast
  @State private var isShowingIdea = false

  let index: Int
  let count: Int
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
            (idea.label.map { Text($0) } ?? name)
              .typeStyle(.rowTitle)
              .foregroundStyle(Color(.foreground))
              .accessibilityAddTraits(.isHeader)

            Text(about)
              .typeStyle(.body)
              .foregroundStyle(.mutedForeground)
          }
          .frame(width: 256, alignment: .leading)
          .padding(.horizontal)
          .padding(.vertical, 12)
        }
        .scrollBounceBehavior(.basedOnSize)
        .presentationCompactAdaptation(.popover)
        .zoonkStyles()
      }
    } else {
      mark
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(name)
    }
  }

  /// Main's "Idea 2 of 5".
  private var name: Text {
    Text(
      "Idea \(index + 1) of \(count)", tableName: "Player",
      comment:
        "Above a lesson screen: which of the lesson map's ideas (its main points) it teaches. Use one word for \"idea\" in all of these: \"Idea %lld of %lld\", \"Idea %lld\" and \"%lld ideas to discover in this lesson\"."
    )
  }

  private var mark: some View {
    ZStack {
      Circle()
        .fill(Color(.systemBackground))
        .strokeBorder(ring, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))

      if let icon = idea.icon {
        LessonIconImage(icon: icon, size: 44)
      } else {
        Text(index + 1, format: .number)
          .typeStyle(.data.weight(.regular))
          .dynamicTypeSize(...DynamicTypeSize.xxLarge)
          .foregroundStyle(.mutedForeground)
      }
    }
    .frame(width: Self.size, height: Self.size)
    .overlay(alignment: .topLeading) {
      if idea.icon != nil {
        // The map keeps its size at every text size; past this one the number outgrows its badge.
        Text(index + 1, format: .number)
          .typeStyle(.data)
          .dynamicTypeSize(...DynamicTypeSize.xxLarge)
          .foregroundStyle(.mutedForeground)
          .frame(minWidth: 24, minHeight: 24)
          .background(.muted, in: .circle)
          .offset(x: -4, y: -4)
      }
    }
    .contentShape(.circle)
  }

  private var ring: Color {
    isShowingIdea || contrast == .increased ? Color(.foreground) : Color(.foreground).opacity(0.3)
  }
}
