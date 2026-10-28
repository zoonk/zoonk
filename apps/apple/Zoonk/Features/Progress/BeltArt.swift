import SwiftUI

/// The learner's belt as an object, a close-up of its end (main's `BeltDrawing`): the band in its
/// color with two rows of stitching and the dark rank bar, where each level reached is a stripe of
/// white tape and the next fills with Brain Power's violet, numbered under the bar. Black's bar is
/// red, as on a real black belt. It starts at the panel's edge, as if the rest of the belt ran past
/// it. Decorative: the words above it name the belt and level.
struct BeltDrawing: View {
  @Environment(\.colorScheme) private var colorScheme

  let level: LevelProgress
  let isWide: Bool

  /// The numbers' line, at their largest (the drawing caps their size).
  private let numbersHeight = 16.0

  private var bandHeight: Double { isWide ? 44 : 32 }

  /// The band, the rank bar and the belt's end, as shares of the width.
  private var columns: (band: Double, bar: Double) { isWide ? (0.6, 0.27) : (0.36, 0.52) }

  private var isLight: Bool {
    [.white, .yellow, .orange, .green].contains(level.belt)
  }

  var body: some View {
    Canvas { context, size in
      let bandEnd = size.width * columns.band
      let barEnd = bandEnd + size.width * columns.bar
      let band = CGRect(x: 0, y: 0, width: bandEnd, height: bandHeight)
      let end = CGRect(x: barEnd, y: 0, width: size.width - barEnd, height: bandHeight)
      let endShape = UnevenRoundedRectangle(bottomTrailingRadius: 6, topTrailingRadius: 6).path(
        in: end)
      let beltColor = level.belt == .black ? Color.black : level.belt.color

      context.fill(Path(band), with: .color(beltColor))
      context.fill(endShape, with: .color(beltColor))
      drawEdges(in: context, band: band, end: end, endShape: endShape)

      let stitch = isLight ? Color.black.opacity(0.15) : Color.white.opacity(0.25)
      drawStitching(in: context, from: 0, to: bandEnd - 8, color: stitch)
      drawStitching(in: context, from: barEnd + 8, to: size.width - 10, color: stitch)

      let bar = CGRect(x: bandEnd, y: 0, width: barEnd - bandEnd, height: bandHeight)
      context.fill(
        Path(bar),
        with: .color(
          level.belt == .black ? Color(red: 0.73, green: 0.11, blue: 0.11) : Color(white: 0.04)))
      drawStripes(in: context, bar: bar)
    }
    .frame(height: bandHeight + 4 + numbersHeight)
    // The numbers sit one under each stripe of a fixed-width drawing, so they stop growing where
    // they'd run into each other; the words above say the level at any size.
    .dynamicTypeSize(...DynamicTypeSize.xLarge)
    .accessibilityHidden(true)
  }

  /// White would vanish into a light panel and Black into a dark one without an edge, drawn along
  /// the belt and around its end, never across the panel's edge where the belt runs on.
  private func drawEdges(in context: GraphicsContext, band: CGRect, end: CGRect, endShape: Path) {
    let edge: Color? =
      switch level.belt {
      case .white: colorScheme == .dark ? nil : Color.primary.opacity(0.4)
      case .black: colorScheme == .dark ? Color.white.opacity(0.35) : nil
      default: nil
      }

    guard let edge else {
      return
    }

    var lines = Path()
    lines.move(to: CGPoint(x: band.minX, y: band.minY + 0.5))
    lines.addLine(to: CGPoint(x: band.maxX, y: band.minY + 0.5))
    lines.move(to: CGPoint(x: band.minX, y: band.maxY - 0.5))
    lines.addLine(to: CGPoint(x: band.maxX, y: band.maxY - 0.5))
    context.stroke(lines, with: .color(edge), lineWidth: 1)
    context.stroke(endShape, with: .color(edge), lineWidth: 1)
  }

  private func drawStitching(
    in context: GraphicsContext, from start: Double, to end: Double, color: Color
  ) {
    guard end > start else {
      return
    }

    var path = Path()

    for y in [bandHeight * 0.27, bandHeight * 0.73] {
      path.move(to: CGPoint(x: start, y: y))
      path.addLine(to: CGPoint(x: end, y: y))
    }

    context.stroke(path, with: .color(color), style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
  }

  /// Ten stripes across the bar, then each level's number under its stripe.
  private func drawStripes(in context: GraphicsContext, bar: CGRect) {
    let inset = isWide ? 16.0 : 10.0
    let stripeWidth = isWide ? 6.0 : 4.0
    let spacing = (bar.width - 2 * inset - stripeWidth) / 9
    let share = level.isMaxLevel ? nil : level.share

    for index in 0..<10 {
      let x = bar.minX + inset + Double(index) * spacing
      let slot = CGRect(x: x, y: 2.5, width: stripeWidth, height: bandHeight - 5)
      let shape = Path(roundedRect: slot, cornerRadius: 1)

      if index < level.level {
        context.fill(shape, with: .color(.white))
      } else {
        context.fill(shape, with: .color(.black.opacity(0.5)))
        let isNext = index == level.level && share != nil
        context.stroke(
          Path(roundedRect: slot.insetBy(dx: 0.5, dy: 0.5), cornerRadius: 1),
          with: .color(.white.opacity(isNext ? 0.35 : 0.15)), lineWidth: 1)

        if isNext, let share {
          let height = slot.height * share
          context.fill(
            Path(CGRect(x: slot.minX, y: slot.maxY - height, width: slot.width, height: height)),
            with: .color(.brain))
        }
      }

      let isCurrent = index + 1 == level.level
      let number = context.resolve(
        Text(index + 1, format: .number)
          .font(.caption2.monospacedDigit().weight(isCurrent ? .semibold : .regular))
          .foregroundStyle(isCurrent ? Color(.label) : Color(.tertiaryLabel)))
      context.draw(number, at: CGPoint(x: slot.midX, y: bandHeight + 4), anchor: .top)
    }
  }
}

/// Every belt in its own color, tied once reached and folded while ahead, the learner's framed;
/// each named under it on a wide screen, the first and last under the rack on a phone.
struct BeltRack: View {
  @Environment(\.horizontalSizeClass) private var sizeClass

