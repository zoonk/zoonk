import Foundation

enum LearningInterestSuggestion: String, CaseIterable, Identifiable {
  case technology = "Technology"
  case sports = "Sports"
  case science = "Science"
  case fashion = "Fashion"
  case scienceFiction = "Science fiction"
  case photography = "Photography"
  case music = "Music"
  case cooking = "Cooking"

  var id: String { rawValue }

  var title: LocalizedStringResource {
    switch self {
    case .technology:
      LocalizedStringResource(
        "Technology", table: "Account", comment: "Suggested learning interest")
    case .sports:
      LocalizedStringResource("Sports", table: "Account", comment: "Suggested learning interest")
    case .science:
      LocalizedStringResource("Science", table: "Account", comment: "Suggested learning interest")
    case .fashion:
      LocalizedStringResource("Fashion", table: "Account", comment: "Suggested learning interest")
    case .scienceFiction:
      LocalizedStringResource(
        "Science fiction", table: "Account", comment: "Suggested learning interest")
    case .photography:
      LocalizedStringResource(
        "Photography", table: "Account", comment: "Suggested learning interest")
    case .music:
      LocalizedStringResource("Music", table: "Account", comment: "Suggested learning interest")
    case .cooking:
      LocalizedStringResource("Cooking", table: "Account", comment: "Suggested learning interest")
    }
  }

  var systemImage: String {
    switch self {
    case .technology: "desktopcomputer"
    case .sports: "figure.run"
    case .science: "atom"
    case .fashion: "tshirt"
    case .scienceFiction: "sparkles"
    case .photography: "camera"
    case .music: "music.note"
    case .cooking: "fork.knife"
    }
  }

  func matches(_ value: String) -> Bool {
    rawValue.caseInsensitiveCompare(value) == .orderedSame
  }
}
