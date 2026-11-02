import SwiftUI

enum TricksterExpression: CaseIterable, Hashable, Sendable {
  case sly, smug, defeated

  var poses: [CharacterPart: PartPose] {
    switch self {
    case .sly:
      [:]
    case .smug:
      [.crown: PartPose(rotate: -7), .tail: PartPose(rotate: -5)]
    case .defeated:
      [
        .armLeft: PartPose(rotate: -22),
        .armRight: PartPose(rotate: 22),
        .body: PartPose(rotate: 5, scale: [1.03, 0.95]),
        .crown: PartPose(rotate: -18, translate: [-3, 8]),
        .tail: PartPose(rotate: 16),
      ]
    }
  }

  fileprivate var lids: (left: String, right: String) {
    switch self {
    case .sly:
      ("M40 100.6 L70 98.2 L70 120 L40 120 Z", "M70 95.4 L96 93.6 L96 118 L70 118 Z")
    case .smug:
      ("M40 102.6 L70 100.4 L70 120 L40 120 Z", "M70 98 L96 96.4 L96 118 L70 118 Z")
    case .defeated:
      ("M40 104.6 L70 100.4 L70 120 L40 120 Z", "M70 96.2 L96 100.6 L96 118 L70 118 Z")
    }
  }
}

private let ink = ArtPaint.color(Color(art: 0x2a1260))
private let pupilInk = ArtPaint.color(Color(art: 0x16123a))
private let violet = ArtPaint.color(Color(art: 0x7c3aed))

/// `holdsSign` while he's the star of a challenge he hasn't lost.
struct TricksterArt: CharacterArt {
  var holdsSign = false

  var viewBox: CGRect { CGRect(x: 0, y: 0, width: 160, height: 160) }
  var overflow: CGFloat { 0.1 }

  static func act(_ name: TricksterAct) -> CharacterAct<TricksterExpression> { name.act }
  static func poses(of expression: TricksterExpression) -> [CharacterPart: PartPose] {
    expression.poses
  }
  static var blink: TricksterAct { .blink }
  static var openEyes: Set<TricksterExpression> { Set(TricksterExpression.allCases) }

  func draw(_ painter: ArtPainter, face: TricksterExpression) {
    painter.part(.shadow, pivot: CGPoint(x: 72, y: 150)) {
      $0.fill(ArtShape.ellipse(72, 150, 26, 4), .color(.black), opacity: 0.22)
    }
    painter.part(.body, pivot: CGPoint(x: 72, y: 142)) { body in
      body.part(.armLeft, pivot: CGPoint(x: 46, y: 116)) {
        $0.fill(ArtShape.ellipse(38, 124, 6.5, 8.5).rotated(38, around: 38, 124), violet)
      }
      body.part(.armRight, pivot: CGPoint(x: 98, y: 116)) {
        $0.fill(ArtShape.ellipse(106, 124, 6.5, 8.5).rotated(-38, around: 106, 124), violet)
      }
      body.part(.head, pivot: CGPoint(x: 72, y: 140)) { head in
        head.part(.tail, pivot: CGPoint(x: 86, y: 88), tail)
        head.fill(
          ArtShape.circle(72, 106, 36),
          .radial(
            Gradient(
              art: (0xf3e9ff, 0, 1), (0xc9aaff, 0.3, 1), (0x8b5cf6, 0.72, 1), (0x4c1d95, 1, 1)),
            center: CGPoint(x: 0.34, y: 0.28), radius: 0.8))
        head.fill(
          ArtShape.ellipse(58, 84, 11, 6).rotated(-28, around: 58, 84), .color(.white),
          opacity: 0.45)
        head.fill(ArtShape.circle(93, 92, 2), .color(.white), opacity: 0.35)

        if holdsSign {
          questionSign(head)
        }

        head.part(.face, pivot: CGPoint(x: 70, y: 104)) {
          TricksterFaceArt(expression: face).draw($0)
        }
        head.part(.crown, pivot: CGPoint(x: 51, y: 66), crown)
      }
    }
  }

