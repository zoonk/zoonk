import SwiftUI

typealias BuddyKind = Components.Schemas.Buddy.KindPayload
typealias BuddyGlasses = Components.Schemas.Buddy.GlassesPayload

/// The learner's buddy as every screen draws it (main's `@zoonk/utils/buddy`): which buddy, the
/// glasses it wears, the belt that grows it and the Energy that wakes it. Growth and glow are
/// always derived from the belt and Energy, so buddies never need an economy of their own.
struct BuddyLook: Equatable, Sendable {
  var kind: BuddyKind = .zu
  var glasses: BuddyGlasses = .round
  var belt: ProgressBelt = .white
  /// Nil before the learner has any Energy: the buddy just met them, awake, without a glow.
  var energy: Double?
  /// Learning wakes the buddy: on a day with study it never naps, even while Energy is low.
  var studiedToday = false

  var stage: BuddyStage { BuddyStage(belt: belt) }

  var energyState: BuddyEnergyState {
    guard let energy else { return .awake }

    if energy >= 80 {
      return .glowing
    }

    return energy < 30 && !studiedToday ? .napping : .awake
  }

  /// Energy (0–100) as the strength of the orange glow on Zu's and Beep's antenna lights; none
  /// before any Energy. The other buddies wear no light.
  var glow: Double {
    energy.map { min(1, max(0, $0 / 100)) } ?? 0
  }

  /// Its everyday face, from its Energy: sleepy while it naps, happy awake, beaming once it glows.
  var everydayExpression: BuddyExpression {
    switch energyState {
    case .napping: .sleepy
    case .awake: .happy
    case .glowing: .cheer
    }
  }

  /// The buddy at a stage a milestone just reached, drawn grown even before the learner's belt is
  /// read again: the first belt of that stage when its own belt is from an earlier one.
  func grown(to stage: BuddyStage) -> BuddyLook {
    guard self.stage < stage,
      let belt = ProgressBelt.allCases.first(where: { BuddyStage(belt: $0) == stage })
    else { return self }

    var grown = self
    grown.belt = belt
    return grown
  }
}

/// Buddies grow with the belts. Brain Power only goes up, so belts never regress and neither does
/// the buddy: each group of belts maps to one stage.
enum BuddyStage: Int, Comparable, Sendable {
  case baby, young, adult

  init(belt: ProgressBelt) {
    switch belt {
    case .white, .yellow: self = .baby
    case .orange, .green: self = .young
    case .blue, .purple, .brown, .red, .gray, .black: self = .adult
    }
  }

  init?(key: String) {
    switch key {
    case "baby": self = .baby
    case "young": self = .young
    case "adult": self = .adult
    default: return nil
    }
  }

  /// 70% as a baby, 85% young, full size as an adult.
  var scale: Double {
    switch self {
    case .baby: 0.7
    case .young: 0.85
    case .adult: 1
    }
  }

  static func < (lhs: BuddyStage, rhs: BuddyStage) -> Bool { lhs.rawValue < rhs.rawValue }
}

/// Below 30 Energy the buddy naps (unless the learner studied today), from 80 it glows.
enum BuddyEnergyState: Sendable {
  case napping, awake, glowing
}
