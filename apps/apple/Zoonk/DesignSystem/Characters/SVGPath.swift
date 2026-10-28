import SwiftUI
import Synchronization

extension Path {
  /// A path from SVG path data (`d`), so the characters keep main's drawings point for point
  /// (`packages/ui/src/components/_buddy`, `trickster.tsx`). It reads the commands those drawings
  /// use: moves, lines (`L`, `H`, `V`), quadratic and cubic curves, elliptical arcs and close, in
  /// absolute and relative form, with a command's numbers repeating it.
  init(svg data: String) {
    self.init()

    var scanner = SVGPathScanner(data)
    var current = CGPoint.zero
    var subpathStart = CGPoint.zero
    var command: Character = "M"

    while let next = scanner.nextCommand(after: command) {
      command = next
      let relative = command.isLowercase
      let origin = relative ? current : .zero

      switch command.uppercased() {
      case "M":
        guard let point = scanner.point(from: origin) else { return }
        move(to: point)
        current = point
        subpathStart = point
        // Pairs after a move's first one are lines.
        command = relative ? "l" : "L"
      case "L":
        guard let point = scanner.point(from: origin) else { return }
        addLine(to: point)
        current = point
      case "H":
        guard let x = scanner.number() else { return }
        current = CGPoint(x: x + origin.x, y: current.y)
        addLine(to: current)
      case "V":
        guard let y = scanner.number() else { return }
        current = CGPoint(x: current.x, y: y + origin.y)
        addLine(to: current)
      case "Q":
        guard let control = scanner.point(from: origin), let point = scanner.point(from: origin)
        else { return }
        addQuadCurve(to: point, control: control)
        current = point
      case "C":
        guard let first = scanner.point(from: origin), let second = scanner.point(from: origin),
          let point = scanner.point(from: origin)
        else { return }
        addCurve(to: point, control1: first, control2: second)
        current = point
      case "A":
        guard let radiusX = scanner.number(), let radiusY = scanner.number(),
          let rotation = scanner.number(), let largeArc = scanner.number(),
          let sweep = scanner.number(), let point = scanner.point(from: origin)
        else { return }
        addSVGArc(
          from: current, to: point, radii: CGSize(width: radiusX, height: radiusY),
          rotation: rotation, largeArc: largeArc != 0, sweep: sweep != 0)
        current = point
      case "Z":
        closeSubpath()
        current = subpathStart
      default:
        assertionFailure("Unsupported SVG path command \(command)")
        return
      }
    }
  }

  /// An SVG elliptical arc as cubic curves, converted from its endpoints to its center
  /// (SVG 1.1, appendix F.6.5).
  private mutating func addSVGArc(
    from start: CGPoint, to end: CGPoint, radii: CGSize, rotation: Double, largeArc: Bool,
    sweep: Bool
  ) {
    var radiusX = abs(radii.width)
    var radiusY = abs(radii.height)

    guard radiusX > 0, radiusY > 0, start != end else {
      addLine(to: end)
      return
    }

    let angle = rotation * .pi / 180
    let cosAngle = cos(angle)
    let sinAngle = sin(angle)
    let halfX = (start.x - end.x) / 2
    let halfY = (start.y - end.y) / 2
    let x1 = cosAngle * halfX + sinAngle * halfY
    let y1 = -sinAngle * halfX + cosAngle * halfY

    // Radii too small to reach the end point grow until they do.
    let reach = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY)
    if reach > 1 {
      radiusX *= reach.squareRoot()
      radiusY *= reach.squareRoot()
    }

    let numerator =
      radiusX * radiusX * radiusY * radiusY - radiusX * radiusX * y1 * y1 - radiusY * radiusY * x1
      * x1
    let denominator = radiusX * radiusX * y1 * y1 + radiusY * radiusY * x1 * x1
    let factor =
      (largeArc == sweep ? -1 : 1) * (max(numerator, 0) / denominator).squareRoot()
    let centerX1 = factor * radiusX * y1 / radiusY
    let centerY1 = -factor * radiusY * x1 / radiusX
    let center = CGPoint(
      x: cosAngle * centerX1 - sinAngle * centerY1 + (start.x + end.x) / 2,
      y: sinAngle * centerX1 + cosAngle * centerY1 + (start.y + end.y) / 2)

    func unitAngle(_ x: Double, _ y: Double) -> Double { atan2(y, x) }