  private func tail(_ painter: ArtPainter) {
    let plasma = ArtPaint.linearInDrawing(
      Gradient(art: (0x8b5cf6, 0, 1), (0xc084fc, 0.45, 1), (0xff9ad5, 0.8, 1), (0xffd1ec, 1, 1)),
      start: CGPoint(x: 86, y: 92), end: CGPoint(x: 92, y: 8))

    painter.fill(
      svg("M73 34 A27 27 0 1 1 109.23 59.37 L102.51 47.67 A17 17 0 1 0 79.7 31.7 Z"), plasma)
    painter.fill(ArtShape.circle(76.35, 32.85, 3.55), plasma)
    painter.stroke(svg("M105.9 53.5 C94.6 57.6 86 68 82 90"), plasma, width: 13.5, cap: .round)
    painter.stroke(
      svg("M78 27 A24 24 0 0 1 112.5 13.4"), .color(.white), width: 2.2, opacity: 0.55, cap: .round)
  }

  private func crown(_ painter: ArtPainter) {
    let rim = ArtPaint.color(Color(art: 0xc7861c))
    let placed = ArtShape.rotation(-20, 51, 66).translatedBy(x: 36, y: 55).scaledBy(
      x: 0.75, y: 0.75)

    painter.group(placed) { crown in
      let points = svg("M5 25 L3 8 L12.5 16 L20 3.5 L27.5 16 L37 8 L35 25 Z")
      crown.fill(
        points,
        .linear(Gradient(art: (0xfff0b8, 0, 1), (0xf5b52e, 1, 1)), start: .top, end: .bottom))
      crown.stroke(points, rim, width: 1.8, join: .round)
      let band = ArtShape.rect(4.5, 21.5, 31, 6, radius: 2)
      crown.fill(band, .color(Color(art: 0xf7c24a)))
      crown.stroke(band, rim, width: 1.6)
      crown.fill(ArtShape.circle(3, 8, 2.6), .color(Color(art: 0x7cf5ff)))
      crown.fill(ArtShape.circle(37, 8, 2.6), .color(Color(art: 0x7cf5ff)))
      crown.fill(ArtShape.circle(20, 3.5, 3), .color(Color(art: 0xff7ac6)))
      crown.fill(ArtShape.circle(20, 24.5, 2), .color(Color(art: 0xff7ac6)))
    }
  }

  /// The "?" sign on a stick. It turns around his left shoulder, as the arm holding it does, so an
  /// act moves both together.
  private func questionSign(_ painter: ArtPainter) {
    let stick = ArtPaint.color(Color(art: 0xc4b5fd))

    painter.part(.sign, pivot: CGPoint(x: 46, y: 116)) { sign in
      sign.group(ArtShape.rotation(-14, 30, 120)) { board in
        board.stroke(svg("M30 124 V104"), stick, width: 3, cap: .round)
        board.fill(ArtShape.circle(30, 96, 13), .color(Color(art: 0xfbfaff)))
        board.stroke(ArtShape.circle(30, 96, 13), stick, width: 1.8)
        board.stroke(
          svg("M25.5 92.5 C25.5 86.5 34.5 86.5 34.5 92 C34.5 95.5 30 96 30 99.5"), violet,
          width: 2.6, cap: .round)
        board.fill(ArtShape.circle(30, 103.5, 1.6), violet)
      }
      sign.fill(ArtShape.ellipse(34, 121, 6.5, 7), violet)
    }
  }
}

private struct TricksterFaceArt {
  let expression: TricksterExpression

