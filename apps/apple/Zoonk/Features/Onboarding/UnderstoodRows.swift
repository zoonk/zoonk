import Foundation

/// A fact the learner can fix in place on "Here's what I understood": a goal's title, date or one of its details, or when they study (shared by every goal of the card).
enum UnderstoodField: String, Equatable, Sendable {
  case title
  case targetDate
  case institution
  case reason
  case role
  case targetCourse
  case targetPosition
  case targetScore
  case studyTime

  enum Editor {
    case text
    case date
    case time
  }

  var editor: Editor {
    switch self {
    case .targetDate: .date
    case .studyTime: .time
    default: .text
    }
  }
}

/// One understood fact as a row: what it is, the value, where it came from, and how to fix it (main's `UnderstoodRow`).
struct UnderstoodRow: Identifiable, Equatable {
  let id: String
  let label: LocalizedStringResource
  let value: String
  /// A small marker next to the value, such as "you said" for a level.
  var badge: LocalizedStringResource?
  var note: String?
  var source: UnderstoodSource?
  var field: UnderstoodField?
  /// What the editor starts from: the fact's own value, or a default such as the exam's first day.
  var editValue: String?
  /// The exam's official day when the row's date is another, one tap to take ("Use this date").
  var suggestedDate: String?
  /// The dates the row's date is picked from (an exam's next sittings), each one tap away.
  var choiceDates: [String] = []
}

struct UnderstoodSource: Equatable {
  let title: String?
  let url: URL

  /// Past this, a notice's title (often its whole heading, in capitals) reads as its site instead.
  private static let maxTitleLength = 40

  /// The source as a few words: its short title, else the site it's on ("cebraspe.org.br").
  var name: String {
    let host = url.host()?.replacing(/^www\./, with: "") ?? url.absoluteString

    if let title = title?.trimmingCharacters(in: .whitespaces), !title.isEmpty,
      title.count <= Self.maxTitleLength
    {
      return title
    }

    return host
  }
}

/// What a goal draft says of itself, read from its JSON details as main's rows read them.
struct UnderstoodFacts: Decodable {
  let kind: String
  let title: String
  let language: String
  let targetDate: String?
  let targetLanguage: String?
  let details: Details?

  struct Details: Decodable {
    /// The questions the words already answered, such as `schedule` when they said how long.
    let answered: [String]?
    let institution: String?
    let levelNote: String?
    let nativeLanguage: String?
    let purpose: String?
    let reason: String?
    let role: String?
    let targetCourse: String?
    let targetPosition: String?
    let targetScore: String?
    let examMonth: Int?
    let examYear: Int?
  }

  init(_ draft: Components.Schemas.GoalDraftOutput) throws {
    self = try JSONDecoder().decode(Self.self, from: JSONEncoder().encode(draft))
  }
}

/// The "Here's what I understood" rows in the order the learner reads them (main's `useUnderstoodRows`): the goal, its one date, the language, the target and why, and the level they gave. What the title already says gets no row of its own.
enum UnderstoodRows {
  static func rows(
    for goal: Components.Schemas.UnderstoodGoal,
    today: Date = .now,
    locale: Locale = .current
  ) -> [UnderstoodRow] {
    guard let facts = try? UnderstoodFacts(goal.draft.value1) else {
      return []
    }

    var rows = [
      UnderstoodRow(
        id: "title",
        label: LocalizedStringResource(
          "Goal", table: "Onboarding", comment: "Row naming an understood goal"),
        value: facts.title, field: .title, editValue: facts.title)
    ]

    if let date = dateRow(facts: facts, examDates: goal.examDates, today: today) {
      rows.append(date)
    }

    rows += languageRows(facts: facts, locale: locale)
    rows += detailRows(facts: facts, cutoff: goal.cutoff?.value1)

    if let levelNote = text(facts.details?.levelNote) {
      rows.append(
        UnderstoodRow(
          id: "level",
          label: LocalizedStringResource(
            "Level", table: "Onboarding", comment: "Row with the level the learner described"),
          value: levelNote,
          badge: LocalizedStringResource(
            "you said", table: "Onboarding",
            comment: "Marks a level row as the learner's own words")))
    }

    return rows
  }

