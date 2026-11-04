import SwiftUI

/// Main's subject palette (`[data-subject]` in `globals.css`): a mark, words and a tint per subject.
/// A course without one is `general`.
struct SubjectColors {
  let mark: Color
  let text: Color
  let tint: Color

  init(_ subject: CourseCategory?) {
    mark = Color(Self.mark(subject))
    text = Color(Self.text(subject))
    tint = Color(Self.tint(subject))
  }

  private static func mark(_ subject: CourseCategory?) -> ColorResource {
    switch subject {
    case nil: .subjectGeneral
    case .arts: .subjectArts
    case .business: .subjectBusiness
    case .communication: .subjectCommunication
    case .culture: .subjectCulture
    case .economics: .subjectEconomics
    case .engineering: .subjectEngineering
    case .exams: .subjectExams
    case .geography: .subjectGeography
    case .health: .subjectHealth
    case .history: .subjectHistory
    case .languages: .subjectLanguages
    case .law: .subjectLaw
    case .math: .subjectMath
    case .science: .subjectScience
    case .society: .subjectSociety
    case .tech: .subjectTech
    }
  }

  private static func text(_ subject: CourseCategory?) -> ColorResource {
    switch subject {
    case nil: .subjectGeneralText
    case .arts: .subjectArtsText
    case .business: .subjectBusinessText
    case .communication: .subjectCommunicationText
    case .culture: .subjectCultureText
    case .economics: .subjectEconomicsText
    case .engineering: .subjectEngineeringText
    case .exams: .subjectExamsText
    case .geography: .subjectGeographyText
    case .health: .subjectHealthText
    case .history: .subjectHistoryText
    case .languages: .subjectLanguagesText
    case .law: .subjectLawText
    case .math: .subjectMathText
    case .science: .subjectScienceText
    case .society: .subjectSocietyText
    case .tech: .subjectTechText
    }
  }

  private static func tint(_ subject: CourseCategory?) -> ColorResource {
    switch subject {
    case nil: .subjectGeneralTint
    case .arts: .subjectArtsTint
    case .business: .subjectBusinessTint
    case .communication: .subjectCommunicationTint
    case .culture: .subjectCultureTint
    case .economics: .subjectEconomicsTint
    case .engineering: .subjectEngineeringTint
    case .exams: .subjectExamsTint
    case .geography: .subjectGeographyTint
    case .health: .subjectHealthTint
    case .history: .subjectHistoryTint
    case .languages: .subjectLanguagesTint
    case .law: .subjectLawTint
    case .math: .subjectMathTint
    case .science: .subjectScienceTint
    case .society: .subjectSocietyTint
    case .tech: .subjectTechTint
    }
  }
}

struct SubjectGlyph: View {
  let subject: CourseCategory?

  var body: some View {
    RoundedRectangle(cornerRadius: 2, style: .continuous)
      .fill(SubjectColors(subject).mark)
      .frame(width: 8, height: 8)
      .accessibilityHidden(true)
  }
}

/// Main's `SubjectLabel`: the subject's words in its `-text` color on its tint.
struct CourseSubjectLabel: View {
  let subject: CourseCategory

  var body: some View {
    let colors = SubjectColors(subject)

    Text(subject.localizedTitle)
      .font(.caption.weight(.medium))
      .foregroundStyle(colors.text)
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .frame(minHeight: 22)
      .background(colors.tint, in: .rect(cornerRadius: Radius.md, style: .continuous))
      .fixedSize()
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

    return languageFlagLabel(language: targetLanguage, flag: languageFlag)
  }
}

/// main's `getLanguageFlagLabel`: the language in the flag's country ("Chinese (Taiwan)").
func languageFlagLabel(language: String, flag: String, locale: Locale = .current) -> String {
  let base = Locale.Language(identifier: language).languageCode?.identifier ?? language
  let identifier = flag.count == 2 ? "\(base)-\(flag.uppercased())" : base
  return locale.languageTitle(identifier)
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
  return "\(lessons)\u{00A0}· \(catalogDurationText(minutes: minutes))"
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
