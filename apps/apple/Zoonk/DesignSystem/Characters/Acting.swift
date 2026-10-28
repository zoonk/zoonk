import Foundation

/// Characters (the buddy, the Trickster) are drawn as named parts, so they act the way a person
/// does: their eyes, lids, brows, mouth and limbs move, never the whole drawing at once (main's
/// `packages/ui/src/components/_character`). A part turns, stretches and moves around its own
/// pivot, in the character's drawing units.
enum CharacterPart: Hashable, Sendable {
  case antenna, antennaLeft, antennaRight
  case armLeft, armRight
  case body, torso, feet, shadow, head, face
  case browLeft, browRight
  case eyeLeft, eyeRight, pupilLeft, pupilRight, lidLeft, lidRight
  case mouth, mask, snore, sweat
  case crown, sign, tail
}

/// Two numbers an act moves together: a stretch's width and height, or a move's x and y.
struct ArtPair: Equatable, Sendable, ExpressibleByArrayLiteral {
  var x: Double
  var y: Double

  init(_ x: Double, _ y: Double) {
    self.x = x
    self.y = y
  }

  init(arrayLiteral elements: Double...) {
    precondition(elements.count == 2, "An ArtPair takes two numbers")
    self.init(elements[0], elements[1])
  }

  static let zero = ArtPair(0, 0)
  static let one = ArtPair(1, 1)
}

/// Where a part sits when it isn't at rest: its turn in degrees, its stretch, its move, and how
/// much of it shows.
struct PartPose: Equatable, Sendable {
  var opacity = 1.0
  var rotate = 0.0
  var scale = ArtPair.one
  var translate = ArtPair.zero

  static let still = PartPose()
  /// A part drawn only by an act, such as the line a shut eye shows.
  static let hidden = PartPose(opacity: 0)
}

/// How a part moves into a key, on one of main's motion tokens (`globals.css`), or held until the
/// key and then changed at once (`hold`, as an animator swaps a drawing).
enum ActEase: Sendable {
  /// Speeding up into a pose: the dip before a cheer, a lid closing.
  case accelerate
  /// A loose part (an antenna, a tail, a crown) lagging and swinging past its stop: a looser spring.
  case follow
  case hold
  /// Fast out of the gate, gentle landing: darts and actions.
  case out
  /// Apple's bouncy spring (bounce 0.3), for something landing.
  case spring
  /// Slow out of one pose and into the next: a head turning, weight shifting.
  case swing

  /// How far along a move is, eased, at `progress` (0–1) of its time. Springs pass 1 before
  /// settling.
  func value(at progress: Double) -> Double {
    let progress = min(max(progress, 0), 1)

    switch self {
    case .accelerate: return Self.cubic(progress, 0.55, 0, 1, 0.45)
    case .follow: return Self.sampled(progress, Self.followSamples)
    case .hold: return progress < 1 ? 0 : 1
    case .out: return Self.cubic(progress, 0.22, 1, 0.36, 1)
    case .spring: return Self.sampled(progress, Self.springSamples)
    case .swing: return Self.cubic(progress, 0.45, 0, 0.55, 1)
    }
  }

  /// CSS's `cubic-bezier()`: the curve's y where its x is `progress`.
  private static func cubic(
    _ progress: Double, _ x1: Double, _ y1: Double, _ x2: Double, _ y2: Double
  ) -> Double {
    func bezier(_ t: Double, _ p1: Double, _ p2: Double) -> Double {
      let inverse = 1 - t
      return 3 * inverse * inverse * t * p1 + 3 * inverse * t * t * p2 + t * t * t
    }

    // x(t) only grows on these curves, so halving the range finds t to well under a pixel.
    var low = 0.0
    var high = 1.0
    var t = progress

    for _ in 0..<24 {
      if bezier(t, x1, x2) < progress {
        low = t
      } else {
        high = t
      }
      t = (low + high) / 2
    }

    return bezier(t, y1, y2)
  }

  /// CSS's `linear()`: straight lines between sampled points (input, output).
  private static func sampled(_ progress: Double, _ samples: [(Double, Double)]) -> Double {
    guard let upper = samples.firstIndex(where: { $0.0 >= progress }), upper > 0 else {
      return samples.first?.1 ?? progress
    }

    let (inputA, outputA) = samples[upper - 1]
    let (inputB, outputB) = samples[upper]
    return outputA + (outputB - outputA) * (progress - inputA) / (inputB - inputA)
  }

  /// `--ease-spring`: SwiftUI's `Spring(duration: 0.5, bounce: 0.3)` sampled over 650 ms.
  private static let springSamples: [(Double, Double)] = [
    (0, 0), (0.015, 0.007), (0.03, 0.027), (0.047, 0.061), (0.067, 0.114), (0.082, 0.161),
    (0.1, 0.224), (0.167, 0.47), (0.198, 0.582), (0.23, 0.683), (0.262, 0.771), (0.292, 0.841),
    (0.322, 0.899), (0.352, 0.946), (0.383, 0.983), (0.415, 1.01), (0.45, 1.029), (0.488, 1.041),
    (0.53, 1.046), (0.598, 1.042), (0.832, 1.007), (0.93, 1), (1, 1),
  ]

  /// `--ease-follow`: a spring with damping 0.45, a 20% overshoot and one small swing back.
  private static let followSamples: [(Double, Double)] = [
    (0, 0), (0.042, 0.11), (0.083, 0.362), (0.125, 0.652), (0.167, 0.906), (0.208, 1.086),
    (0.25, 1.182), (0.292, 1.205), (0.333, 1.178), (0.375, 1.124), (0.417, 1.065), (0.458, 1.014),
    (0.5, 0.979), (0.542, 0.961), (0.583, 0.958), (0.625, 0.965), (0.667, 0.976), (0.708, 0.988),
    (0.75, 0.998), (0.792, 1.005), (0.833, 1.008), (0.875, 1.009), (0.917, 1.007), (0.958, 1.005),
    (1, 1),
  ]
}

