import Foundation

/// Mirrors main's `BUDDY_ACTS`. The eyes lead, the brows and mouth follow, then the head and the
/// arms, and the loose parts come last.
enum BuddyAct: CaseIterable, Hashable, Sendable {
  /// About 2 s after a reaction lands in a face with open eyes; never on a timer.
  case blink
  case glance
  case smile
  case cheer
  case surprise
  case proud

  var act: CharacterAct<BuddyExpression> {
    switch self {
    case .blink: Self.blinkAct
    case .glance: Self.glanceAct
    case .smile: Self.smileAct
    case .cheer: Self.cheerAct
    case .surprise: Self.surpriseAct
    case .proud: Self.proudAct
    }
  }

  /// The lids close fast and open slower, and the eyes shut all the way, as people blink (Trutoiu
  /// et al., 2011).
  private static func blinkKeys(from: Double) -> (eyes: [ActKey], lids: [ActKey]) {
    (
      eyes: [
        ActKey(at: from, scale: [1, 1]),
        ActKey(at: from + 2, ease: .accelerate, scale: [1, 0.1]),
        ActKey(at: from + 3, scale: [1, 0.1]),
        ActKey(at: from + 6, ease: .out, scale: [1, 1]),
      ],
      lids: [
        ActKey(at: from + 1.6, ease: .hold, opacity: 1),
        ActKey(at: from + 3.4, ease: .hold, opacity: 0),
      ]
    )
  }

  private static func both(
    _ part: (CharacterPart, CharacterPart), _ keys: [ActKey], settle: ActEase? = nil
  )
    -> [ActTrack]
  {
    let rest = part.0 == .lidLeft ? PartPose.hidden : .still
    return [
      ActTrack(part: part.0, keys: keys, rest: rest, settle: settle),
      ActTrack(part: part.1, keys: keys, rest: rest, settle: settle),
    ]
  }

  private static let eyes = (CharacterPart.eyeLeft, CharacterPart.eyeRight)
  private static let lids = (CharacterPart.lidLeft, CharacterPart.lidRight)
  private static let pupils = (CharacterPart.pupilLeft, CharacterPart.pupilRight)

  private static let blinkAct = CharacterAct<BuddyExpression>(
    frames: 6,
    tracks: both(eyes, blinkKeys(from: 0).eyes) + both(lids, blinkKeys(from: 0).lids))

  private static let glanceAct: CharacterAct<BuddyExpression> = {
    let antennaKeys = [
      ActKey(at: 3, rotate: 0), ActKey(at: 8, ease: .swing, rotate: -4),
      ActKey(at: 14, ease: .follow, rotate: 0), ActKey(at: 19, ease: .swing, rotate: 3),
    ]

    return CharacterAct(
      frames: 26,
      tracks: both(
        pupils,
        [
          ActKey(at: 2, ease: .out, translate: [2.6, -0.4]),
          ActKey(at: 14, translate: [2.6, -0.4]),
          ActKey(at: 16, ease: .out, translate: [0, 0]),
        ])
        + both(eyes, blinkKeys(from: 15).eyes) + both(lids, blinkKeys(from: 15).lids) + [
          ActTrack(
            part: .face,
            keys: [
              ActKey(at: 1, translate: [0, 0]), ActKey(at: 8, ease: .swing, translate: [1.4, 0]),
              ActKey(at: 15, translate: [1.4, 0]),
            ], settle: .swing),
          ActTrack(
            part: .head,
            keys: [
              ActKey(at: 1, rotate: 0), ActKey(at: 8, ease: .swing, rotate: 3),
              ActKey(at: 15, rotate: 3), ActKey(at: 22, ease: .swing, rotate: 0),
            ]),
          ActTrack(part: .antennaLeft, keys: antennaKeys, settle: .follow),
          ActTrack(
            part: .antennaRight,
            keys: [
              ActKey(at: 4, rotate: 0), ActKey(at: 9, ease: .swing, rotate: -3.5),
              ActKey(at: 15, ease: .follow, rotate: 0), ActKey(at: 20, ease: .swing, rotate: 2.5),
            ], settle: .follow),
          ActTrack(part: .antenna, keys: antennaKeys, settle: .follow),
        ])
  }()