  /// When the learner studies, shared by every goal of the card: their words or time, and the minutes when they said them.
  static func scheduleRow(
    _ understood: Components.Schemas.GoalUnderstanding.Case1Payload
  ) -> UnderstoodRow? {
    let schedule = understood.schedule
    // The card shows the minutes only when the words said them.
    let minutesSaid =
      understood.goals.first
      .flatMap { try? UnderstoodFacts($0.draft.value1) }?.details?.answered?.contains("schedule")
      ?? false
    let when = schedule.studyTimeNote ?? schedule.studyTime.flatMap(timeOfDay)
    let minutes =
      minutesSaid
      ? String(
        localized: LocalizedStringResource(
          "\(Duration.seconds(schedule.dailyMinutes * 60), format: .units(allowed: [.hours, .minutes], width: .wide)) a day",
          table: "Onboarding", comment: "How long the learner studies each day"))
      : nil
    let parts = [when, minutes].compactMap(\.self)

    guard !parts.isEmpty else {
      return nil
    }

    return UnderstoodRow(
      id: "schedule",
      label: LocalizedStringResource(
        "When you study", table: "Onboarding", comment: "Row with when the learner studies"),
      value: parts.joined(separator: " · "),
      field: .studyTime,
      editValue: schedule.studyTime ?? "")
  }

  private static func text(_ value: String?) -> String? {
    guard let value, !value.trimmingCharacters(in: .whitespaces).isEmpty else {
      return nil
    }

    return value
  }

  /// A detail the title already says isn't repeated: fixing the title fixes it.
  private static func isSaid(_ value: String, in title: String) -> Bool {
    title.localizedStandardContains(value)
  }

  private static func languageRows(facts: UnderstoodFacts, locale: Locale) -> [UnderstoodRow] {
    guard facts.kind == "language", let target = facts.targetLanguage else {
      return []
    }

    let language = locale.localizedString(forLanguageCode: target) ?? target
    let native = text(facts.details?.nativeLanguage) ?? facts.language
    var rows: [UnderstoodRow] = []

    if !isSaid(language, in: facts.title) {
      rows.append(
        UnderstoodRow(
          id: "targetLanguage",
          label: LocalizedStringResource(
            "Language", table: "Onboarding", comment: "Row with the language a goal learns"),
          value: language))
    }

    rows.append(
      UnderstoodRow(
        id: "nativeLanguage",
        label: LocalizedStringResource(
          "You speak", table: "Onboarding", comment: "Row with the learner's own language"),
        value: locale.localizedString(forLanguageCode: native) ?? native))

    return rows
  }

  /// The goal's course or where, its target, the last cut-off, why, and the learner's role, each once.
  private static func detailRows(
    facts: UnderstoodFacts,
    cutoff: Components.Schemas.TargetCutoff?
  ) -> [UnderstoodRow] {
    func unsaid(_ value: String?) -> String? {
      text(value).flatMap { isSaid($0, in: facts.title) ? nil : $0 }
    }

    let details = facts.details
    let course = unsaid(details?.targetCourse)
    let institution = unsaid(details?.institution)
    let isCareerChange = details?.purpose == "careerChange"
    var rows: [UnderstoodRow] = []

    if let course {
      rows.append(
        UnderstoodRow(
          id: "targetCourse",
          label: LocalizedStringResource(
            "Course", table: "Onboarding", comment: "Row with the course an exam aims for"),
          value: course,
          note: institution.map {
            String(
              localized: LocalizedStringResource(
                "Where: \($0)", table: "Onboarding",
                comment: "Where the course is; a label, so the place's article doesn't matter"))
          },
          field: .targetCourse, editValue: course))
    } else if let institution {
      rows.append(
        UnderstoodRow(
          id: "institution",
          label: LocalizedStringResource(
            "Where", table: "Onboarding", comment: "Row with the school a goal aims for"),
          value: institution, field: .institution, editValue: institution))
    }

    if let position = unsaid(details?.targetPosition) {
      rows.append(
        UnderstoodRow(
          id: "targetPosition",
          label: isCareerChange
            ? LocalizedStringResource(
              "The role you want", table: "Onboarding",
              comment: "Row with the role a career change aims for")
            : LocalizedStringResource(
              "Position", table: "Onboarding", comment: "Row with the position an exam is for"),
          value: position, field: .targetPosition, editValue: position))
    }

    if let target = unsaid(details?.targetScore) {
      rows.append(
        UnderstoodRow(
          id: "targetScore",
          label: facts.kind == "language"
            ? LocalizedStringResource(
              "Level you're aiming for", table: "Onboarding",
              comment: "Row with the language level a goal aims for")
            : LocalizedStringResource(
              "Target score", table: "Onboarding", comment: "Row with the score an exam aims for"),
          value: target, field: .targetScore, editValue: target))
    }

    if let cutoff {
      rows.append(cutoffRow(cutoff))
    }

    if let reason = unsaid(details?.reason) {
      rows.append(
        UnderstoodRow(
          id: "reason",
          label: LocalizedStringResource(
            "Reason", table: "Onboarding", comment: "Row with why the learner studies"),
          value: reason, field: .reason, editValue: reason))
    }

    if let role = unsaid(details?.role) {
      rows.append(
        UnderstoodRow(
          id: "role",
          label: isCareerChange
            ? LocalizedStringResource(
              "What you do now", table: "Onboarding",
              comment: "Row with the learner's current work before a career change")
            : LocalizedStringResource(
              "Your role", table: "Onboarding", comment: "Row with the learner's role at work"),
          value: role, field: .role, editValue: role))
    }

    return rows
  }

