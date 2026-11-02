import SwiftUI

typealias BuddyKind = Components.Schemas.Buddy.KindPayload
typealias BuddyGlasses = Components.Schemas.Buddy.GlassesPayload

/// Growth and glow are always derived from the belt and Energy, so buddies never need an economy of
/// their own.
struct BuddyLook: Equatable, Sendable {
  var kind: BuddyKind = .zu
  var glasses: BuddyGlasses = .round
  var belt: ProgressBelt = .white
  /// Nil before the learner has any Energy: awake, without a glow.
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

  var glow: Double {
    energy.map { min(1, max(0, $0 / 100)) } ?? 0
  }

  var everydayExpression: BuddyExpression {
    switch energyState {
    case .napping: .sleepy
    case .awake: .happy
    case .glowing: .cheer
    }
  }

  /// Drawn grown before the learner's belt is read again.
  func grown(to stage: BuddyStage) -> BuddyLook {
    guard self.stage < stage,
      let belt = ProgressBelt.allCases.first(where: { BuddyStage(belt: $0) == stage })
    else { return self }

    var grown = self
    grown.belt = belt
    return grown
  }
}

/// Brain Power only goes up, so belts never regress and neither does the buddy.
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

  var scale: Double {
    switch self {
    case .baby: 0.7
    case .young: 0.85
    case .adult: 1
    }
  }

  static func < (lhs: BuddyStage, rhs: BuddyStage) -> Bool { lhs.rawValue < rhs.rawValue }
}

enum BuddyEnergyState: Sendable {
  case napping, awake, glowing
}