/// A part's pose at one frame of an act, and the curve it arrives there on. Only what it sets
/// moves at that key.
struct ActKey: Sendable {
  var at: Double
  var ease: ActEase?
  var opacity: Double?
  var rotate: Double?
  var scale: ArtPair?
  var translate: ArtPair?
}

/// One part's motion through an act. It starts from the pose the part is drawn in and ends at the
/// pose of the expression the act lands in, on `settle`'s curve, so an act never jumps at either
/// end; a key at frame 0 or at the last frame replaces that end. `rest` is the part's pose when no
/// expression poses it (a blink's lid line rests hidden).
struct ActTrack: Sendable {
  var part: CharacterPart
  var keys: [ActKey]
  var rest: PartPose = .still
  var settle: ActEase?

  /// The part's pose at `frame` of an act `frames` long, between the pose it starts in and the
  /// one it lands in.
  func pose(at frame: Double, frames: Double, from: PartPose, to: PartPose) -> PartPose {
    PartPose(
      opacity: value(\.opacity, at: frame, frames: frames, from: from.opacity, to: to.opacity),
      rotate: value(\.rotate, at: frame, frames: frames, from: from.rotate, to: to.rotate),
      scale: value(\.scale, at: frame, frames: frames, from: from.scale, to: to.scale),
      translate: value(
        \.translate, at: frame, frames: frames, from: from.translate, to: to.translate))
  }

  /// One property between its keys, each segment on the curve of the key it reaches, as
  /// `element.animate()` plays main's keyframes.
  private func value<Value: ArtInterpolable>(
    _ property: KeyPath<ActKey, Value?>, at frame: Double, frames: Double, from: Value, to: Value
  ) -> Value {
    var points = keys.compactMap { key in
      key[keyPath: property].map { (at: key.at, ease: key.ease, value: $0) }
    }

    if points.first?.at != 0 {
      points.insert((at: 0, ease: nil, value: from), at: 0)
    }

    if points.last?.at != frames {
      points.append((at: frames, ease: settle, value: to))
    }

    guard let first = points.first, frame > first.at else {
      return points.first?.value ?? from
    }

    for index in points.indices.dropFirst() where frame < points[index].at {
      let start = points[index - 1]
      let end = points[index]
      let progress = (frame - start.at) / max(end.at - start.at, .ulpOfOne)
      return start.value.interpolated(to: end.value, by: (end.ease ?? .out).value(at: progress))
    }

    return points[points.count - 1].value
  }
}

/// A value an act moves smoothly between keys.
protocol ArtInterpolable {
  func interpolated(to other: Self, by amount: Double) -> Self
}

extension Double: ArtInterpolable {
  func interpolated(to other: Double, by amount: Double) -> Double {
    self + (other - self) * amount
  }
}

extension ArtPair: ArtInterpolable {
  func interpolated(to other: ArtPair, by amount: Double) -> ArtPair {
    ArtPair(x.interpolated(to: other.x, by: amount), y.interpolated(to: other.y, by: amount))
  }
}

/// A short performance on a character's parts, timed in frames at 24 a second (main's
/// `duration-frame`), and the expression it lands in. At `swapAt` the face is replaced by the
/// landing expression's, the way a 2D animator swaps a mouth or a pair of eyes, usually while the
/// eyes are shut or a part is squashed, so the change reads as one motion.
struct CharacterAct<Expression: Hashable & Sendable>: Sendable {
  static var framesPerSecond: Double { 24 }

  var frames: Double
  var swapAt: Double?
  var to: Expression?
  var tracks: [ActTrack]

  var duration: TimeInterval { frames / Self.framesPerSecond }

  /// Each part's pose at `frame`, starting from the poses of the expression it plays from and
  /// landing in the poses of the one it lands in. Parts without a track keep the pose they're
  /// drawn in.
  func poses(
    at frame: Double, from fromPoses: [CharacterPart: PartPose],
    to toPoses: [CharacterPart: PartPose]
  ) -> [CharacterPart: PartPose] {
    var poses = fromPoses

    for track in tracks {
      poses[track.part] = track.pose(
        at: frame, frames: frames, from: fromPoses[track.part] ?? track.rest,
        to: toPoses[track.part] ?? track.rest)
    }

    return poses
  }

  /// The face drawn at `frame`: the one it started in until the swap, then the one it lands in.
  func face(at frame: Double, from: Expression) -> Expression {
    guard let to, let swapAt, frame >= swapAt else { return from }
    return to
  }
}

/// What a character does because something happened, once, as the moment it's in plays: an act on
/// the moment's beat (`delay`, in seconds; main's `BEAT_MS` is a quarter of one).
struct ActReaction<ActName: Hashable & Sendable>: Hashable, Sendable {
  var act: ActName
  var delay: TimeInterval = 0
}

extension TimeInterval {
  /// One beat of a moment (main's `BEAT_MS`): a celebration plays one thing at a time, in reading
  /// order, a beat apart.
  static let beat = 0.25
}

/// An act a screen asks for on cue (a duel's verdict, the buddy's answer), played each time `id`
/// changes.
struct ActCue<ActName: Hashable & Sendable>: Hashable, Sendable {
  var id: Int
  var act: ActName
}
