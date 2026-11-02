import SwiftUI

/// `face` crops to the face's square, so a baby's face isn't a dot at icon sizes.
struct BuddyArt: CharacterArt {
  enum Crop { case whole, face }

  let look: BuddyLook
  var crop = Crop.whole

  /// Growth scales around the feet so a buddy always stands on the same ground line.
  private static let ground = CGPoint(x: 60, y: 116)

  var viewBox: CGRect {
    guard crop == .face else { return CGRect(x: 0, y: 0, width: 120, height: 120) }

    let size = 96 * look.stage.scale
    let centerY = Self.ground.y - (Self.ground.y - 60) * look.stage.scale
    return CGRect(x: Self.ground.x - size / 2, y: centerY - size / 2, width: size, height: size)
  }

  var overflow: CGFloat { crop == .face ? 0 : 0.25 }

  static func act(_ name: BuddyAct) -> CharacterAct<BuddyExpression> { name.act }
  static func poses(of expression: BuddyExpression) -> [CharacterPart: PartPose] {
    [.lidLeft: .hidden, .lidRight: .hidden]
  }
  static var blink: BuddyAct { .blink }
  static var openEyes: Set<BuddyExpression> { [.happy, .kind, .neutral, .think, .wow] }

  func draw(_ painter: ArtPainter, face: BuddyExpression) {
    var painter = painter

    if crop == .face {
      painter.context.clip(to: Path(viewBox))
    }

    let scale = look.stage.scale
    let grow = CGAffineTransform(translationX: Self.ground.x, y: Self.ground.y)
      .scaledBy(x: scale, y: scale)
      .translatedBy(x: -Self.ground.x, y: -Self.ground.y)

    painter.group(grow) { body in
      let parts = BuddyBodyArt(look: look, isNapping: face == .sleepy) { head in
        head.part(.face, pivot: CGPoint(x: 60, y: 64)) { facePainter in
          BuddyFaceArt(expression: face).draw(facePainter)
          facePainter.group(
            CGAffineTransform(
              translationX: 0, y: face == .sleepy ? BuddyExpression.sleepyEyesOffset : 0)
          ) {
            BuddyGlassesArt(glasses: look.glasses).draw($0)
          }
        }
      }
      parts.draw(body)
    }
  }
}

/// The belt's outline, so a white or black belt never vanishes into the body.
private let beltEdge = ArtPaint.color(.black)

private struct BuddyBodyArt {
  let look: BuddyLook
  let isNapping: Bool
  let face: (ArtPainter) -> Void

  private var belt: ArtPaint { .color(look.belt.color) }

  func draw(_ painter: ArtPainter) {
    switch look.kind {
    case .zu: zu(painter)
    case .noodle: noodle(painter)
    case .beep: beep(painter)
    case .otto: otto(painter)
    }
  }

  private func beltPiece(_ painter: ArtPainter, _ path: Path, edge: Double, width: CGFloat = 1) {
    painter.fill(path, belt)
    painter.stroke(path, beltEdge, width: width, opacity: edge)
  }

  /// The glow holds still: the buddy shows on everyday screens, where nothing loops.
  private func halo(_ painter: ArtPainter, _ x: Double, _ y: Double, radius: Double) {
    let glow = look.glow
    guard glow > 0 else { return }

    let gradient = Gradient(art: (0xffb35c, 0, 0.95), (0xff8a3d, 1, 0))
    painter.fill(
      ArtShape.circle(x, y, radius * (1 + 1.5 * glow)),
      .radial(gradient, center: CGPoint(x: 0.5, y: 0.5), radius: 0.5), opacity: glow)
  }

  private func light(_ painter: ArtPainter, _ x: Double, _ y: Double, haloRadius: Double) {
    halo(painter, x, y, radius: haloRadius)
    painter.fill(ArtShape.circle(x, y, 5.2), .color(Color(art: 0xff8a3d)))
    painter.fill(ArtShape.circle(x - 1.6, y - 1.6, 1.7), .color(.white), opacity: 0.85)
  }

