import Foundation

/// The Trickster's acts (main's `TRICKSTER_ACTS`), timed in frames at 24 a second.
enum TricksterAct: CaseIterable, Hashable, Sendable {
  /// Under his mask the eyes squash to a sliver in 2 frames, stay shut for 1 and open in 3.
  case blink
  /// A squint, the far brow climbing, the grin widening and a two-beat chuckle: a challenge's
  /// intro, a duel's miss, a challenge lost.
  case smug
  /// Back to sly with a blink, when the learner gets one past him.
  case sly
  /// A take, a held beat, then the slump: a challenge won.
  case defeat

  var act: CharacterAct<TricksterExpression> {
    switch self {
    case .blink: Self.blinkAct
    case .smug: Self.smugAct
    case .sly: Self.slyAct
    case .defeat: Self.defeatAct
    }
  }

  /// Both eyes moving together.
  private static func eyes(_ keys: [ActKey], settle: ActEase? = nil) -> [ActTrack] {
    [
      ActTrack(part: .eyeLeft, keys: keys, settle: settle),
      ActTrack(part: .eyeRight, keys: keys, settle: settle),
    ]
  }

  /// His eyes shut in 2 frames, stay shut for 1 and open in 3 (on the track's ease-out).
  private static let blinkKeys = [
    ActKey(at: 2, ease: .accelerate, scale: [1, 0.1]), ActKey(at: 3, scale: [1, 0.1]),
  ]

  private static let blinkAct = CharacterAct<TricksterExpression>(
    frames: 6, tracks: eyes(blinkKeys))

  /// Back to sly: a blink, his face swapping while his eyes are shut (the grin drops, the lids
  /// lift), and the crown and the tail easing back after it on their loose spring.
  private static let slyAct = CharacterAct<TricksterExpression>(
    frames: 12, swapAt: 2, to: .sly,
    tracks: eyes(blinkKeys + [ActKey(at: 6, ease: .out, scale: [1, 1])]) + [
      ActTrack(part: .crown, keys: [], settle: .follow),
      ActTrack(part: .tail, keys: [], settle: .follow),
    ])

  /// His left arm's two-beat chuckle, which the sign he holds in that hand follows.
  private static let chuckle = [
    ActKey(at: 6, ease: .swing, rotate: 13), ActKey(at: 9, ease: .swing, rotate: -4),
    ActKey(at: 12, ease: .swing, rotate: 10),
  ]

  /// Smug: a squint that lowers his lids (the face swaps behind it), the far brow climbing, the
  /// grin widening, a two-beat chuckle through the body and the arms (the sign shaking in his
  /// hand), the crown cocked past its new angle and the tail swished, both settling late.
  private static let smugAct = CharacterAct<TricksterExpression>(
    frames: 22, swapAt: 4, to: .smug,
    tracks: eyes(
      [ActKey(at: 3, ease: .accelerate, scale: [1, 0.7]), ActKey(at: 4, scale: [1, 0.7])],
      settle: .out)
      + [
        ActTrack(
          part: .browRight, keys: [ActKey(at: 7, ease: .out, rotate: -9, translate: [0, -4.5])],
          settle: .spring),
        ActTrack(
          part: .browLeft, keys: [ActKey(at: 7, ease: .out, translate: [0, 1])], settle: .spring),
        ActTrack(
          part: .mouth,
          keys: [
            ActKey(at: 4, ease: .hold, scale: [0.9, 0.9]),
            ActKey(at: 8, ease: .out, scale: [1.08, 1.05]),
          ], settle: .spring),
        ActTrack(
          part: .body,
          keys: [
            ActKey(at: 6, ease: .swing, scale: [1.04, 0.94]),
            ActKey(at: 9, ease: .swing, scale: [0.985, 1.035]),
            ActKey(at: 12, ease: .swing, scale: [1.03, 0.955]),
            ActKey(at: 15, ease: .swing, scale: [0.995, 1.01]),
          ], settle: .spring),
        ActTrack(part: .armLeft, keys: chuckle, settle: .swing),
        ActTrack(part: .sign, keys: chuckle, settle: .swing),
        ActTrack(
          part: .armRight,
          keys: [
            ActKey(at: 7, ease: .swing, rotate: -11), ActKey(at: 10, ease: .swing, rotate: 3),
            ActKey(at: 13, ease: .swing, rotate: -8),
          ], settle: .swing),
        ActTrack(part: .crown, keys: [ActKey(at: 8, ease: .out, rotate: -17)], settle: .follow),
        ActTrack(
          part: .tail,
          keys: [ActKey(at: 5, ease: .swing, rotate: 6), ActKey(at: 10, ease: .out, rotate: -15)],
          settle: .follow),
      ])