  /// Where the bar was for the target, when another learner's research found it: a reference, never a promise.
  private static func cutoffRow(_ cutoff: Components.Schemas.TargetCutoff) -> UnderstoodRow {
    let number = FloatingPointFormatStyle<Double>.number.precision(.fractionLength(0...1))
    let detail = [
      cutoff.course, cutoff.position, cutoff.course == nil ? nil : cutoff.institution,
      cutoff.edition, cutoff.quota,
    ]
    .compactMap { text($0) }
    .joined(separator: " · ")

    return UnderstoodRow(
      id: "cutoff",
      label: LocalizedStringResource(
        "Last cut-off", table: "Onboarding", comment: "Row with the last published cut-off score"),
      value: String(
        localized: LocalizedStringResource(
          "\(cutoff.score.formatted(number)) out of \(cutoff.maxScore.formatted(number))",
          table: "Onboarding", comment: "A score on its scale, such as 7 out of 10")),
      note: detail.isEmpty ? nil : detail,
      // Named by its site: a search's page titles are often file names ("Notas-minimas.pdf").
      source: URL(string: cutoff.source.url).map { UnderstoodSource(title: nil, url: $0) })
  }

  /// The goal's one date row (main's `useDateRow`): the day the learner or their words gave (with its official source when a search found it, or the notice's day one tap away when it's another), else the month they named when the plan keeps it, else the sitting to pick for an exam held several times a year, else the exam's days (official or estimated), else, for an exam whose day isn't out, that it's to be confirmed.
  private static func dateRow(
    facts: UnderstoodFacts,
    examDates: [Components.Schemas.OnboardingExamDate],
    today: Date
  ) -> UnderstoodRow? {
    let from = isoDay(today)
    let month = facts.details?.examMonth
    let year = facts.details?.examYear
    // A language certificate's dates come from its official guide, any other exam's from its notice.
    let isGuide = facts.kind == "exam" && facts.targetLanguage != nil

    if let targetDate = facts.targetDate, let date = day(targetDate) {
      let official = examDates.first {
        $0.source != nil && !$0.estimated && $0.date == targetDate
      }
      let suggested =
        official == nil
        ? ExamSittings.meantDay(
          days: examDates, month: month, year: year, from: from, goalDate: targetDate
        )
        .flatMap { day in
          day.estimated || examDates.contains { $0.date == targetDate } ? nil : day
        }
        : nil

      return UnderstoodRow(
        id: "targetDate",
        label: facts.kind == "exam"
          ? examDateLabel
          : LocalizedStringResource(
            "Deadline", table: "Onboarding", comment: "Row with the date a goal aims for"),
        value: date.formatted(.dateTime.day().month(.wide).year()),
        note: official.flatMap { day($0.date) }.map { daysLeft(until: $0, today: today) }
          ?? suggested.map { noticeDayText($0.date, isGuide: isGuide) },
        source: (official ?? suggested)?.source.flatMap(source),
        field: .targetDate, editValue: targetDate, suggestedDate: suggested?.date)
    }

    guard facts.kind == "exam" else {
      return nil
    }

    guard let first = examDates.first else {
      return UnderstoodRow(
        id: "targetDate", label: examDateLabel,
        value: toBeConfirmed(month: month, year: year),
        note: isGuide
          ? String(
            localized: LocalizedStringResource(
              "The official date comes out on the exam's official calendar. Know it already? Set it here.",
              table: "Onboarding", comment: "Under an exam date that isn't out yet"))
          : String(
            localized: LocalizedStringResource(
              "The official date comes out in the exam's notice. Know it already? Set it here.",
              table: "Onboarding", comment: "Under an exam date that isn't out yet, from its notice"
            )),
        field: .targetDate, editValue: "")
    }

    let estimated = examDates.contains(where: \.estimated)

    if !estimated,
      let kept = keptMonthRow(
        examDates: examDates, month: month, year: year, from: from, isGuide: isGuide)
        ?? sittingChoiceRow(examDates: examDates, month: month, from: from)
    {
      return kept
    }

    let sitting =
      estimated
      ? examDates
      : ExamSittings.learnerSitting(
        days: examDates, from: from,
        goalDate: ExamSittings.namedMonthStart(month: month, year: year, from: from))
        ?? examDates
    let shown = sitting.first ?? first

    return UnderstoodRow(
      id: "examDates",
      label: sitting.count == 1
        ? examDateLabel
        : LocalizedStringResource(
          "Exam dates", table: "Onboarding", comment: "Row with an exam's dates over several days"),
      value: examDaysText(sitting),
      note: estimated
        ? String(
          localized: LocalizedStringResource(
            "From its usual dates. We'll tell you when the official ones are out.",
            table: "Onboarding", comment: "Under exam dates estimated from past years"))
        : day(shown.date).map { daysLeft(until: $0, today: today) },
      source: estimated ? nil : shown.source.flatMap(source),
      field: .targetDate, editValue: shown.date)
  }

