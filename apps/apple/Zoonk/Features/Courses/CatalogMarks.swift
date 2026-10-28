import SwiftUI

extension CourseCategory {
  /// The subject's nearest system hue, from the design system's subject table.
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

/// The subject's color as a small square beside its name (main's `SubjectGlyph`). A course in no
/// category takes the general hue. Decorative.
struct SubjectGlyph: View {
  let subject: CourseCategory?

  var body: some View {
    Image(systemName: "square.fill")
      .imageScale(.small)
      .foregroundStyle(subject?.hue ?? .indigo)
      .accessibilityHidden(true)
  }
}

/// A course's subject named on a quiet chip, its color on the glyph beside the words, never on
/// them (main's `SubjectLabel`).
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

/// A course's mark, as small as a list row's leading one (main's `CourseMark`): a language
/// course's flag, which names the variety it teaches for VoiceOver too, else the course's own
/// picture, else the quiet book every course without one has.
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

  /// What the flag stands for in the reader's language: the variety ("English (United States)"),
  /// or the language alone when its flag isn't a country's.
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

/// The flag emoji of a country's code ("br"), or of a United Kingdom nation's ("gb-wls"); nil for
/// a region with no emoji (Catalonia, the Arab League), which shows the course's picture instead.
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

/// How long a course or chapter takes, from its lessons' estimates, as main writes it: its minutes
/// under an hour, beyond that about its whole hours ("~2 hr").
func catalogDurationText(minutes: Int) -> String {
  minutes < 60
    ? studyDuration(minutes: minutes)
    : "~\(studyDuration(minutes: Int((Double(minutes) / 60).rounded()) * 60))"
}

/// "37 lessons · ~2 hr", a course's numbers in a list; nil while its lessons aren't written.
func courseLengthText(lessonCount: Int, minutes: Int) -> String? {
  guard lessonCount > 0 else {
    return nil
  }

  let lessons = String(
    localized: "\(lessonCount) lessons", table: "Courses",
    comment: "How many lessons a course has, before how long it takes")
  return "\(lessons) · \(catalogDurationText(minutes: minutes))"
}

/// The first sentence of a description, which a list shows of it.
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
