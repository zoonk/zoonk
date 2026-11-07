import Foundation

/// What a completion result says about a certificate it earned: enough to word its moment while
/// its pictures load.
struct CertificateFacts: Decodable, Hashable, Identifiable, Sendable {
  let code: String
  /// The live profile name; nil until the learner gives one.
  let recipientName: String?
  /// The learner's calendar day it was earned, `YYYY-MM-DD`.
  let completedOn: String
  /// The course's title, as written.
  let title: String
  /// The course level it certifies; nil for a plan certified whole.
  let courseLevel: CourseLevel?
  /// A language course level's CEFR levels, such as "B1–B2"; nil otherwise.
  let cefrRange: String?
  /// The course's chapters, in plan order.
  let topics: [String]
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
  /// A language goal's flag, as the API names it (`us`, `es-ct`); nil for other goals.
  var languageFlag: String?
  /// The plan's share of lessons done, 0 to 1.
  let progress: Double
}

extension CourseLevel {
  /// Main's `useCertificateLevel`: the level's name, with the CEFR levels a language course's level
  /// covers, such as "Intermediate (B1–B2)".
  func certifiedTitle(cefrRange: String?) -> String {
    let name = String(localized: localizedTitle)

    guard let cefrRange else {
      return name
    }

    return String(
      localized: "\(name) (\(cefrRange))", table: "Certificates",
      comment:
        "A language course's level with the CEFR levels it covers, such as Intermediate (B1–B2)")
  }
}

extension CertificateFacts {
  /// The certificate pictures are A4 landscape.
  static let aspectRatio: CGFloat = 297 / 210

  /// The level it certifies, such as "Beginner" or "Intermediate (B1–B2)"; nil for a plan's.
  var levelName: String? {
    courseLevel?.certifiedTitle(cefrRange: cefrRange)
  }

  /// Main's `useCertificateName`: the course's title with the level it certifies, such as
  /// "Python · Beginner" or "Italian · Intermediate (B1–B2)", or the title alone for a plan's.
  var name: String {
    guard let levelName else {
      return title
    }

    return String(
      localized: "\(title) · \(levelName)", table: "Certificates",
      comment:
        "A course level certificate's name: the course, then its level, such as Python · Beginner"
    )
  }

  var kindName: String {
    String(
      localized: "Certificate of completion", table: "Certificates",
      comment: "The kind of certificate earned by finishing a course's level or a plan")
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
    if let recipientName {
      return String(
        localized: "\(recipientName) completed \(name)", table: "Certificates",
        comment:
          "A course certificate read aloud: the learner's name, then the course or its level, such as Python · Beginner"
      )
    }

    return String(
      localized: "\(name), completed on Zoonk", table: "Certificates",
      comment:
        "A course certificate's heading before the learner gives a name: the course or its level, such as Python · Beginner"
    )
  }

  /// "October 28, 2026".
  var completedOnLong: String {
    completedOnText(.studyDay.year().month(.wide).day())
  }

  /// What the page's heading says with its date, for VoiceOver on the picture.
  var spokenTitle: String {
    [sentence, completedOnLong].joined(separator: ", ")
  }

  /// The day it was earned is a calendar day, so it's formatted in UTC.
  private func completedOnText(_ style: Date.FormatStyle) -> String {
    studyDate(completedOn)?.formatted(style) ?? completedOn
  }
}