  private static let examDateLabel = LocalizedStringResource(
    "Exam date", table: "Onboarding", comment: "Row with an exam's date")

  /// The month the learner named when the plan keeps it: over the notice's day in another month, which the row offers one tap away, or, for an exam held several times a year, with no sitting in their month to offer.
  private static func keptMonthRow(
    examDates: [Components.Schemas.OnboardingExamDate],
    month: Int?,
    year: Int?,
    from: String,
    isGuide: Bool
  ) -> UnderstoodRow? {
    let noticeDay = ExamSittings.meantDay(
      days: examDates, month: month, year: year, from: from, goalDate: nil)
    let kept =
      noticeDay.map {
        ExamSittings.keptMonthStart(month: month, year: year, noticeDay: $0.date, today: from)
      }
      ?? ExamSittings.namedMonthStart(month: month, year: year, from: from)

    guard let kept, let start = day(kept) else {
      return nil
    }

    return UnderstoodRow(
      id: "targetDate", label: examDateLabel,
      value: start.formatted(.dateTime.month(.wide).year()).localizedCapitalized,
      note: noticeDay.map { noticeDayText($0.date, isGuide: isGuide) },
      source: noticeDay?.source.flatMap(source),
      field: .targetDate, editValue: kept, suggestedDate: noticeDay?.date)
  }

  /// An exam held several times a year when the learner gave no date or month: which sitting they'll take, from the next ones open for registration, each one tap away. Until they pick, the plan counts down to the first.
  private static func sittingChoiceRow(
    examDates: [Components.Schemas.OnboardingExamDate],
    month: Int?,
    from: String
  ) -> UnderstoodRow? {
    let open = ExamSittings.openSittings(count: 3, days: examDates, from: from)

    guard month == nil, ExamSittings.hasSeveral(examDates), let first = open.first,
      open.count >= 2
    else {
      return nil
    }

    return UnderstoodRow(
      id: "examDates", label: examDateLabel,
      value: String(
        localized: LocalizedStringResource(
          "Pick your date", table: "Onboarding",
          comment: "An exam held several times a year whose sitting isn't picked yet")),
      note: String(
        localized: LocalizedStringResource(
          "This exam is held several times a year. Until you pick one, your plan uses the first.",
          table: "Onboarding", comment: "Under the sittings of an exam held several times a year")),
      source: first.source.flatMap(source),
      field: .targetDate, editValue: first.date, choiceDates: open.map(\.date))
  }