  private func zu(_ painter: ArtPainter) {
    let skin = ArtPaint.radial(
      Gradient(art: (0xc9fff0, 0, 1), (0x86ecd0, 0.55, 1), (0x4fcdac, 1, 1)),
      center: CGPoint(x: 0.35, y: 0.28), radius: 0.8)
    let limb = ArtPaint.color(Color(art: 0x3fb897))

    painter.part(.shadow, pivot: CGPoint(x: 60, y: 115)) {
      $0.fill(ArtShape.ellipse(60, 115, 24, 3.8), .color(.black), opacity: 0.12)
    }
    painter.part(.feet, pivot: CGPoint(x: 60, y: 111)) {
      $0.fill(ArtShape.ellipse(51, 111, 7.5, 4.6), limb)
      $0.fill(ArtShape.ellipse(69, 111, 7.5, 4.6), limb)
    }
    painter.part(.body, pivot: CGPoint(x: 60, y: 112)) { body in
      let arm = ArtPaint.color(Color(art: 0x6fdfbf))

      body.part(.armLeft, pivot: CGPoint(x: 42.5, y: 89.5)) {
        $0.fill(ArtShape.ellipse(39, 96, 5.5, 8).rotated(28, around: 39, 96), arm)
      }
      body.part(.armRight, pivot: CGPoint(x: 77.5, y: 89.5)) {
        $0.fill(ArtShape.ellipse(81, 96, 5.5, 8).rotated(-28, around: 81, 96), arm)
      }
      body.part(.torso, pivot: CGPoint(x: 60, y: 97)) { torso in
        let shape = ArtShape.ellipse(60, 97, 21, 15.5)
        torso.fill(shape, skin)
        torso.clipped(to: shape) {
          beltPiece($0, ArtShape.rect(30, 96, 60, 7.5), edge: 0.14, width: 1.2)
        }
        beltPiece(torso, svg("M58.5 101 l-6 9 l3.6 1.2 l5 -8 z"), edge: 0.16)
        beltPiece(torso, svg("M61.5 101 l6 9 l-3.6 1.2 l-5 -8 z"), edge: 0.16)
        beltPiece(torso, ArtShape.rect(55, 94.5, 10, 10, radius: 3), edge: 0.2)
      }
      body.part(.head, pivot: CGPoint(x: 60, y: 86)) { head in
        zuAntenna(head, left: true)
        zuAntenna(head, left: false)
        head.fill(ArtShape.ellipse(60, 56, 42, 33), skin)
        head.fill(
          ArtShape.ellipse(44, 33, 13, 6).rotated(-14, around: 44, 33), .color(.white), opacity: 0.4
        )
        head.fill(ArtShape.circle(84, 38, 3.2), .color(.white), opacity: 0.28)
        head.fill(ArtShape.circle(91, 46, 2), .color(.white), opacity: 0.28)
        head.fill(ArtShape.circle(30, 42, 2.4), .color(.white), opacity: 0.22)
        face(head)
      }
    }
  }

  private func zuAntenna(_ painter: ArtPainter, left: Bool) {
    let stalk = ArtPaint.color(Color(art: 0x3fb897))

    painter.part(left ? .antennaLeft : .antennaRight, pivot: CGPoint(x: left ? 48 : 72, y: 31)) {
      if isNapping {
        $0.stroke(
          svg(left ? "M48 31 Q40 25 31 27" : "M72 31 Q80 25 89 27"), stalk, width: 3.6, cap: .round)
        $0.fill(ArtShape.circle(left ? 30 : 90, 27.5, 4.6), .color(Color(art: 0xc9a37e)))
      } else {
        $0.stroke(
          svg(left ? "M48 31 Q45 19 37 12" : "M72 31 Q75 19 83 12"), stalk, width: 3.6, cap: .round)
        light($0, left ? 36 : 84, 11, haloRadius: 11)
      }
    }
  }

