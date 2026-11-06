import Foundation

/// What a completion result says about a certificate it earned: enough to word its moment while
/// its pictures load.
struct CertificateFacts: Decodable, Hashable, Identifiable, Sendable {
  enum Kind: String, Decodable, Sendable {
    case course
    case languageLevel
  }

  let code: String
  let kind: Kind
  /// The live profile name; nil until the learner gives one.
  let recipientName: String?
  /// The learner's calendar day it was earned, `YYYY-MM-DD`.
  let completedOn: String
  let title: String?
  /// The course level it certifies; nil for a plan certified whole and for language levels.
  let courseLevel: CourseLevel?
  let targetLanguage: String?
  let level: String?
  /// A course's chapters, in plan order.
  let topics: [String]
  /// A language level's: what the learner can do.
  let canDo: [String]
  let lessonsStudied: Int?
  let lessonsTestedOut: Int?
  /// About how long the studied lessons take; nil when unknown.
  let minutes: Int?
  /// Earned without Plus: no picture, link, code or share until the learner subscribes.
  let locked: Bool

  var id: String { code }
}

/// One of the learner's certificates. The public read refuses a locked one, so screens read the
/// learner's own list.
enum OwnedCertificate: Decodable, Hashable, Identifiable, Sendable {
  case issued(Certificate)
  case locked(CertificateFacts)

  init(from decoder: any Decoder) throws {
    let facts = try CertificateFacts(from: decoder)
    self = facts.locked ? .locked(facts) : .issued(try Certificate(from: decoder))
  }

  var facts: CertificateFacts {
    switch self {
    case .issued(let certificate): certificate.facts
    case .locked(let facts): facts
    }
  }

  var issued: Certificate? {
    if case .issued(let certificate) = self { certificate } else { nil }
  }

  var id: String { facts.code }
}

/// An issued certificate with its public page and pictures.
struct Certificate: Decodable, Hashable, Identifiable, Sendable {
  struct Pictures: Decodable, Hashable, Sendable {
    /// The certificate itself, as screens show it.
    let screen: URL
    /// The same drawing at print size, for print and saving.
    let print: URL
    /// The picture a shared link unfurls with.
    let link: URL
    /// The picture a post uploads.
    let post: URL
  }

  let facts: CertificateFacts
  let url: URL
  let pictures: Pictures
  let linkedInURL: URL

  var id: String { facts.code }

  /// Main's `getCertificateDisplayUrl`: the page's address without its scheme.
  var shownURL: String {
    let host = (url.host() ?? "").replacing(/^www\./, with: "")
    return "\(host)\(url.port.map { ":\($0)" } ?? "")\(url.path())"
  }

  private enum CodingKeys: String, CodingKey {
    case imageUrls
    case linkedInUrl
    case url
  }

  init(from decoder: any Decoder) throws {
    facts = try CertificateFacts(from: decoder)
    let container = try decoder.container(keyedBy: CodingKeys.self)
    url = try container.decode(URL.self, forKey: .url)
    pictures = try container.decode(Pictures.self, forKey: .imageUrls)
    linkedInURL = try container.decode(URL.self, forKey: .linkedInUrl)
  }
}

/// A goal that can still earn a certificate.
struct CertificateUpNext: Equatable, Identifiable, Sendable {
  let id: String
  let title: String
  /// A language goal's language, whose flag marks it.
  var targetLanguage: String?
  /// The plan's share of lessons done, 0 to 1; nil for a language, which earns one by levels.
  let progress: Double?
}

extension CertificateFacts {
  /// The certificate pictures are A4 landscape.
  static let aspectRatio: CGFloat = 297 / 210

  /// Main's list name: a course's title with the level it certifies, such as "Python · Beginner",
  /// or the language and level, such as "Spanish B1".
  var name: String {
    if let title, let courseLevel {
      return String(
        localized: "\(title) · \(String(localized: courseLevel.localizedTitle))",
        table: "Certificates",
        comment:
          "A course level certificate's name: the course, then its level, such as Python · Beginner"
      )
    }

    if let title {
      return title
    }

    return String(
      localized: "\(languageTitle) \(level ?? "")", table: "Certificates",
      comment:
        "A language certificate's name: the language, then its CEFR level, such as Spanish B1"
    )
  }

  var kindName: String {
    String(
      localized: "Certificate of completion", table: "Certificates",
      comment: "The kind of certificate earned by finishing a course or a language level")
  }

  /// "Certificate of completion · Nov 3, 2026".
  /// A wrapped line breaks before the date, never inside it.
  var summary: String {
    [kindName, completedOnDay.replacingOccurrences(of: " ", with: "\u{00A0}")].joinedFacts()
  }

  /// "Nov 3, 2026".
  var completedOnDay: String {
    completedOnText(.studyDay.year().month(.abbreviated).day())
  }

  /// LinkedIn's issue date: "November 2026".
  var issueMonth: String {
    completedOnText(.studyDay.year().month(.wide))
  }

  /// "K7QF-2M9X-HD4P", as the certificate prints it.
  var groupedCode: String {
    stride(from: 0, to: code.count, by: 4).map { start in
      let from = code.index(code.startIndex, offsetBy: start)
      let to = code.index(from, offsetBy: 4, limitedBy: code.endIndex) ?? code.endIndex
      return String(code[from..<to])
    }
    .joined(separator: "-")
  }

  /// Main's `useCertificateSentence`: the page's heading.
  var sentence: String {
    switch (kind, recipientName) {
    case (.course, let name?):
      String(
        localized: "\(name) completed \(self.name)", table: "Certificates",
        comment:
          "A course certificate read aloud: the learner's name, then the course or its level, such as Python · Beginner"
      )
    case (.course, nil):
      String(
        localized: "\(self.name), completed on Zoonk", table: "Certificates",
        comment:
          "A course certificate's heading before the learner gives a name: the course or its level, such as Python · Beginner"
      )
    case (.languageLevel, let name?):
      String(
        localized: "\(name) completed level \(level ?? "") in \(languageName)",
        table: "Certificates",
        comment:
          "A language level certificate read aloud: the learner's name, the level, the language")
    case (.languageLevel, nil):
      String(
        localized: "Level \(level ?? "") in \(languageName), completed on Zoonk",
        table: "Certificates",
        comment:
          "A language level certificate's heading before the learner gives a name: the level, then the language"
      )
    }
  }

  /// "October 28, 2026".
  var completedOnLong: String {
    completedOnText(.studyDay.year().month(.wide).day())
  }

  /// What the page's heading says with its date, for VoiceOver on the picture.
  var spokenTitle: String {
    [sentence, completedOnLong].joined(separator: ", ")
  }

  var languageName: String {
    targetLanguage.map { Locale.current.languageName($0) } ?? ""
  }

  var languageTitle: String {
    targetLanguage.map { Locale.current.languageTitle($0) } ?? ""
  }

  /// The day it was earned is a calendar day, so it's formatted in UTC.
  private func completedOnText(_ style: Date.FormatStyle) -> String {
    studyDate(completedOn)?.formatted(style) ?? completedOn
  }
}