    let startAngle = unitAngle((x1 - centerX1) / radiusX, (y1 - centerY1) / radiusY)
    var sweepAngle =
      unitAngle((-x1 - centerX1) / radiusX, (-y1 - centerY1) / radiusY) - startAngle

    if sweep, sweepAngle < 0 {
      sweepAngle += 2 * .pi
    } else if !sweep, sweepAngle > 0 {
      sweepAngle -= 2 * .pi
    }

    // Each cubic covers at most a quarter turn, which keeps it within a hair of the ellipse.
    let segments = Int(ceil(abs(sweepAngle) / (.pi / 2)))
    let step = sweepAngle / Double(segments)
    let handle = 4.0 / 3.0 * tan(step / 4)

    func point(_ theta: Double, _ dx: Double = 0, _ dy: Double = 0) -> CGPoint {
      let x = radiusX * (cos(theta) + dx)
      let y = radiusY * (sin(theta) + dy)
      return CGPoint(
        x: center.x + cosAngle * x - sinAngle * y, y: center.y + sinAngle * x + cosAngle * y)
    }

    for segment in 0..<segments {
      let theta1 = startAngle + Double(segment) * step
      let theta2 = theta1 + step
      addCurve(
        to: segment == segments - 1 ? end : point(theta2),
        control1: point(theta1, -handle * sin(theta1), handle * cos(theta1)),
        control2: point(theta2, handle * sin(theta2), -handle * cos(theta2)))
    }
  }
}

/// Parsed paths by their data, so each drawing's path is read once however often it's drawn.
private let parsedPaths = Mutex<[String: Path]>([:])

/// The path for SVG path data, read once and kept.
func svg(_ data: String) -> Path {
  if let path = parsedPaths.withLock({ $0[data] }) {
    return path
  }

  let path = Path(svg: data)
  parsedPaths.withLock { $0[data] = path }
  return path
}

/// Reads SVG path data: command letters and the numbers after them, separated by spaces, commas,
/// a sign or a second decimal point (`3.6.8` is 3.6 and .8).
private struct SVGPathScanner {
  private let bytes: [UInt8]
  private var index = 0

  init(_ data: String) {
    bytes = Array(data.utf8)
  }

  /// The next command: a letter, or the last one again when numbers follow it.
  mutating func nextCommand(after previous: Character) -> Character? {
    skipSeparators()

    guard index < bytes.count else { return nil }

    let byte = bytes[index]
    if isLetter(byte) {
      index += 1
      return Character(UnicodeScalar(byte))
    }

    return previous.uppercased() == "Z" ? nil : previous
  }

  mutating func point(from origin: CGPoint) -> CGPoint? {
    guard let x = number(), let y = number() else { return nil }
    return CGPoint(x: x + origin.x, y: y + origin.y)
  }

  mutating func number() -> Double? {
    skipSeparators()
    let start = index

    if index < bytes.count, bytes[index] == UInt8(ascii: "-") || bytes[index] == UInt8(ascii: "+") {
      index += 1
    }

    var seenPoint = false
    var seenExponent = false

    while index < bytes.count {
      let byte = bytes[index]

      if isDigit(byte) {
        index += 1
      } else if byte == UInt8(ascii: "."), !seenPoint, !seenExponent {
        seenPoint = true
        index += 1
      } else if byte == UInt8(ascii: "e") || byte == UInt8(ascii: "E"), !seenExponent {
        seenExponent = true
        index += 1
        if index < bytes.count,
          bytes[index] == UInt8(ascii: "-") || bytes[index] == UInt8(ascii: "+")
        {
          index += 1
        }
      } else {
        break
      }
    }

    guard index > start else { return nil }
    return Double(String(decoding: bytes[start..<index], as: UTF8.self))
  }

  private mutating func skipSeparators() {
    while index < bytes.count,
      bytes[index] == UInt8(ascii: " ") || bytes[index] == UInt8(ascii: ",")
        || bytes[index] == UInt8(ascii: "\n") || bytes[index] == UInt8(ascii: "\t")
    {
      index += 1
    }
  }

  private func isDigit(_ byte: UInt8) -> Bool {
    byte >= UInt8(ascii: "0") && byte <= UInt8(ascii: "9")
  }

  /// A command letter; `e` and `E` only ever appear inside a number's exponent.
  private func isLetter(_ byte: UInt8) -> Bool {
    let lowercased = byte | 0x20
    return lowercased >= UInt8(ascii: "a") && lowercased <= UInt8(ascii: "z")
      && lowercased != UInt8(ascii: "e")
  }
}