  private func noodle(_ painter: ArtPainter) {
    let shade = ArtPaint.radial(
      Gradient(art: (0xffb3cb, 0, 1), (0xff7aa6, 1, 1)), center: CGPoint(x: 0.4, y: 0.3),
      radius: 0.75)
    var outline = Path()
    outline.addPath(ArtShape.circle(40, 46, 22))
    outline.addPath(ArtShape.circle(60, 37, 25))
    outline.addPath(ArtShape.circle(80, 46, 22))
    outline.addPath(ArtShape.ellipse(60, 70, 44, 37))

    painter.part(.shadow, pivot: CGPoint(x: 60, y: 113)) {
      $0.fill(ArtShape.ellipse(60, 113, 30, 4.5), .color(.black), opacity: 0.08)
    }
    painter.part(.feet, pivot: CGPoint(x: 60, y: 106)) {
      $0.fill(ArtShape.ellipse(47, 106, 9, 6), .color(Color(art: 0xe8628f)))
      $0.fill(ArtShape.ellipse(73, 106, 9, 6), .color(Color(art: 0xe8628f)))
    }
    painter.part(.body, pivot: CGPoint(x: 60, y: 108)) { body in
      let arm = ArtPaint.color(Color(art: 0xff8fb3))

      body.part(.armLeft, pivot: CGPoint(x: 22, y: 70)) {
        $0.fill(ArtShape.ellipse(17, 74, 7, 9).rotated(25, around: 17, 74), arm)
      }
      body.part(.armRight, pivot: CGPoint(x: 98, y: 70)) {
        $0.fill(ArtShape.ellipse(103, 74, 7, 9).rotated(-25, around: 103, 74), arm)
      }
      body.part(.head, pivot: CGPoint(x: 60, y: 104)) { head in
        head.clipped(to: outline) { brain in
          brain.fill(ArtShape.rect(0, 0, 120, 120), shade)
          beltPiece(brain, ArtShape.rect(0, 86, 120, 11), edge: 0.12, width: 1.5)
        }
        for fold in [
          "M47 27 q6 -7 13 -1", "M65 22 q7 -5 13 2", "M28 46 q5 -6 11 -2", "M82 44 q6 -4 11 2",
          "M58 40 q3 -4 7 -2",
        ] {
          head.stroke(svg(fold), .color(Color(art: 0xe0598a)), width: 3, opacity: 0.8, cap: .round)
        }
        head.fill(
          ArtShape.ellipse(44, 30, 9, 5).rotated(-20, around: 44, 30), .color(.white), opacity: 0.35
        )
        beltPiece(head, svg("M58 91 l-9 14 l5 2 l8 -12 z"), edge: 0.15, width: 1.2)
        beltPiece(head, svg("M62 91 l9 14 l-5 2 l-8 -12 z"), edge: 0.15, width: 1.2)
        beltPiece(head, ArtShape.rect(53, 84, 14, 14, radius: 4), edge: 0.18, width: 1.2)
        face(head)
      }
    }
  }

  private func beep(_ painter: ArtPainter) {
    let metal = ArtPaint.linear(
      Gradient(art: (0xf4f5ff, 0, 1), (0xcdd2f2, 0.6, 1), (0xa1aadb, 1, 1)), start: .top,
      end: .bottom)
    let steel = ArtPaint.color(Color(art: 0x7c86c4))

    painter.part(.shadow, pivot: CGPoint(x: 60, y: 115.5)) {
      $0.fill(ArtShape.ellipse(60, 115.5, 24, 3.6), .color(.black), opacity: 0.12)
    }
    painter.part(.feet, pivot: CGPoint(x: 60, y: 110)) {
      $0.fill(ArtShape.rect(45, 106, 12, 9, radius: 4.5), steel)
      $0.fill(ArtShape.rect(63, 106, 12, 9, radius: 4.5), steel)
    }
    painter.part(.body, pivot: CGPoint(x: 60, y: 112)) { body in
      let arm = ArtPaint.color(Color(art: 0xb3bbe6))

      body.part(.armLeft, pivot: CGPoint(x: 36, y: 94)) {
        $0.fill(ArtShape.rect(28, 93, 10, 17, radius: 5).rotated(24, around: 33, 101), arm)
      }
      body.part(.armRight, pivot: CGPoint(x: 84, y: 94)) {
        $0.fill(ArtShape.rect(82, 93, 10, 17, radius: 5).rotated(-24, around: 87, 101), arm)
      }
      body.part(.torso, pivot: CGPoint(x: 60, y: 101)) { torso in
        let shape = ArtShape.rect(38, 90, 44, 22, radius: 10)
        torso.fill(shape, metal)
        torso.clipped(to: shape) {
          beltPiece($0, ArtShape.rect(30, 98, 60, 7), edge: 0.14, width: 1.2)
        }
        beltPiece(torso, svg("M58.5 102.5 l-6 8.5 l3.6 1.2 l5 -7.5 z"), edge: 0.16)
        beltPiece(torso, svg("M61.5 102.5 l6 8.5 l-3.6 1.2 l-5 -7.5 z"), edge: 0.16)
        beltPiece(torso, ArtShape.rect(55, 96.5, 10, 10, radius: 3), edge: 0.2)
      }
      body.part(.head, pivot: CGPoint(x: 60, y: 92)) { head in
        head.part(.antenna, pivot: CGPoint(x: 60, y: 26)) {
          if isNapping {
            $0.stroke(svg("M60 26 Q60 18 68 17"), steel, width: 3.6, cap: .round)
            $0.fill(ArtShape.circle(71.5, 17, 4.6), .color(Color(art: 0xc9a37e)))
          } else {
            $0.stroke(svg("M60 26 V15"), steel, width: 3.6, cap: .round)
            light($0, 60, 10, haloRadius: 10)
          }
        }
        let shell = ArtShape.rect(16, 24, 88, 70, radius: 24)
        head.fill(shell, metal)
        head.stroke(shell, steel, width: 1.4, opacity: 0.35)
        head.fill(ArtShape.circle(15, 60, 5.5), .color(Color(art: 0x8f98d1)))
        head.fill(ArtShape.circle(105, 60, 5.5), .color(Color(art: 0x8f98d1)))
        let screen = ArtShape.rect(24, 34, 72, 54, radius: 18)
        head.fill(screen, .color(Color(art: 0xfbfcff)))
        head.stroke(screen, .color(Color(art: 0x9aa3d6)), width: 1.5, opacity: 0.55)
        head.fill(ArtShape.rect(30, 27.5, 26, 3.6, radius: 1.8), .color(.white), opacity: 0.8)
        face(head)
      }
    }
  }

