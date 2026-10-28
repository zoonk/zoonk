import SwiftUI

/// In the order learners meet them.
let buddyKinds: [BuddyKind] = [.zu, .noodle, .beep, .otto]

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
    case .zu: Text("Curious alien", tableName: "Buddy", comment: "What the Zu buddy is")
    case .noodle: Text("Brain with legs", tableName: "Buddy", comment: "What the Noodle buddy is")
    case .beep: Text("Tidy robot", tableName: "Buddy", comment: "What the Beep buddy is")
    case .otto: Text("Know-it-all octopus", tableName: "Buddy", comment: "What the Otto buddy is")
    }
  }
}

extension BuddyStatus.StagePayload {
  var name: Text {
    switch self {
    case .baby: Text("Baby", tableName: "Buddy", comment: "The buddy's first stage")
    case .young: Text("Young", tableName: "Buddy", comment: "The buddy's second stage")
    case .adult: Text("Adult", tableName: "Buddy", comment: "The buddy's grown stage")
    }
  }
}

extension Components.Schemas.GlassesProgress.GlassesPayload {
  var name: Text {
    switch self {
    case .round: Text("Round", tableName: "Buddy", comment: "A pair of the buddy's glasses")
    case .star: Text("Star", tableName: "Buddy", comment: "A pair of the buddy's glasses")
    case .aviator: Text("Aviator", tableName: "Buddy", comment: "A pair of the buddy's glasses")
    case .catEye: Text("Cat-eye", tableName: "Buddy", comment: "A pair of the buddy's glasses")
    case .retro: Text("Retro", tableName: "Buddy", comment: "A pair of the buddy's glasses")
    case .monocle: Text("Monocle", tableName: "Buddy", comment: "A monocle the buddy can wear")
    }
  }

  var howToEarn: Text {
    switch self {
    case .round:
      Text("Comes with your buddy", tableName: "Buddy", comment: "How the round glasses are earned")
    case .star:
      Text(
        "Win your first phase challenge", tableName: "Buddy",
        comment: "How the star glasses are earned")
    case .aviator:
      Text(
        "Finish your first weekly challenge", tableName: "Buddy",
        comment: "How the aviator glasses are earned")
    case .catEye:
      Text(
        "Finish every mission on 7 different days", tableName: "Buddy",
        comment: "How the cat-eye glasses are earned")
    case .retro:
      Text("Finish 50 reviews", tableName: "Buddy", comment: "How the retro glasses are earned")
    case .monocle:
      Text("Win the final challenge", tableName: "Buddy", comment: "How the monocle is earned")
    }
  }

  var worn: BuddyGlasses {
    BuddyGlasses(rawValue: rawValue) ?? .round
  }
}

extension BuddyStatus {
  var choice: BuddyChoice {
    BuddyChoice(kind: buddy.kind, name: buddy.name, glasses: buddy.glasses)
  }

  var growthLine: Text {
    guard let next = nextStage, let belt = ProgressBelt(rawValue: next.belt) else {
      return Text("Fully grown", tableName: "Buddy", comment: "The buddy reached its last stage")
    }

    let beltName = String(localized: belt.localizedTitle)

    return switch next.stage {
    case .adult:
      Text(
        "Grows to Adult at \(beltName)", tableName: "Buddy",
        comment: "The buddy's next stage; the argument is a belt")
    case .baby, .young:
      Text(
        "Grows to Young at \(beltName)", tableName: "Buddy",
        comment: "The buddy's next stage; the argument is a belt")
    }
  }

  func energyLine(name: String) -> Text {
    if energy.state == .napping {
      return Text(
        "\(name) took a nap. Anything you learn wakes it up.", tableName: "Buddy",
        comment: "The buddy naps; the argument is its name")
    }

    return energy.studiedToday
      ? Text(
        "You studied today, so Energy won't drop.", tableName: "Buddy",
        comment: "Energy holds today")
      : Text(
        "Studying today keeps Energy up.", tableName: "Buddy",
        comment: "Energy drops without studying today")
  }

  var earnedGlasses: Int {
    glasses.filter(\.earned).count
  }
}

extension BuddyChoice {
  /// Each language has its own playful buddy names, kept in the style guides' glossaries.
  var displayName: String {
    buddyName(kind: kind, name: name)
  }
}

extension BuddyGlasses {
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

extension BuddyStage {
  var name: Text {
    switch self {
    case .baby: Text("Baby", tableName: "Settings", comment: "The buddy's first growth stage")
    case .young: Text("Young", tableName: "Settings", comment: "The buddy's second growth stage")
    case .adult: Text("Adult", tableName: "Settings", comment: "The buddy's last growth stage")
    }
  }
}

func buddyName(kind: BuddyKind, name: String?) -> String {
  if let name, !name.isEmpty {
    return name
  }

  return kind.name
}
