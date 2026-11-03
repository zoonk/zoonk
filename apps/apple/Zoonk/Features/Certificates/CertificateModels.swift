import Foundation

/// What a completion result says about a certificate it earned: enough to word its moment while
/// its pictures load.
struct CertificateFacts: Decodable, Hashable, Identifiable, Sendable {
  enum Kind: String, Decodable, Sendable {
    case course
    case languageLevel
    case placement
  }

  let code: String
  let kind: Kind
  /// The live profile name; nil until the learner gives one.
  let recipientName: String?
  /// The learner's calendar day it was earned, `YYYY-MM-DD`.
  let completedOn: String
  let title: String?
  let targetLanguage: String?
  let level: String?
  let lessonsStudied: Int?
  /// About how long the studied lessons take; nil when unknown.
  let minutes: Int?

  var id: String { code }
}

/// A certificate with its public page and pictures, from `GET /certificates/{code}` or the
/// learner's list.
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

extension LearnerSummary {
  /// The active goals that can still earn a certificate. Main also waits for a course plan's first
  /// lesson, a count the summary doesn't carry.
  var certificateGoals: [LearnerGoal] {
    goals.filter { $0.status == .active && $0.kind != .explain }
  }
}

extension CertificateFacts {
  /// The certificate pictures are A4 landscape.
  static let aspectRatio: CGFloat = 297 / 210

  /// Main's list name: a course's title, or the language and level, such as "Spanish B1".
  var name: String {
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
    switch kind {
    case .course, .languageLevel:
      String(
        localized: "Certificate of completion", table: "Certificates",
        comment: "The kind of certificate earned by finishing a course or a language level")
    case .placement:
      String(
        localized: "Placement result", table: "Certificates",
        comment: "The kind of certificate a language placement test gives")
    }
  }

  /// "Certificate of completion · Nov 3, 2026".
  /// A wrapped line breaks before the date, never inside it.
  var summary: String {
    let date = completedOnText(.studyDay.year().month(.abbreviated).day())
    return [kindName, date.replacingOccurrences(of: " ", with: "\u{00A0}")].joinedFacts()
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

  /// What the page's heading says, for VoiceOver on the picture.
  var spokenTitle: String {
    let date = completedOnText(.studyDay.year().month(.wide).day())

    guard let name = recipientName else {
      return [kindName, self.name, date].joined(separator: ", ")
    }

    let sentence =
      switch kind {
      case .course:
        String(
          localized: "\(name) completed \(title ?? "")", table: "Certificates",
          comment: "A course certificate read aloud: the learner's name, then the course")
      case .languageLevel:
        String(
          localized: "\(name) completed level \(level ?? "") in \(languageName)",
          table: "Certificates",
          comment:
            "A language level certificate read aloud: the learner's name, the level, the language")
      case .placement:
        String(
          localized: "Placement result for \(name): \(languageTitle) \(level ?? "")",
          table: "Certificates",
          comment: "A placement certificate read aloud: the learner's name, the language and level")
      }

    return [sentence, date].joined(separator: ", ")
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