  private func otto(_ painter: ArtPainter) {
    let skin = ArtPaint.radial(
      Gradient(art: (0xf1e9ff, 0, 1), (0xc6adff, 0.5, 1), (0x8c69f0, 1, 1)),
      center: CGPoint(x: 0.35, y: 0.26), radius: 0.82)
    let tentacle = ArtPaint.color(Color(art: 0xa88af7))
    let tip = ArtPaint.color(Color(art: 0xefe6ff))

    painter.part(.shadow, pivot: CGPoint(x: 60, y: 116)) {
      $0.fill(ArtShape.ellipse(60, 116, 30, 3.4), .color(.black), opacity: 0.12)
    }
    painter.part(.body, pivot: CGPoint(x: 60, y: 112)) { body in
      // The outer tentacles are Otto's arms; the three between them stand.
      body.part(.armLeft, pivot: CGPoint(x: 36, y: 84)) {
        $0.stroke(
          svg("M36 84 C 28 95, 18 99, 16 107 C 15 113, 23 114, 25 109"), tentacle, width: 9,
          cap: .round)
        $0.fill(ArtShape.circle(19, 104, 1.8), tip, opacity: 0.9)
      }
      body.part(.armRight, pivot: CGPoint(x: 84, y: 84)) {
        $0.stroke(
          svg("M84 84 C 92 95, 102 99, 104 107 C 105 113, 97 114, 95 109"), tentacle, width: 9,
          cap: .round)
        $0.fill(ArtShape.circle(101, 104, 1.8), tip, opacity: 0.9)
      }
      body.part(.feet, pivot: CGPoint(x: 60, y: 112)) { feet in
        for leg in [
          "M48 88 C 44 99, 39 105, 42 112", "M72 88 C 76 99, 81 105, 78 112",
          "M60 90 C 60 100, 57 106, 61 112",
        ] {
          feet.stroke(svg(leg), tentacle, width: 9, cap: .round)
        }
        for (x, y) in [(43.5, 106.0), (76.5, 106.0), (59.0, 104.0)] {
          feet.fill(ArtShape.circle(x, y, 1.6), tip, opacity: 0.9)
        }
      }
      body.part(.head, pivot: CGPoint(x: 60, y: 90)) { head in
        head.fill(
          svg(
            "M60 16 C 86 16, 102 35, 102 58 C 102 79, 88 92, 60 92 C 32 92, 18 79, 18 58 C 18 35, 34 16, 60 16 Z"
          ), skin)
        beltPiece(head, ArtShape.rect(27, 87, 66, 7, radius: 3.5), edge: 0.16, width: 1.2)
        beltPiece(head, svg("M82.5 91 l-3 9 l3.6 .8 l2.4 -8 z"), edge: 0.16)
        beltPiece(head, svg("M85.5 91 l5 8 l-3.4 1.4 l-3.6 -7.6 z"), edge: 0.16)
        beltPiece(head, ArtShape.rect(79, 85.5, 10, 10, radius: 3), edge: 0.2)
        head.fill(
          ArtShape.ellipse(44, 30, 13, 6).rotated(-14, around: 44, 30), .color(.white),
          opacity: 0.42)
        for (x, y, radius) in [(62.0, 25.0, 3.6), (81.0, 31.0, 3.0), (90.0, 45.0, 2.4)] {
          head.fill(ArtShape.circle(x, y, radius), .color(Color(art: 0xb69cf2)))
        }
        face(head)
      }
    }
  }
}
