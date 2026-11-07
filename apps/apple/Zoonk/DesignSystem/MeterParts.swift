import SwiftUI

/// A single share is a `Meter` instead. 4pt tall with 3pt gaps is main's wait bar.
struct MeterParts: View {
  struct Part {
    enum Fill {
      case track
      case current
      case color(Color)
      /// The track, filled in `success` from its start this far (0 to 1).
      case share(Double)
    }

    var weight = 1.0
    var fill: Fill
  }

  let parts: [Part]
  var height = 6.0
  var gap = 2.0

  private let minimumWidth = 4.0
  private let ringWidth = 1.5

  var body: some View {
    Canvas { context, size in
      let totalWeight = parts.reduce(0) { $0 + max($1.weight, 0) }
      let fixedWidth = Double(parts.count) * minimumWidth + Double(max(parts.count - 1, 0)) * gap
      let sharedWidth = max(size.width - fixedWidth, 0)
      let radius = min(3, height / 2)
      var x = 0.0

      for part in parts {
        let share = totalWeight > 0 ? max(part.weight, 0) / totalWeight : 0
        let rect = CGRect(
          x: x, y: 0, width: minimumWidth + sharedWidth * share, height: size.height)

        switch part.fill {
        case .track:
          context.fill(
            Path(roundedRect: rect, cornerRadius: radius), with: .color(.surface3))
        case .current:
          let inset = rect.insetBy(dx: ringWidth / 2, dy: ringWidth / 2)
          context.stroke(
            Path(roundedRect: inset, cornerRadius: radius), with: .color(.success),
            lineWidth: ringWidth)
        case .color(let color):
          context.fill(Path(roundedRect: rect, cornerRadius: radius), with: .color(color))
        case .share(let filled):
          let track = Path(roundedRect: rect, cornerRadius: radius)
          var part = context
          part.fill(track, with: .color(.surface3))
          part.clip(to: track)
          part.fill(
            Path(
              CGRect(
                origin: rect.origin,
                size: CGSize(width: rect.width * min(max(filled, 0), 1), height: rect.height))),
            with: .color(.success))
        }

        x = rect.maxX + gap
      }
    }
    .frame(height: height)
    .accessibilityHidden(true)
  }
}
