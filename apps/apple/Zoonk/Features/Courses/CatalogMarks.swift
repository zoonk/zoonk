import SwiftUI

extension CourseCategory {
  /// From the design system's subject table.
  var hue: Color {
    switch self {
    case .health: .pink
    case .languages: .red
    case .history: .orange
    case .culture: .brown
    case .business, .law: .yellow
    case .economics, .society: .green
    case .geography: .mint
    case .science: .teal
    case .math: .cyan
    case .communication, .engineering, .tech: .blue
    case .exams: .indigo
    case .arts: .purple
    }
  }
}

struct SubjectGlyph: View {
  let subject: CourseCategory?

  var body: some View {
    Image(systemName: "square.fill")
      .imageScale(.small)
      .foregroundStyle(subject?.hue ?? .indigo)
      .accessibilityHidden(true)
  }
}

/// The subject's color goes on the glyph beside the words, never on them.
struct CourseSubjectLabel: View {
  let subject: CourseCategory

  var body: some View {
    HStack(spacing: 4) {
      SubjectGlyph(subject: subject)
      Text(subject.localizedTitle)
    }
    .chip()
  }
}

struct CourseMark: View {
  let imageURL: URL?
  let languageFlag: String?
  let targetLanguage: String?

  @ScaledMetric(relativeTo: .body) private var size = 40

  var body: some View {
    if let flag = languageFlag.flatMap(flagEmoji) {
      Text(flag)
        .font(.largeTitle)
        .minimumScaleFactor(0.5)
        .frame(width: size, height: size)
        .accessibilityLabel(Text(flagLabel))
    } else {
      CourseArtwork(imageURL: imageURL, cornerRadius: 8)
        .frame(width: size, height: size)
    }
  }

  private var flagLabel: String {
    guard let targetLanguage, let languageFlag else {
      return ""
    }

    let base =
      Locale.Language(identifier: targetLanguage).languageCode?.identifier ?? targetLanguage
    let identifier = languageFlag.count == 2 ? "\(base)-\(languageFlag.uppercased())" : base
    return Locale.current.localizedString(forIdentifier: identifier) ?? base
  }
}

extension CourseMark {
  init(_ course: CourseSummary) {
    self.init(
      imageURL: course.imageURL, languageFlag: course.languageFlag,
      targetLanguage: course.targetLanguage)
  }

  init(_ course: Course) {
    self.init(
      imageURL: course.imageURL, languageFlag: course.languageFlag,
      targetLanguage: course.targetLanguage)
  }
}

/// Nil for a region with no emoji, such as Catalonia or the Arab League.
func flagEmoji(_ code: String) -> String? {
  let letters = code.lowercased().unicodeScalars

  if letters.count == 2, letters.allSatisfy({ ("a"..."z").contains($0) }) {
    return String(
      String.UnicodeScalarView(letters.compactMap { Unicode.Scalar(0x1F185 + $0.value) }))
  }

  guard ["gb-eng", "gb-sct", "gb-wls"].contains(code) else {
    return nil
  }

  let tags = code.unicodeScalars.filter { $0 != "-" }.compactMap {
    Unicode.Scalar(0xE0000 + $0.value)
  }
  return "\u{1F3F4}" + String(String.UnicodeScalarView(tags)) + "\u{E007F}"
}

func catalogDurationText(minutes: Int) -> String {
  minutes < 60
    ? studyDuration(minutes: minutes)
    : "~\(studyDuration(minutes: Int((Double(minutes) / 60).rounded()) * 60))"
}

/// Nil while its lessons aren't written.
func courseLengthText(lessonCount: Int, minutes: Int) -> String? {
  guard lessonCount > 0 else {
    return nil
  }

  let lessons = String(
    localized: "\(lessonCount) lessons", table: "Courses",
    comment: "How many lessons a course has, before how long it takes")
  return "\(lessons) · \(catalogDurationText(minutes: minutes))"
}

func firstSentence(_ text: String?) -> String? {
  guard let text = catalogText(text) else {
    return nil
  }

  var sentence: String?
  text.enumerateSubstrings(in: text.startIndex..., options: [.bySentences]) {
    substring, _, _, stop in
    sentence = substring?.trimmingCharacters(in: .whitespacesAndNewlines)
    stop = true
  }
  return sentence ?? text
}

struct CatalogSectionHeader<Title: View, Detail: View>: View {
  @ViewBuilder let title: Title
  @ViewBuilder let detail: Detail

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .firstTextBaseline) {
        title
        Spacer(minLength: 12)
        detailText
      }

      VStack(alignment: .leading, spacing: 2) {
        title
        detailText
      }
    }
  }

  private var detailText: some View {
    detail
      .font(.footnote.monospacedDigit())
      .lineLimit(1)
  }
}