  /// Defeated: a take (he stretches up, eyes wide, brows high, the crown hopping), a held beat
  /// while it sinks in, then the slump. The eyes shut and the face swaps while they're closed;
  /// they open slowly, sad and looking down. The body sinks past its slumped pose and settles with
  /// a sigh; the arms drop a frame apart, the tail wilts and the crown slides over his brow last,
  /// so nothing stops at the same time. A drop of sweat runs down at the end.
  private static let defeatAct = CharacterAct<TricksterExpression>(
    frames: 42, swapAt: 10, to: .defeated,
    tracks: [
      ActTrack(
        part: .body,
        keys: [
          ActKey(at: 4, ease: .out, rotate: -1.5, scale: [0.95, 1.08]),
          ActKey(at: 9, rotate: -1.5, scale: [0.96, 1.065]),
          ActKey(at: 20, ease: .swing, rotate: 6, scale: [1.05, 0.91]),
          ActKey(at: 27, ease: .spring, rotate: 5, scale: [1.03, 0.95]),
          ActKey(at: 32, ease: .swing, rotate: 5, scale: [1.04, 0.935]),
          ActKey(at: 38, ease: .swing, rotate: 5, scale: [1.03, 0.95]),
        ], settle: .swing)
    ]
      + eyes(
        [
          ActKey(at: 4, ease: .out, scale: [1.2, 1.2]), ActKey(at: 8, scale: [1.15, 1.15]),
          ActKey(at: 10, ease: .accelerate, scale: [1, 0.12]), ActKey(at: 13, scale: [1, 0.12]),
          ActKey(at: 21, ease: .swing, scale: [1, 1]),
        ], settle: .out)
      + [
        ActTrack(
          part: .browLeft,
          keys: [
            ActKey(at: 4, ease: .out, translate: [0, -4.5]), ActKey(at: 9, translate: [0, -4]),
            ActKey(at: 10, ease: .hold, translate: [0, -1]),
            ActKey(at: 22, ease: .swing, translate: [0, 0.5]),
          ], settle: .spring),
        ActTrack(
          part: .browRight,
          keys: [
            ActKey(at: 4, ease: .out, translate: [0, -5]), ActKey(at: 9, translate: [0, -4.5]),
            ActKey(at: 10, ease: .hold, translate: [0, -1]),
            ActKey(at: 22, ease: .swing, translate: [0, 0.5]),
          ], settle: .spring),
        ActTrack(
          part: .mouth,
          keys: [
            ActKey(at: 4, ease: .out, scale: [0.85, 1.2]),
            ActKey(at: 10, ease: .hold, scale: [0.6, 0.6]),
            ActKey(at: 19, ease: .swing, scale: [1.05, 1.1]),
          ], settle: .spring),
        ActTrack(
          part: .armLeft,
          keys: [
            ActKey(at: 4, ease: .out, rotate: 14), ActKey(at: 12, rotate: 10),
            ActKey(at: 22, ease: .swing, rotate: -28),
          ], settle: .spring),
        ActTrack(
          part: .armRight,
          keys: [
            ActKey(at: 5, ease: .out, rotate: -14), ActKey(at: 13, rotate: -10),
            ActKey(at: 24, ease: .swing, rotate: 28),
          ], settle: .spring),
        ActTrack(
          part: .tail,
          keys: [
            ActKey(at: 4, ease: .out, rotate: -10), ActKey(at: 14, ease: .swing, rotate: -5),
            ActKey(at: 26, ease: .swing, rotate: 22),
          ], settle: .follow),
        ActTrack(
          part: .crown,
          keys: [
            ActKey(at: 4, ease: .out, rotate: -14, translate: [0, -4]),
            ActKey(at: 12, ease: .swing, rotate: -11, translate: [0, -2]),
            ActKey(at: 27, ease: .accelerate, rotate: -24, translate: [-4, 10]),
          ], settle: .follow),
        ActTrack(
          part: .sweat,
          keys: [
            ActKey(at: 0, opacity: 0, translate: [0, -4]),
            ActKey(at: 28, opacity: 0, translate: [0, -4]),
            ActKey(at: 31, ease: .out, opacity: 1),
          ], settle: .swing),
      ])
}