  /// What the exam's notice (or a certificate's official calendar) says its day is.
  private static func noticeDayText(_ isoDate: String, isGuide: Bool) -> String {
    let date = day(isoDate)?.formatted(.dateTime.day().month(.wide).year()) ?? isoDate

    return isGuide
      ? String(
        localized: LocalizedStringResource(
          "The exam's official calendar says \(date).", table: "Onboarding",
          comment: "The day a language certificate's official calendar gives"))
      : String(
        localized: LocalizedStringResource(
          "The exam notice says \(date).", table: "Onboarding",
          comment: "The day an exam's notice gives"))
  }

  /// The exam's days in one line, the year said once at the end when they share it: "November 8 and November 15, 2026".
  private static func examDaysText(_ days: [Components.Schemas.OnboardingExamDate]) -> String {
    let sameYear = Set(days.map { yearOf($0.date) }).count == 1

    return days.indices.compactMap { index -> String? in
      guard let date = day(days[index].date) else {
        return nil
      }

      return sameYear && index < days.count - 1
        ? date.formatted(.dateTime.day().month(.wide))
        : date.formatted(.dateTime.day().month(.wide).year())
    }
    .formatted(.list(type: .and))
  }

  private static func yearOf(_ isoDate: String) -> Int {
    Int(isoDate.prefix(4)) ?? 0
  }

  /// An exam without its official day, as far as the learner's words go: "March 2027, to be confirmed" when they named the month, else the year, else just to be confirmed.
  private static func toBeConfirmed(month: Int?, year: Int?) -> String {
    guard let year else {
      return String(
        localized: LocalizedStringResource(
          "To be confirmed", table: "Onboarding", comment: "An exam date that isn't out yet"))
    }

    guard let month,
      let date = Calendar.current.date(from: DateComponents(year: year, month: month))
    else {
      return String(
        localized: LocalizedStringResource(
          "\(String(year)), to be confirmed", table: "Onboarding",
          comment: "An exam date that isn't out yet, with the year the learner named"))
    }

    return String(
      localized: LocalizedStringResource(
        "\(date.formatted(.dateTime.month(.wide).year())), to be confirmed", table: "Onboarding",
        comment: "An exam date that isn't out yet, with the month the learner named"))
  }

  /// The learner's today as an ISO date.
  private static func isoDay(_ date: Date) -> String {
    let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
  }

  private static func daysLeft(until date: Date, today: Date) -> String {
    let days =
      Calendar.current.dateComponents([.day], from: today.startOfDay, to: date.startOfDay).day ?? 0

    return String(
      localized: LocalizedStringResource(
        "\(days) days left", table: "Onboarding", comment: "Days until a goal's date"))
  }

  private static func source(
    _ value: Components.Schemas.OnboardingExamDate.SourcePayload
  ) -> UnderstoodSource? {
    URL(string: value.url).map { UnderstoodSource(title: value.title, url: $0) }
  }

  /// A local day from an ISO date ("2027-11-08").
  static func day(_ isoDate: String) -> Date? {
    let parts = isoDate.split(separator: "-").compactMap { Int($0) }

    guard parts.count == 3 else {
      return nil
    }

    return Calendar.current.date(
      from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  /// "07:30" as the learner's clock shows it.
  private static func timeOfDay(_ value: String) -> String? {
    let parts = value.split(separator: ":").compactMap { Int($0) }

    guard parts.count >= 2,
      let date = Calendar.current.date(
        bySettingHour: parts[0], minute: parts[1], second: 0, of: .now)
    else {
      return nil
    }

    return date.formatted(date: .omitted, time: .shortened)
  }
}

extension Date {
  fileprivate var startOfDay: Date { Calendar.current.startOfDay(for: self) }
}