  private static let smileAct = CharacterAct<BuddyExpression>(
    frames: 16, swapAt: 4, to: .happy,
    tracks: both(
      eyes,
      [ActKey(at: 3, ease: .swing, scale: [1, 0.86]), ActKey(at: 7, scale: [1, 0.9])],
      settle: .spring)
      + [
        ActTrack(
          part: .mouth,
          keys: [
            ActKey(at: 3, ease: .accelerate, scale: [1.12, 0.7]),
            ActKey(at: 4, ease: .hold, scale: [0.82, 1.2]),
            ActKey(at: 8, ease: .out, scale: [1.06, 0.96]),
          ], settle: .spring),
        ActTrack(
          part: .head,
          keys: [
            ActKey(at: 2, rotate: 0), ActKey(at: 7, ease: .swing, rotate: -2.5),
            ActKey(at: 11, rotate: -2.5),
          ], settle: .swing),
        ActTrack(
          part: .body, keys: [ActKey(at: 6, ease: .out, scale: [0.98, 1.025])], settle: .spring),
        ActTrack(
          part: .antennaLeft, keys: [ActKey(at: 7, ease: .out, rotate: -3)], settle: .follow),
        ActTrack(
          part: .antennaRight, keys: [ActKey(at: 8, ease: .out, rotate: 2.5)], settle: .follow),
        ActTrack(part: .antenna, keys: [ActKey(at: 7, ease: .out, rotate: -3)], settle: .follow),
      ])

  /// The arms swing one a frame behind the other and not as far, so they never mirror.
  private static let cheerAct = CharacterAct<BuddyExpression>(
    frames: 30, swapAt: 4, to: .cheer,
    tracks: [
      ActTrack(
        part: .body,
        keys: [
          ActKey(at: 4, ease: .accelerate, scale: [1.06, 0.88]),
          ActKey(at: 8, ease: .out, scale: [0.95, 1.08]),
          ActKey(at: 12, ease: .swing, scale: [1.03, 0.97]),
          ActKey(at: 16, ease: .swing, scale: [0.99, 1.01]),
        ], settle: .spring),
      ActTrack(
        part: .shadow,
        keys: [
          ActKey(at: 4, ease: .accelerate, scale: [1.08, 1]),
          ActKey(at: 8, ease: .out, scale: [0.94, 1]),
        ], settle: .spring),
    ]
      + both(
        eyes,
        [
          ActKey(at: 3, ease: .accelerate, scale: [1, 0.15]), ActKey(at: 5, scale: [1, 0.15]),
          ActKey(at: 8, ease: .out, scale: [1.06, 1.14]),
        ], settle: .spring)
      + [
        ActTrack(
          part: .mouth,
          keys: [
            ActKey(at: 3, ease: .accelerate, scale: [0.8, 0.6]),
            ActKey(at: 4, ease: .hold, scale: [0.5, 0.3]),
            ActKey(at: 8, ease: .out, scale: [1.12, 1.18]),
          ], settle: .spring),
        ActTrack(
          part: .armLeft,
          keys: [
            ActKey(at: 4, ease: .accelerate, rotate: -12), ActKey(at: 9, ease: .out, rotate: 96),
            ActKey(at: 13, ease: .swing, rotate: 80), ActKey(at: 17, ease: .swing, rotate: 90),
            ActKey(at: 20, rotate: 88),
          ], settle: .swing),
        ActTrack(
          part: .armRight,
          keys: [
            ActKey(at: 5, ease: .accelerate, rotate: 12), ActKey(at: 10, ease: .out, rotate: -88),
            ActKey(at: 14, ease: .swing, rotate: -74), ActKey(at: 18, ease: .swing, rotate: -84),
            ActKey(at: 21, rotate: -82),
          ], settle: .swing),
        ActTrack(
          part: .head,
          keys: [
            ActKey(at: 5, ease: .accelerate, rotate: 0), ActKey(at: 10, ease: .out, rotate: -3),
            ActKey(at: 18, ease: .swing, rotate: 2),
          ], settle: .swing),
        ActTrack(
          part: .antennaLeft,
          keys: [ActKey(at: 4, ease: .swing, rotate: 6), ActKey(at: 9, ease: .out, rotate: -16)],
          settle: .follow),
        ActTrack(
          part: .antennaRight,
          keys: [ActKey(at: 5, ease: .swing, rotate: -6), ActKey(at: 10, ease: .out, rotate: 15)],
          settle: .follow),
        ActTrack(
          part: .antenna,
          keys: [ActKey(at: 4, ease: .swing, rotate: 5), ActKey(at: 9, ease: .out, rotate: -14)],
          settle: .follow),
      ])

