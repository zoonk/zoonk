import SwiftUI

/// Every buddy shares one face layout (eyes at x 44 and 76, y 58; mouth near y 80), so every
/// expression and every pair of glasses fits every buddy.
enum BuddyExpression: CaseIterable, Hashable, Sendable {
  case neutral
  case happy
  case cheer
  case proud
  case wow
  case think
  case kind
  case sleepy

  static let sleepyEyesOffset = 3.0
}

private let ink = ArtPaint.color(Color(art: 0x221b52))
private let pupilInk = ArtPaint.color(Color(art: 0x16123a))
private let white = ArtPaint.color(.white)

private let leftEyePivot = CGPoint(x: 44, y: 61)
private let rightEyePivot = CGPoint(x: 76, y: 61)

struct BuddyFaceArt {
  let expression: BuddyExpression

  func draw(_ painter: ArtPainter) {
    switch expression {
    case .neutral:
      openEyes(painter)
      lineMouth(painter, "M55.5 81 Q60 82.6 64.5 81")
    case .happy:
      openEyes(painter)
      lineMouth(painter, "M54 79 Q60 85 66 79")
    case .cheer:
      arcEyes(painter, left: "M37 60 Q44 51 51 60", right: "M69 60 Q76 51 83 60", width: 3.4)
      mouth(painter) { mouth in
        mouth.fill(svg("M52 77 Q60 90 68 77 Z"), ink)
        mouth.fill(svg("M55.5 81 Q60 85 64.5 81"), .color(Color(art: 0xff7ab6)))
      }
    case .proud:
      arcEyes(
        painter, left: "M37.5 59.5 Q44 54 50.5 59.5", right: "M69.5 59.5 Q76 54 82.5 59.5",
        width: 3.2)
      brows(painter, left: "M35 40.5 Q42 35.5 50 37.5", right: "M85 40.5 Q78 35.5 70 37.5")
      lineMouth(painter, "M52.5 79.5 Q60 86.5 68 78")
    case .wow:
      openEye(
        painter, .left, white: (44, 58, 9.5, 10.5), pupil: (44, 58, 4), glint: (45.5, 56.5, 1.4))
      openEye(
        painter, .right, white: (76, 58, 9.5, 10.5), pupil: (76, 58, 4), glint: (77.5, 56.5, 1.4))
      blinkLids(painter)
      mouth(painter) { $0.fill(ArtShape.ellipse(60, 81, 4.2, 5), ink) }
    case .think:
      openEye(
        painter, .left, white: (44, 58, 8.5, 9.5), pupil: (47.5, 55, 5.2), glint: (49, 53, 1.7))
      openEye(
        painter, .right, white: (76, 58, 8.5, 9.5), pupil: (79.5, 55, 5.2), glint: (81, 53, 1.7))
      blinkLids(painter)
      lineMouth(painter, "M55 81 Q60 79.5 66 81")
    case .kind:
      openEyes(painter)
      brows(painter, left: "M34 40 Q41 36 50 38", right: "M86 40 Q79 36 70 38")
      lineMouth(painter, "M55 80 Q60 83.5 65 80")
    case .sleepy:
      sleepyFace(painter)
    }
  }

  private enum Side { case left, right }

  private func openEye(
    _ painter: ArtPainter, _ side: Side, white eye: (Double, Double, Double, Double),
    pupil: (Double, Double, Double), glint: (Double, Double, Double)
  ) {
    painter.part(
      side == .left ? .eyeLeft : .eyeRight, pivot: side == .left ? leftEyePivot : rightEyePivot
    ) { eyePainter in
      eyePainter.fill(ArtShape.ellipse(eye.0, eye.1, eye.2, eye.3), white)
      eyePainter.part(
        side == .left ? .pupilLeft : .pupilRight, pivot: CGPoint(x: pupil.0, y: pupil.1)
      ) { pupilPainter in
        pupilPainter.fill(ArtShape.circle(pupil.0, pupil.1, pupil.2), pupilInk)
        pupilPainter.fill(ArtShape.circle(glint.0, glint.1, glint.2), white)
      }
    }
  }

  private func openEyes(_ painter: ArtPainter) {
    openEye(painter, .left, white: (44, 58, 8.5, 9.5), pupil: (45, 60, 5.4), glint: (47, 57.5, 1.9))
    openEye(
      painter, .right, white: (76, 58, 8.5, 9.5), pupil: (77, 60, 5.4), glint: (79, 57.5, 1.9))
    blinkLids(painter)
  }

  private func blinkLids(_ painter: ArtPainter) {
    painter.part(.lidLeft, pivot: leftEyePivot) {
      $0.stroke(svg("M36 61 Q44 64 52 61"), pupilInk, width: 3.2, cap: .round)
    }
    painter.part(.lidRight, pivot: rightEyePivot) {
      $0.stroke(svg("M68 61 Q76 64 84 61"), pupilInk, width: 3.2, cap: .round)
    }
  }

  private func arcEyes(_ painter: ArtPainter, left: String, right: String, width: CGFloat) {
    painter.part(.eyeLeft, pivot: leftEyePivot) {
      $0.stroke(svg(left), pupilInk, width: width, cap: .round)
    }
    painter.part(.eyeRight, pivot: rightEyePivot) {
      $0.stroke(svg(right), pupilInk, width: width, cap: .round)
    }
  }

  private func mouth(_ painter: ArtPainter, _ content: (ArtPainter) -> Void) {
    painter.part(.mouth, pivot: CGPoint(x: 60, y: 80), content)
  }

  private func lineMouth(_ painter: ArtPainter, _ path: String) {
    mouth(painter) { $0.stroke(svg(path), ink, width: 3, cap: .round) }
  }

  private func brows(_ painter: ArtPainter, left: String, right: String) {
    painter.part(.browLeft, pivot: CGPoint(x: 42, y: 38)) {
      $0.stroke(svg(left), ink, width: 3, opacity: 0.5, cap: .round)
    }
    painter.part(.browRight, pivot: CGPoint(x: 78, y: 38)) {
      $0.stroke(svg(right), ink, width: 3, opacity: 0.5, cap: .round)
    }
  }

  private func sleepyFace(_ painter: ArtPainter) {
    let lowered = CGAffineTransform(translationX: 0, y: BuddyExpression.sleepyEyesOffset)

    painter.part(.eyeLeft, pivot: leftEyePivot) {
      $0.stroke(
        svg("M37 58 Q44 63 51 58").applying(lowered), pupilInk, width: 3.2, cap: .round)
    }
    painter.part(.eyeRight, pivot: rightEyePivot) {
      $0.stroke(
        svg("M69 58 Q76 63 83 58").applying(lowered), pupilInk, width: 3.2, cap: .round)
    }
    mouth(painter) { $0.fill(ArtShape.ellipse(60, 82, 3.4, 2.6), ink) }
    painter.part(.snore, pivot: CGPoint(x: 104, y: 20)) { snore in
      snore.stroke(
        svg("M96 20 h8 l-8 10 h8"), .color(Color(art: 0x8b93c9)), width: 2.6, cap: .round,
        join: .round)
      snore.stroke(
        svg("M106 9 h6 l-6 7.5 h6"), .color(Color(art: 0xb3b9dd)), width: 2, cap: .round,
        join: .round)
    }
  }
}
