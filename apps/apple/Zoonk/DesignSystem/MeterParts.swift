import SwiftUI

/// A single share is a `ProgressView` instead.
struct MeterParts: View {
  struct Part {
    enum Fill {
      case track
      case current
      case color(Color)
    }

    var weight = 1.0
    var fill: Fill
  }

  let parts: [Part]

  private let gap = 2.0
  private let minimumWidth = 4.0
  private let ringWidth = 1.5

  var body: some View {
    Canvas { context, size in
      let totalWeight = parts.reduce(0) { $0 + max($1.weight, 0) }
      let fixedWidth = Double(parts.count) * minimumWidth + Double(max(parts.count - 1, 0)) * gap
      let sharedWidth = max(size.width - fixedWidth, 0)
      let radius = size.height / 2
      var x = 0.0

      for part in parts {
        let share = totalWeight > 0 ? max(part.weight, 0) / totalWeight : 0
        let rect = CGRect(
          x: x, y: 0, width: minimumWidth + sharedWidth * share, height: size.height)

        switch part.fill {
        case .track:
          context.fill(
            Path(roundedRect: rect, cornerRadius: radius), with: .color(Color(.systemFill)))
        case .current:
          let inset = rect.insetBy(dx: ringWidth / 2, dy: ringWidth / 2)
          context.stroke(
            Path(roundedRect: inset, cornerRadius: radius), with: .color(.success),
            lineWidth: ringWidth)
        case .color(let color):
          context.fill(Path(roundedRect: rect, cornerRadius: radius), with: .color(color))
        }

        x = rect.maxX + gap
      }
    }
    .frame(height: 6)
    .accessibilityHidden(true)
  }
}
