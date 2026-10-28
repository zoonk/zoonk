import SwiftUI

extension BuddyChoice {
  /// The learner's own name for the buddy, else the buddy's name in the app's language (each
  /// language has its own playful one, kept in the style guides' glossaries).
  var displayName: String {
    if let name, !name.isEmpty {
      return name
    }

    return kind.name
  }
}

extension BuddyKind {
  var name: String {
    switch self {
    case .zu:
      String(localized: "Zu", table: "Settings", comment: "Name of the alien study buddy")
    case .noodle:
      String(
        localized: "Noodle", table: "Settings",
        comment: "Playful name of the brain-with-legs study buddy; each language has its own")
    case .beep:
      String(localized: "Beep", table: "Settings", comment: "Name of the robot study buddy")
    case .otto:
      String(localized: "Otto", table: "Settings", comment: "Name of the octopus study buddy")
    }
  }

  var tagline: Text {
    switch self {
    case .zu:
      Text("Curious alien", tableName: "Settings", comment: "Short description of the buddy Zu")
    case .noodle:
      Text(
        "Brain with legs", tableName: "Settings", comment: "Short description of the buddy Noodle")
    case .beep:
      Text("Tidy robot", tableName: "Settings", comment: "Short description of the buddy Beep")
    case .otto:
      Text(
        "Know-it-all octopus", tableName: "Settings",
        comment: "Short description of the buddy Otto")
    }
  }
}

extension BuddyGlasses {
  /// The pair's name, as the picker lists it.
  var name: Text {
    switch self {
    case .round: Text("Round", tableName: "Settings", comment: "Buddy glasses: round frames")
    case .star: Text("Star", tableName: "Settings", comment: "Buddy glasses: star-shaped frames")
    case .aviator: Text("Aviator", tableName: "Settings", comment: "Buddy glasses: aviators")
    case .catEye: Text("Cat-eye", tableName: "Settings", comment: "Buddy glasses: cat-eye frames")
    case .retro: Text("Retro", tableName: "Settings", comment: "Buddy glasses: retro frames")
    case .monocle: Text("Monocle", tableName: "Settings", comment: "Buddy glasses: a monocle")
    }
  }

  /// What the buddy wears, as a phrase that stands on its own after its stage ("Baby · Round
  /// glasses").
  var worn: Text {
    switch self {
    case .round:
      Text("Round glasses", tableName: "Settings", comment: "What the buddy wears: round glasses")
    case .star:
      Text("Star glasses", tableName: "Settings", comment: "What the buddy wears: star glasses")
    case .aviator:
      Text("Aviator glasses", tableName: "Settings", comment: "What the buddy wears: aviators")
    case .catEye:
      Text("Cat-eye glasses", tableName: "Settings", comment: "What the buddy wears: cat-eye")
    case .retro:
      Text("Retro glasses", tableName: "Settings", comment: "What the buddy wears: retro glasses")
    case .monocle:
      Text("A monocle", tableName: "Settings", comment: "What the buddy wears: a monocle")
    }
  }

  /// Every pair says upfront how it's earned: nothing is random and nothing is sold.
  var howToEarn: Text {
    switch self {
    case .round:
      Text(
        "Comes with your buddy", tableName: "Settings",
        comment: "How the round glasses are earned")
    case .star:
      Text(
        "Win your first phase challenge", tableName: "Settings",
        comment: "How the star glasses are earned")
    case .aviator:
      Text(
        "Finish your first weekly challenge", tableName: "Settings",
        comment: "How the aviator glasses are earned")
    case .catEye:
      Text(
        "Finish every mission on 7 different days", tableName: "Settings",
        comment: "How the cat-eye glasses are earned")
    case .retro:
      Text("Finish 50 reviews", tableName: "Settings", comment: "How the retro glasses are earned")
    case .monocle:
      Text(
        "Win the final challenge", tableName: "Settings", comment: "How the monocle is earned")
    }
  }
}

/// The buddy's stage, from the learner's belt: Brain Power only goes up, so the buddy only grows.
enum BuddyStage {
  case baby
  case young
  case adult

  init(belt: String?) {
    switch belt {
    case "green", "orange": self = .young
    case "blue", "purple", "brown", "red", "gray", "black": self = .adult
    default: self = .baby
    }
  }

  var name: Text {
    switch self {
    case .baby: Text("Baby", tableName: "Settings", comment: "The buddy's first growth stage")
    case .young: Text("Young", tableName: "Settings", comment: "The buddy's second growth stage")
    case .adult: Text("Adult", tableName: "Settings", comment: "The buddy's last growth stage")
    }
  }
}