  func draw(_ painter: ArtPainter) {
    mask(painter)

    switch expression {
    case .sly:
      eye(
        painter, .left, white: (56, 103, 7.6, 8), pupil: (53.4, 104.6, 4),
        glint: (54.8, 103.3, 1.3),
        lid: "M48.2 100.2 L63.8 99")
      eye(
        painter, .right, white: (82, 101, 7.6, 8.2), pupil: (79.4, 102.6, 4.2),
        glint: (80.9, 101.2, 1.4), lid: nil)
      brows(painter, left: "M46 88 Q54 86.5 62 89.5", right: "M74 84 Q82 75.5 92 81")
      grin(
        painter, cheek: "M88 111.5 Q92 111 93 108", fang: "M59.5 122.6 L62 128 L65 123.6 Z",
        grin: "M52 119 Q68 132 90 114 Q71 124.5 52 119 Z")
    case .smug:
      eye(
        painter, .left, white: (56, 103, 7.6, 8), pupil: (57, 105, 4), glint: (58.4, 103.6, 1.3),
        lid: "M48.2 102.2 L63.8 101.2")
      eye(
        painter, .right, white: (82, 101, 7.6, 8.2), pupil: (83, 103, 4.2),
        glint: (84.5, 101.6, 1.4), lid: "M74.5 97.6 L89.5 96.6")
      brows(painter, left: "M46 89.5 Q54 88.5 62 91", right: "M74 82.5 Q82 72.5 92 79")
      grin(
        painter, cheek: "M90.5 109.5 Q94.5 109 95.5 105.5", fang: "M58.5 122.4 L61 128 L64 123.4 Z",
        grin: "M50 118.5 Q68 133.5 92.5 111.5 Q71 125.5 50 118.5 Z")
    case .defeated:
      eye(
        painter, .left, white: (56, 103, 7.6, 8), pupil: (55, 107.5, 4), glint: (56.4, 106.3, 1.3),
        lid: "M47.6 103.7 L63.6 101.5")
      eye(
        painter, .right, white: (82, 101, 7.6, 8.2), pupil: (81, 106, 4.2),
        glint: (82.4, 104.8, 1.4), lid: "M74.6 97.4 L89.6 99.9")
      brows(painter, left: "M45 92.5 Q53 89.5 61.5 85.5", right: "M75 82 Q83 82.5 92 87.5")
      painter.part(.mouth, pivot: CGPoint(x: 70, y: 121)) {
        $0.stroke(
          svg("M56 123.5 Q60.5 119 65 122 Q70 125.5 75 121.5 Q80 118 85.5 122.5"), ink, width: 3,
          cap: .round, join: .round)
      }
      painter.part(.sweat, pivot: CGPoint(x: 104, y: 84)) {
        $0.fill(
          svg("M104 77 Q99.2 84.4 101.4 87 Q104 89.4 106.6 87 Q108.8 84.4 104 77 Z"),
          .color(Color(art: 0xa8ddff)))
        $0.fill(ArtShape.circle(102.6, 85.2, 1), .color(.white), opacity: 0.8)
      }
    }
  }

  private enum Side { case left, right }

  private func mask(_ painter: ArtPainter) {
    painter.part(.mask, pivot: CGPoint(x: 70, y: 102)) {
      $0.fill(
        svg(
          "M41 99 Q47 90 60 94 Q67 96.5 72 94 Q86 86 98 92 Q100 104 91 110 Q80 114.5 72.5 106.5 Q68.5 103.5 64.5 106.5 Q54 115 45 110 Q39 105 41 99 Z"
        ), ink)
    }
  }

  private func eye(
    _ painter: ArtPainter, _ side: Side, white eye: (Double, Double, Double, Double),
    pupil: (Double, Double, Double), glint: (Double, Double, Double), lid: String?
  ) {
    let left = side == .left

    painter.part(left ? .eyeLeft : .eyeRight, pivot: CGPoint(x: eye.0, y: eye.1)) { eyePainter in
      eyePainter.clipped(to: svg(left ? expression.lids.left : expression.lids.right)) {
        $0.fill(ArtShape.ellipse(eye.0, eye.1, eye.2, eye.3), .color(.white))
      }
      if let lid {
        eyePainter.stroke(svg(lid), ink, width: 2.6, cap: .round)
      }
      eyePainter.part(left ? .pupilLeft : .pupilRight, pivot: CGPoint(x: pupil.0, y: pupil.1)) {
        $0.fill(ArtShape.circle(pupil.0, pupil.1, pupil.2), pupilInk)
        $0.fill(ArtShape.circle(glint.0, glint.1, glint.2), .color(.white))
      }
    }
  }

  private func brows(_ painter: ArtPainter, left: String, right: String) {
    painter.part(.browLeft, pivot: CGPoint(x: 54, y: 88)) {
      $0.stroke(svg(left), ink, width: 3.2, cap: .round)
    }
    painter.part(.browRight, pivot: CGPoint(x: 83, y: 81)) {
      $0.stroke(svg(right), ink, width: 3.2, cap: .round)
    }
  }

  private func grin(_ painter: ArtPainter, cheek: String, fang: String, grin: String) {
    painter.part(.mouth, pivot: CGPoint(x: 70, y: 120)) {
      $0.fill(svg(grin), ink)
      $0.stroke(svg(grin), ink, width: 2, join: .round)
      $0.fill(svg(fang), .color(.white))
      $0.stroke(svg(cheek), ink, width: 2.4, cap: .round)
    }
  }
}
