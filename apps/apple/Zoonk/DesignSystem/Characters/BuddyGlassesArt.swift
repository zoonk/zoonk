import SwiftUI

private let mirror = CGAffineTransform(a: -1, b: 0, c: 0, d: 1, tx: 120, ty: 0)

private let gold = Gradient(art: (0xffe7a3, 0, 1), (0xf2b53c, 0.5, 1), (0xb87412, 1, 1))

struct BuddyGlassesArt {
  let glasses: BuddyGlasses

  func draw(_ painter: ArtPainter) {
    switch glasses {
    case .round: round(painter)
    case .star: star(painter)
    case .aviator: aviator(painter)
    case .catEye: catEye(painter)
    case .retro: retro(painter)
    case .monocle: monocle(painter)
    }
  }

  private func highlight(_ painter: ArtPainter, _ paths: [String], width: CGFloat, opacity: Double)
  {
    for path in paths {
      painter.stroke(svg(path), .color(.white), width: width, opacity: opacity, cap: .round)
    }
  }

  private func round(_ painter: ArtPainter) {
    let frame = ArtPaint.color(Color(art: 0x221b52))

    for path in ["M31 55 L19 51", "M89 55 L101 51"] {
      painter.stroke(svg(path), frame, width: 3.4, cap: .round)
    }
    for lens in [ArtShape.circle(44, 58, 14), ArtShape.circle(76, 58, 14)] {
      painter.fill(lens, .color(.white), opacity: 0.14)
      painter.stroke(lens, frame, width: 3.8)
    }
    painter.stroke(svg("M58 56.5 Q60 53 62 56.5"), frame, width: 3.4, cap: .round)
    highlight(painter, ["M35 51 Q38 47 43 46", "M67 51 Q70 47 75 46"], width: 2.2, opacity: 0.75)
  }

  private static let starLeft =
    "M41.01 39.60 L48.50 48.97 L60.36 50.77 L53.76 60.79 L55.71 72.62 L44.15 69.44 L33.50 74.95 L32.95 62.97 L24.42 54.55 L35.64 50.33 Z"
  private static let starRight =
    "M78.99 39.60 L84.36 50.33 L95.58 54.55 L87.05 62.97 L86.50 74.95 L75.85 69.44 L64.29 72.62 L66.24 60.79 L59.64 50.77 L71.50 48.97 Z"

  private func star(_ painter: ArtPainter) {
    let rim = ArtPaint.color(Color(art: 0xb86b00))

    for path in ["M24.4 54.5 L18 51.5", "M95.6 54.5 L102 51.5"] {
      painter.stroke(svg(path), rim, width: 3.4, cap: .round)
    }
    for lens in [svg(Self.starLeft), svg(Self.starRight)] {
      painter.fill(lens, .color(Color(art: 0xffd36e)), opacity: 0.16)
      painter.stroke(lens, rim, width: 5.4, join: .round)
    }
    for lens in [svg(Self.starLeft), svg(Self.starRight)] {
      painter.stroke(lens, .color(Color(art: 0xffcf4a)), width: 3, join: .round)
    }
    for path in ["M36 50.5 L40.6 43.5", "M72 50.5 L76.6 43.5"] {
      painter.stroke(svg(path), .color(Color(art: 0xfff6d6)), width: 1.6, cap: .round)
    }
    painter.fill(Spark.path(x: 92, y: 36, size: 8), .color(.white))
  }

  private static let aviatorLens =
    "M29 50 C29 47.5, 31 46.5, 34 46.5 L55 46.5 C58.5 46.5, 59.5 49.5, 58.5 53 C56.5 62, 52 71, 42 71.5 C33 72, 28.5 64, 29 50 Z"

  private func aviator(_ painter: ArtPainter) {
    let mirrorTint = Gradient(art: (0x1b1f5e, 0, 0.82), (0x3a5bb8, 0.55, 0.55), (0x7cf5ff, 1, 0.4))

    for path in ["M29.5 49.5 L19 48.5", "M90.5 49.5 L101 48.5"] {
      painter.stroke(svg(path), .color(Color(art: 0xc98b1c)), width: 2.4, cap: .round)
    }
    for lens in [svg(Self.aviatorLens), svg(Self.aviatorLens).applying(mirror)] {
      painter.fill(lens, .linear(mirrorTint, start: .top, end: .bottom))
      painter.stroke(lens, .linear(gold, start: .top, end: .bottom), width: 2.6, join: .round)
    }
    painter.stroke(svg("M55 46.5 L65 46.5"), .color(Color(art: 0xe0a534)), width: 2.6)
    painter.stroke(
      svg("M57.5 52.5 Q60 50.3 62.5 52.5"), .color(Color(art: 0xe0a534)), width: 2.2, cap: .round)
    highlight(painter, ["M33 60 L45 49", "M65 60 L77 49"], width: 2.6, opacity: 0.55)
    highlight(painter, ["M36 65 L41 60.5", "M68 65 L73 60.5"], width: 1.8, opacity: 0.4)
  }