  let current: ProgressBelt

  var body: some View {
    let currentIndex = ProgressBelt.allCases.firstIndex(of: current) ?? 0

    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .top, spacing: 0) {
        ForEach(Array(ProgressBelt.allCases.enumerated()), id: \.element) { index, belt in
          VStack(spacing: 6) {
            RackBelt(belt: belt, isTied: index <= currentIndex)
              .frame(
                width: sizeClass == .regular ? 52 : 32, height: sizeClass == .regular ? 38 : 26
              )
              .overlay {
                if index == currentIndex {
                  RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(.primary, lineWidth: 1.5)
                }
              }

            if sizeClass == .regular {
              Text(belt.shortTitle)
                .font(.caption2.weight(index == currentIndex ? .medium : .regular))
                .foregroundStyle(
                  index == currentIndex
                    ? AnyShapeStyle(.primary)
                    : index < currentIndex ? AnyShapeStyle(.secondary) : AnyShapeStyle(.tertiary)
                )
                .lineLimit(1)
            }
          }
          .frame(maxWidth: .infinity)
          .accessibilityElement(children: .ignore)
          .accessibilityLabel(Text(belt.localizedTitle))
          .accessibilityAddTraits(index == currentIndex ? .isSelected : [])
        }
      }
      .accessibilityElement(children: .contain)
      .accessibilityLabel(
        Text(
          "Belt progression", tableName: "Progress", comment: "Title of the belts on the Level page"
        ))

      if sizeClass != .regular {
        HStack {
          Text(ProgressBelt.white.localizedTitle)
          Spacer()
          Text(ProgressBelt.black.localizedTitle)
        }
        .font(.caption2)
        .foregroundStyle(.tertiary)
        .accessibilityHidden(true)
      }
    }
  }
}

/// One belt on the rack (main's SVG, 44 by 30): knot and tails once tied, folded while ahead. White
/// and Black get an outline behind them so they keep their shape on a light or dark page.
private struct RackBelt: View {
  @Environment(\.colorScheme) private var colorScheme

  let belt: ProgressBelt
  let isTied: Bool

  var body: some View {
    Canvas { context, size in
      let scale = min(size.width * 0.8 / 44, size.height * 0.8 / 30)
      let origin = CGPoint(x: (size.width - 44 * scale) / 2, y: (size.height - 30 * scale) / 2)
      let transform = CGAffineTransform(translationX: origin.x, y: origin.y).scaledBy(
        x: scale, y: scale)
      let shape = (isTied ? Self.tied : Self.folded).applying(transform)

      if let outline {
        context.stroke(
          shape, with: .color(outline), style: StrokeStyle(lineWidth: 3 * scale, lineJoin: .round))
      }

      context.fill(shape, with: .color(belt.color))
    }
  }

  private var outline: Color? {
    switch belt {
    case .white: colorScheme == .dark ? nil : Color.primary.opacity(0.5)
    case .black: colorScheme == .dark ? Color.white.opacity(0.5) : nil
    default: nil
    }
  }

  private static let tied: Path = {
    var path = Path()
    path.addLines([
      CGPoint(x: 18.6, y: 12.5), CGPoint(x: 22.4, y: 12.5), CGPoint(x: 16.6, y: 27.6),
      CGPoint(x: 12.2, y: 27.6),
    ])
    path.closeSubpath()
    path.addLines([
      CGPoint(x: 21.6, y: 12.5), CGPoint(x: 25.4, y: 12.5), CGPoint(x: 31.8, y: 27.6),
      CGPoint(x: 27.4, y: 27.6),
    ])
    path.closeSubpath()
    path.addRoundedRect(
      in: CGRect(x: 1.5, y: 6, width: 41, height: 8), cornerSize: CGSize(width: 2, height: 2))
    path.addRoundedRect(
      in: CGRect(x: 17, y: 3.5, width: 10, height: 13), cornerSize: CGSize(width: 3, height: 3))
    return path
  }()

  private static let folded: Path = {
    var path = Path()
    path.addRoundedRect(
      in: CGRect(x: 5, y: 7.5, width: 34, height: 7), cornerSize: CGSize(width: 2, height: 2))
    path.addRoundedRect(
      in: CGRect(x: 5, y: 15.5, width: 34, height: 7), cornerSize: CGSize(width: 2, height: 2))
    path.addRoundedRect(
      in: CGRect(x: 31, y: 7.5, width: 8, height: 15), cornerSize: CGSize(width: 2, height: 2))
    return path
  }()
}
