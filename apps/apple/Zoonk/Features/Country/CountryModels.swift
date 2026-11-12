import Foundation

/// A country as core names it, in the language of whatever asked for it.
struct CountryChoice: Decodable, Equatable, Hashable, Identifiable, Sendable {
  let code: String
  let name: String
  /// Where the learner says they live.
  var isHome = false
  /// The lessons' own variety when it isn't the one this country speaks, such as Portuguese (Brazil)
  /// for Portugal; core decides it.
  var lessonVariety: LessonVariety?

  var id: String { code }

  private enum CodingKeys: String, CodingKey {
    case code, name, tag, lessonVariety
  }

  init(code: String, name: String, isHome: Bool = false, lessonVariety: LessonVariety? = nil) {
    self.code = code
    self.name = name
    self.isHome = isHome
    self.lessonVariety = lessonVariety
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    code = try container.decode(String.self, forKey: .code)
    name = try container.decode(String.self, forKey: .name)
    isHome = try container.decodeIfPresent(String.self, forKey: .tag) == "home"
    lessonVariety = try container.decodeIfPresent(LessonVariety.self, forKey: .lessonVariety)
  }
}

struct LessonVariety: Codable, Equatable, Hashable, Sendable {
  let language: String
  let region: String

  /// Named in its own language, as core names the countries beside it: the goal's.
  var name: String {
    Locale(identifier: language).varietyName(language: language, region: region)
  }
}

/// The country a goal's or a course's content is about, or an exam's country.
struct ContentCountry: Codable, Equatable, Sendable {
  let code: String
  let name: String
  let kind: Kind
  let editable: Bool
  let source: Source
  let lessonVariety: LessonVariety?
  var rebuild: Rebuild

  enum Kind: String, Codable, Sendable {
    case content
    case exam
  }

  enum Source: String, Codable, Sendable {
    case said
    case home
    case picked
    case `default`
  }

  enum Rebuild: String, Codable, Sendable {
    case none
    case preparing
    case failed
  }
}

extension ContentCountry {
  /// The generated row's `allOf` wrapper, whichever schema it came in.
  init?(_ payload: (some Encodable)?) {
    guard let payload, let row = try? PracticeJSON.recode(payload, as: ContentCountry.self) else {
      return nil
    }

    self = row
  }
}

extension [CountryChoice] {
  /// Core's suggestions, whichever schema they came in; one that doesn't read is left out.
  init(suggested: [some Encodable]) {
    self = suggested.compactMap { try? PracticeJSON.recode($0, as: CountryChoice.self) }
  }
}

extension CountryChoice {
  init?(_ payload: (some Encodable)?) {
    guard let payload, let choice = try? PracticeJSON.recode(payload, as: CountryChoice.self)
    else {
      return nil
    }

    self = choice
  }
}

/// "Content country: Portugal", for a line that names it.
func contentCountryLine(_ name: String) -> String {
  String(
    localized: "Content country: \(name)", table: "Plan",
    comment:
      "A line naming the country a course or a goal's lessons are about; the argument is a country's name, such as Portugal"
  )
}

/// "Lesson language: Portuguese (Brazil)", under a country whose own variety the lessons don't use.
func lessonLanguageLine(_ variety: LessonVariety) -> String {
  String(
    localized: "Lesson language: \(variety.name)", table: "Plan",
    comment:
      "Under a country whose lessons are written in another variety of the language; the argument is a language with its country, such as Portuguese (Brazil)"
  )
}

/// Main's search: case and accents don't matter, and the text matches from the start of any word,
/// so "uni" finds both Estados Unidos and Reino Unido.
func countryMatches(_ name: String, query: String, locale: Locale = .current) -> Bool {
  let options: String.CompareOptions = [.caseInsensitive, .diacriticInsensitive]
  let folded = name.folding(options: options, locale: locale)
  let wanted = query.trimmingCharacters(in: .whitespaces).folding(options: options, locale: locale)

  guard !wanted.isEmpty else {
    return true
  }

  var index = folded.startIndex

  while index < folded.endIndex {
    let startsWord =
      index == folded.startIndex || !folded[folded.index(before: index)].isLetter
    if startsWord, folded[index...].hasPrefix(wanted) {
      return true
    }

    index = folded.index(after: index)
  }

  return false
}