  private static let catEyeLens =
    "M57 52 C50 46, 38 45, 26.5 43.5 C28 50, 29 56, 31.5 62 C34.5 70, 46 73, 53.5 68.5 C58.5 65, 59.5 57, 57 52 Z"

  private func catEye(_ painter: ArtPainter) {
    let rim = ArtPaint.color(Color(art: 0xff4f9a))

    for path in ["M29.5 50 L19 49", "M90.5 50 L101 49"] {
      painter.stroke(svg(path), .color(Color(art: 0xc42a6e)), width: 3.2, cap: .round)
    }
    for lens in [svg(Self.catEyeLens), svg(Self.catEyeLens).applying(mirror)] {
      painter.fill(lens, .color(.white), opacity: 0.14)
      painter.stroke(lens, rim, width: 3.8, join: .round)
    }
    painter.stroke(svg("M56.5 53.5 Q60 50 63.5 53.5"), rim, width: 3.4, cap: .round)
    highlight(
      painter, ["M33 50 Q37 47.5 42 47.5", "M78 47.5 Q83 47.5 87 50"], width: 2, opacity: 0.7)
    painter.fill(ArtShape.circle(28.5, 45.5, 1.9), .color(.white))
    painter.fill(ArtShape.circle(91.5, 45.5, 1.9), .color(.white))
    painter.fill(ArtShape.circle(32.8, 46.6, 1.1), .color(Color(art: 0xffe0f0)))
    painter.fill(ArtShape.circle(87.2, 46.6, 1.1), .color(Color(art: 0xffe0f0)))
  }

  private func retro(_ painter: ArtPainter) {
    let tortoise = Gradient(
      art: (0x6b3514, 0, 1), (0xb8692c, 0.3, 1), (0x4a220c, 0.55, 1), (0xa45a22, 0.8, 1),
      (0x3d1b08, 1, 1))

    for path in ["M29.5 50 L18.5 48.5", "M90.5 50 L101.5 48.5"] {
      painter.stroke(svg(path), .color(Color(art: 0x5a2a10)), width: 4, cap: .round)
    }
    for lens in [
      ArtShape.rect(29.5, 45.5, 29, 25, radius: 7), ArtShape.rect(61.5, 45.5, 29, 25, radius: 7),
    ] {
      painter.fill(lens, .color(.white), opacity: 0.12)
      painter.stroke(lens, .linear(tortoise, start: .topLeading, end: .bottomTrailing), width: 5)
    }
    painter.stroke(
      svg("M57.5 53 Q60 49.5 62.5 53"), .color(Color(art: 0x6b3514)), width: 4, cap: .round)
    highlight(painter, ["M34 50.5 L41 50.5", "M66 50.5 L73 50.5"], width: 1.8, opacity: 0.7)
    painter.fill(ArtShape.circle(31, 47.5, 1.2), .color(Color(art: 0xf3d9a4)))
    painter.fill(ArtShape.circle(89, 47.5, 1.2), .color(Color(art: 0xf3d9a4)))
  }

  private func monocle(_ painter: ArtPainter) {
    painter.stroke(
      svg("M86.5 69 C 94 80, 88 92, 74 97.5"), .color(Color(art: 0xe0a534)), width: 1.8,
      cap: .round, dash: [2.6, 1.8])
    let lens = ArtShape.circle(76, 58, 14.5)
    painter.fill(lens, .color(.white), opacity: 0.16)
    painter.stroke(lens, .linear(gold, start: .top, end: .bottom), width: 3.6)
    painter.stroke(
      ArtShape.circle(76, 58, 12), .color(Color(art: 0x9c6b12)), width: 0.9, opacity: 0.7)
    highlight(painter, ["M67 51 Q70 46.5 75 45.5"], width: 2.2, opacity: 0.75)
    painter.fill(ArtShape.circle(87, 68, 1.8), .color(Color(art: 0xf2b53c)))
  }
}

enum Spark {
  private static let box = 24.0

  /// The spark `size` wide with its top-left corner at `x`, `y`.
  static func path(x: Double, y: Double, size: Double) -> Path {
    svg("M12 0 C13 8 16 11 24 12 C16 13 13 16 12 24 C11 16 8 13 0 12 C8 11 11 8 12 0Z")
      .applying(
        CGAffineTransform(translationX: x, y: y).scaledBy(x: size / box, y: size / box))
  }
}