  private static let surpriseAct = CharacterAct<BuddyExpression>(
    frames: 22, swapAt: 3, to: .wow,
    tracks: [
      ActTrack(
        part: .body,
        keys: [
          ActKey(at: 2, ease: .accelerate, scale: [1.03, 0.95]),
          ActKey(at: 5, ease: .out, scale: [0.97, 1.06]),
        ], settle: .spring)
    ]
      + both(
        eyes,
        [
          ActKey(at: 2, ease: .accelerate, scale: [1, 0.8]),
          ActKey(at: 3, ease: .hold, scale: [0.9, 0.85]),
          ActKey(at: 6, ease: .out, scale: [1.12, 1.12]),
          ActKey(at: 11, ease: .spring, scale: [1, 1]), ActKey(at: 13, scale: [1, 1]),
          ActKey(at: 15, ease: .accelerate, scale: [1, 0.1]), ActKey(at: 16, scale: [1, 0.1]),
          ActKey(at: 19, ease: .out, scale: [1, 1]),
        ])
      + both(lids, blinkKeys(from: 13).lids)
      + [
        ActTrack(
          part: .mouth,
          keys: [
            ActKey(at: 3, ease: .hold, scale: [0.4, 0.4]),
            ActKey(at: 6, ease: .out, scale: [1.15, 1.15]),
          ], settle: .spring),
        ActTrack(part: .head, keys: [ActKey(at: 5, ease: .out, rotate: -2.5)], settle: .swing),
        ActTrack(part: .armLeft, keys: [ActKey(at: 5, ease: .out, rotate: 22)], settle: .swing),
        ActTrack(part: .armRight, keys: [ActKey(at: 6, ease: .out, rotate: -20)], settle: .swing),
        ActTrack(
          part: .antennaLeft, keys: [ActKey(at: 5, ease: .out, rotate: -14)], settle: .follow),
        ActTrack(
          part: .antennaRight, keys: [ActKey(at: 6, ease: .out, rotate: 13)], settle: .follow),
        ActTrack(part: .antenna, keys: [ActKey(at: 5, ease: .out, rotate: -12)], settle: .follow),
      ])

  private static let proudAct = CharacterAct<BuddyExpression>(
    frames: 24, swapAt: 5, to: .proud,
    tracks: both(
      eyes,
      [
        ActKey(at: 4, ease: .accelerate, scale: [1, 0.15]), ActKey(at: 6, scale: [1, 0.15]),
        ActKey(at: 10, ease: .out, scale: [1, 1]),
      ])
      + [
        ActTrack(
          part: .head,
          keys: [
            ActKey(at: 2, rotate: 0), ActKey(at: 10, ease: .swing, rotate: -4),
            ActKey(at: 17, rotate: -4),
          ], settle: .swing),
        ActTrack(
          part: .face,
          keys: [
            ActKey(at: 3, translate: [0, 0]), ActKey(at: 10, ease: .swing, translate: [0, -1.5]),
            ActKey(at: 17, translate: [0, -1.5]),
          ], settle: .swing),
        ActTrack(
          part: .body, keys: [ActKey(at: 9, ease: .out, scale: [0.98, 1.04])], settle: .spring),
        ActTrack(
          part: .browLeft,
          keys: [
            ActKey(at: 5, ease: .hold, translate: [0, 2.5]),
            ActKey(at: 11, ease: .out, translate: [0, -1.5]),
          ], settle: .spring),
        ActTrack(
          part: .browRight,
          keys: [
            ActKey(at: 5, ease: .hold, translate: [0, 2.5]),
            ActKey(at: 12, ease: .out, translate: [0, -1.5]),
          ], settle: .spring),
        ActTrack(
          part: .mouth,
          keys: [
            ActKey(at: 5, ease: .hold, scale: [0.8, 0.8]),
            ActKey(at: 10, ease: .out, scale: [1.06, 1]),
          ], settle: .spring),
        ActTrack(
          part: .antennaLeft, keys: [ActKey(at: 10, ease: .swing, rotate: 5)], settle: .follow),
        ActTrack(
          part: .antennaRight, keys: [ActKey(at: 11, ease: .swing, rotate: 4)], settle: .follow),
        ActTrack(part: .antenna, keys: [ActKey(at: 10, ease: .swing, rotate: 4)], settle: .follow),
        ActTrack(part: .armLeft, keys: [ActKey(at: 9, ease: .swing, rotate: -10)], settle: .swing),
        ActTrack(part: .armRight, keys: [ActKey(at: 10, ease: .swing, rotate: 9)], settle: .swing),
      ])
}
