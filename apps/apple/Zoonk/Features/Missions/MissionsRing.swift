import SwiftUI

/// Main's `MissionsRing`: an arc per mission around what it holds, ink as each is done and violet
/// once all are.
struct MissionsRing<Content: View>: View {
  let done: Int
  let total: Int
  var lineWidth = 2.0
  @ViewBuilder let content: Content

  private static var gap: Angle { .degrees(22) }

  private var complete: Bool { total > 0 && done >= total }

  var body: some View {
    content
      .padding(lineWidth * 2)
      .overlay {
        Canvas { context, size in
          guard total > 0 else { return }

          let span = 360.0 / Double(total)
          let radius = (min(size.width, size.height) - lineWidth) / 2
          let center = CGPoint(x: size.width / 2, y: size.height / 2)

          for index in 0..<total {
            let start = -90 + Double(index) * span + Self.gap.degrees / 2
            var arc = Path()
            arc.addArc(
              center: center, radius: radius, startAngle: .degrees(start),
              endAngle: .degrees(start + span - Self.gap.degrees), clockwise: false)

            let color: Color =
              index >= done ? .primary.opacity(0.15) : complete ? .brain : .primary.opacity(0.5)
            context.stroke(
              arc, with: .color(color), style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
          }
        }
        .accessibilityHidden(true)
      }
  }
}
