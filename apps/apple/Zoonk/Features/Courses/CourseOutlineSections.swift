import SwiftUI

/// What the learner unfolded in a course's outline, by level or area. Kept by the screen above its
/// panes, so folding or unfolding keeps it.
struct CourseOutlineDisclosures {
  var expanded: [String: Bool] = [:]
  var showsAll: [String: Bool] = [:]
}

extension Binding<CourseOutlineDisclosures> {
  fileprivate func isExpanded(_ key: String, otherwise: Bool) -> Binding<Bool> {
    Binding<Bool> {
      wrappedValue.expanded[key] ?? otherwise
    } set: {
      wrappedValue.expanded[key] = $0
    }
  }

  fileprivate func isShowingAll(_ key: String, otherwise: Bool) -> Binding<Bool> {
    Binding<Bool> {
      wrappedValue.showsAll[key] ?? otherwise
    } set: {
      wrappedValue.showsAll[key] = $0
    }
  }
}

/// Where the learner's plan is in a course's outline. While a signed-in learner's summary is on its
/// way no level opens and the example plan's numbers stay hidden, so neither changes under them.
enum OutlineLearner: Equatable {
  case waiting
  /// A visitor, or a learner whose plan doesn't follow the course.
  case noPlan
  /// `chapterID` holds the plan's next lesson; nil while that lesson isn't written into a chapter,
  /// when `level` still says where the plan is.
  case follows(chapterID: String?, level: CourseLevel?)

  init(signedIn: Bool, summary: LoadState<LearnerSummary>, courseID: String) {
    guard signedIn else {
      self = .noPlan
      return
    }

    switch summary {
    case .idle, .loading:
      self = .waiting
    case .loaded(let summary):
      self =
        summary.goals.first { $0.courseID == courseID }
        .map { .follows(chapterID: $0.courseChapterID, level: $0.courseLevel) } ?? .noPlan
    case .empty, .failed:
      self = .noPlan
    }
  }

  /// The example plan helps someone deciding; a learner whose plan follows the course has their own.
  var showsExampleNumbers: Bool { self == .noPlan }

  func opens(_ level: CourseLevel, isFirst: Bool) -> Bool {
    switch self {
    case .waiting:
      false
    case .noPlan, .follows(_, nil):
      isFirst
    case .follows(_, let open?):
      open == level
    }
  }

  func isHere(chapterID: String) -> Bool {
    if case .follows(let here?, _) = self {
      return here == chapterID
    }

    return false
  }

  func isHere(level: CourseLevel) -> Bool {
    self == .follows(chapterID: nil, level: level)
  }

  /// A long list opens its fold when the fold hides the learner's chapter.
  func unfolds(_ chapterIDs: [String]) -> Bool {
    chapterIDs.contains { isHere(chapterID: $0) }
  }
}

struct CourseOutlineSections: View {
  let detail: CourseDetail
  let estimate: CoursePlanEstimate?
  let exam: CoursePlanExample.Exam?
  let lead: String?
  let minutes: Int?
  let learner: OutlineLearner
  @Binding var disclosures: CourseOutlineDisclosures

  var body: some View {
    let chapters = detail.chapters.sorted { $0.position < $1.position }
    let places = Dictionary(
      (estimate?.chapters ?? []).map { ($0.chapterID, $0) }, uniquingKeysWith: { first, _ in first }
    )

    Section {
      if let estimate, !chapters.isEmpty, learner.showsExampleNumbers {
        planLine(estimate)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      if let lead {
        Text(lead)
      }

      if chapters.isEmpty {
        Label {
          Text(
            "Build your plan and Zoonk writes this course's chapters and lessons for you, starting at your level.",
            tableName: "Courses", comment: "A course outline before its chapters are written")
        } icon: {
          Image(systemName: "sparkles")
            .foregroundStyle(.secondary)
        }
      }
    } header: {
      CatalogSectionHeader {
        Text("Course outline", tableName: "Courses", comment: "Header of a course's outline")
      } detail: {
        if let size = sizeText(chapters) {
          Text(size)
        }
      }
    }

    if case .byDate(_, _, let areas) = estimate?.reach, !chapters.isEmpty {
      CourseAreaOutline(
        areas: areas, chapters: chapters, course: detail.course, learner: learner, places: places,
        disclosures: $disclosures)
    } else if !chapters.isEmpty {
      let bands = courseLevelBands(chapters)

      ForEach(detail.course.levels, id: \.self) { level in
        if let band = bands.first(where: { $0.level == level }) {
          CourseLevelOutline(
            band: band, course: detail.course, learner: learner,
            isOpen: learner.opens(level, isFirst: level == bands.first?.level),
            places: learner.showsExampleNumbers ? places : [:], disclosures: $disclosures)
        } else {
          UnwrittenLevel(level: level, isHere: learner.isHere(level: level))
        }
      }
    }
  }

  @ViewBuilder
  private func planLine(_ estimate: CoursePlanEstimate) -> some View {
    if case .byDate = estimate.reach, let date = exam?.days.first.flatMap(catalogDay),
      let minutes
    {
      Text(
        "Your plan until \(date), at \(studyDuration(minutes: minutes)) a day",
        tableName: "Courses", comment: "Over an exam course's outline: the example plan it marks")
    } else if let minutes {
      Text(
        "Your plan at \(minutes) minutes a day, from scratch", tableName: "Courses",
        comment: "Over a course's outline: the example plan it marks")
    }
  }

  private func sizeText(_ chapters: [CourseChapter]) -> String? {
    guard !chapters.isEmpty else {
      return nil
    }

    let lessons = chapters.flatMap(\.lessons)
    let chapterText = String(
      localized: "\(chapters.count) chapters", table: "Courses",
      comment: "How many chapters a course or an exam area has")

    guard !lessons.isEmpty else {
      return chapterText
    }

    let lessonText = String(
      localized: "\(lessons.count) lessons written so far", table: "Courses",
      comment:
        "After the course's chapter count. Zoonk writes more lessons as learners reach them, so this counts only those written until now."
    )
    return [chapterText, lessonText].joined(separator: " · ")
  }
}

private struct CourseLevelOutline: View {
  private static let named = 3

  let band: CourseLevelBand
  let course: Course
  let learner: OutlineLearner
  let isOpen: Bool
  let places: [String: CoursePlanEstimate.ChapterPlace]
  @Binding var disclosures: CourseOutlineDisclosures

  var body: some View {
    let key = "level:\(band.level)"
    let isExpanded = $disclosures.isExpanded(key, otherwise: isOpen)

    Section {
      DisclosureGroup(isExpanded: isExpanded) {
        OutlineChapterRows(
          chapters: band.chapters, course: course, learner: learner,
          disclosures: $disclosures, key: key,
          mark: { chapter in places[chapter.id].flatMap(weekText) })
      } label: {
        VStack(alignment: .leading, spacing: 2) {
          LabeledContent {
            Text(aside)
              .font(.footnote.monospacedDigit())
          } label: {
            LevelTitle(level: band.level, isHere: learner.isHere(level: band.level))
          }

          if !isExpanded.wrappedValue {
            Text(band.chapters.prefix(Self.named).map(\.title).joined(separator: " · "))
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        .accessibilityElement(children: .combine)
      }
    }
  }

  private var aside: String {
    let count = String(
      localized: "\(band.chapters.count) chapters", table: "Courses",
      comment: "How many chapters a course or an exam area has")
    let weeks = band.chapters.compactMap { places[$0.id] }.filter { $0.week != nil }

    guard
      let first = weeks.compactMap(\.week).min(),
      let last = weeks.compactMap({ $0.endWeek ?? $0.week }).max()
    else {
      return count
    }

    let span =
      first == last
      ? String(
        localized: "week \(first)", table: "Courses",
        comment: "The one week a level takes in a plan")
      : String(
        localized: "weeks \(first)–\(last)", table: "Courses",
        comment: "The weeks a level takes in a plan")
    return "\(count) · \(span)"
  }
}

/// A level the course covers with no chapter written yet, so a learner sees the whole course it
/// promises. It has nothing to open.
private struct UnwrittenLevel: View {
  let level: CourseLevel
  let isHere: Bool

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 2) {
        LevelTitle(level: level, isHere: isHere)

        Text(
          "Not written yet. Zoonk writes its chapters as learners reach it.", tableName: "Courses",
          comment:
            "Under the name of a course's level, such as Intermediate, that has no chapters yet. “it” is that level."
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
      .accessibilityElement(children: .combine)
    }
  }
}

private struct LevelTitle: View {
  let level: CourseLevel
  let isHere: Bool

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        title
        here
      }

      VStack(alignment: .leading, spacing: 2) {
        title
        here
      }
    }
  }

  private var title: some View {
    Text(level.localizedTitle)
      .font(.headline)
  }

  @ViewBuilder
  private var here: some View {
    if isHere {
      YouAreHere()
    }
  }
}

/// Marks the chapter of the next lesson in the learner's plan, or its level while that lesson isn't
/// written into a chapter yet.
private struct YouAreHere: View {
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "smallcircle.filled.circle.fill")
        .symbolRenderingMode(.hierarchical)
        .imageScale(.small)
        .accessibilityHidden(true)

      Text(
        "You are here", tableName: "Courses",
        comment: "On a course's outline, marks the chapter or level the learner's plan is at")
    }
    .font(.footnote)
    .foregroundStyle(.success)
  }
}

/// A chapter the estimate can't place in an area yet isn't listed.
private struct CourseAreaOutline: View {
  let areas: [CoursePlanEstimate.Area]
  let chapters: [CourseChapter]
  let course: Course
  let learner: OutlineLearner
  let places: [String: CoursePlanEstimate.ChapterPlace]
  @Binding var disclosures: CourseOutlineDisclosures

  var body: some View {
    let names = areas.compactMap(\.name).reduce(into: [String]()) { names, name in
      if !names.contains(name), chapters.contains(where: { places[$0.id]?.area == name }) {
        names.append(name)
      }
    }

    if names.count <= 1 {
      Section {
        areaRows(chapters: chapters, key: "areas")
      } header: {
        if learner.showsExampleNumbers {
          Text(areaFit(name: names.first, chapters: chapters))
        }
      }
    } else {
      ForEach(names, id: \.self) { name in
        let areaChapters = chapters.filter { places[$0.id]?.area == name }

        Section {
          DisclosureGroup(isExpanded: $disclosures.isExpanded("area:\(name)", otherwise: false)) {
            areaRows(chapters: areaChapters, key: "area:\(name)")
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              LabeledContent {
                Text(
                  "\(areaChapters.count) chapters", tableName: "Courses",
                  comment: "How many chapters a course or an exam area has"
                )
                .font(.footnote.monospacedDigit())
              } label: {
                Text(name)
                  .font(.headline)
              }

              if learner.showsExampleNumbers {
                Text(areaFit(name: name, chapters: areaChapters))
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            }
            .accessibilityElement(children: .combine)
          }
        }
      }
    }
  }

  private func areaRows(chapters: [CourseChapter], key: String) -> some View {
    let ordered = chapters.sorted {
      (places[$0.id]?.studyOrder ?? .max) < (places[$1.id]?.studyOrder ?? .max)
    }

    return OutlineChapterRows(
      chapters: ordered, course: course, learner: learner, disclosures: $disclosures, key: key,
      mark: mark)
  }

  private func mark(_ chapter: CourseChapter) -> String? {
    guard learner.showsExampleNumbers else {
      return nil
    }

    guard let place = places[chapter.id], let weeks = weekText(place) else {
      return String(
        localized: "Left out", table: "Courses",
        comment: "A chapter or an area the example plan leaves out")
    }

    let detail: String? =
      if place.lessonsInPlan == 0 {
        workText(place.workKinds)
      } else if let inPlan = place.lessonsInPlan, inPlan < chapter.lessons.count {
        String(
          localized: "\(inPlan.formatted()) of \(chapter.lessons.count) lessons", table: "Courses",
          comment: "How many of a chapter's lessons fit in an exam's example plan")
      } else {
        nil
      }

    return [weeks, detail].compactMap(\.self).joined(separator: " · ")
  }

  private func areaFit(name: String?, chapters: [CourseChapter]) -> String {
    let area = areas.first { $0.name == name }
    let leftOut = chapters.filter { places[$0.id]?.week == nil }.count
    var parts: [String] = []

    if let area {
      let studied = area.plannedMinutes.rounded() > 0
      parts.append(
        studied
          ? String(
            localized:
              "\(catalogDurationText(minutes: Int(area.plannedMinutes.rounded()))) of study",
            table: "Courses", comment: "The study time an exam area gets in an example plan")
          : String(
            localized: "Left out", table: "Courses",
            comment: "A chapter or an area the example plan leaves out"))

      if studied, area.fitting == 0 {
        parts.append(throughText(area))
      } else {
        parts.append(
          String(
            localized: "\(area.fitting.formatted()) of \(area.total) lessons fit", table: "Courses",
            comment: "How many of an exam area's lessons fit in an example plan"))

        if area.quickLessons > 0 {
          parts.append(
            String(
              localized: "+ \(area.quickLessons) quick lessons", table: "Courses",
              comment: "Quick lessons an exam area adds in an example plan"))
        }
      }
    }

    if leftOut > 0, leftOut < chapters.count {
      parts.append(
        String(
          localized: "\(leftOut) chapters left out", table: "Courses",
          comment: "How many of an exam area's chapters an example plan leaves out"))
    }

    return parts.joined(separator: " · ")
  }

  private func throughText(_ area: CoursePlanEstimate.Area) -> String {
    let quick = area.quickLessons > 0
    let unwritten = area.unwrittenMinutes.rounded() > 0

    if quick, !unwritten {
      return String(
        localized: "\(area.quickLessons) quick lessons", table: "Courses",
        comment: "The quick lessons an exam area is studied through")
    }

    return workText(quick ? [.quick, .unwritten] : [.unwritten]) ?? ""
  }
}

private func workText(_ kinds: Set<CoursePlanEstimate.WorkKind>) -> String? {
  switch (kinds.contains(.quick), kinds.contains(.unwritten)) {
  case (true, true):
    String(
      localized: "quick lessons and lessons written as you reach them", table: "Courses",
      comment: "What part of a course is studied through in an example plan")
  case (true, false):
    String(
      localized: "quick lessons", table: "Courses",
      comment: "What part of a course is studied through in an example plan")
  case (false, true):
    String(
      localized: "lessons written as you reach them", table: "Courses",
      comment: "What part of a course is studied through in an example plan")
  case (false, false):
    nil
  }
}

/// The weeks a chapter starts only ever go up, while ranges would read as out of order.
private func weekText(_ place: CoursePlanEstimate.ChapterPlace) -> String? {
  place.week.map {
    String(
      localized: "Week \($0)", table: "Courses", comment: "The week a chapter starts in a plan")
  }
}

private struct OutlineChapterRows: View {
  private static let shown = 6
  /// A list only a little longer shows whole: a fold that hides two chapters saves nothing.
  private static let foldedFrom = shown + 3

  let chapters: [CourseChapter]
  let course: Course
  let learner: OutlineLearner
  @Binding var disclosures: CourseOutlineDisclosures
  let key: String
  let mark: (CourseChapter) -> String?

  var body: some View {
    let folds = chapters.count >= Self.foldedFrom
    let showsAll = $disclosures.isShowingAll(
      key, otherwise: learner.unfolds(chapters.dropFirst(Self.shown).map(\.id)))

    ForEach(folds && !showsAll.wrappedValue ? Array(chapters.prefix(Self.shown)) : chapters) {
      chapter in
      NavigationLink(value: CourseDestination.chapter(ChapterReference((course, chapter)))) {
        OutlineChapterRow(
          chapter: chapter, isHere: learner.isHere(chapterID: chapter.id), mark: mark(chapter))
      }
    }

    if folds {
      Button {
        showsAll.wrappedValue.toggle()
      } label: {
        if showsAll.wrappedValue {
          Text(
            "Show fewer chapters", tableName: "Courses", comment: "Folds a long list of chapters")
        } else {
          Text(
            "Show \(chapters.count - Self.shown) more chapters", tableName: "Courses",
            comment: "Unfolds the rest of a long list of chapters")
        }
      }
    }
  }
}

private struct OutlineChapterRow: View {
  let chapter: CourseChapter
  let isHere: Bool
  let mark: String?

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(chapter.position + 1, format: .number)
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.tertiary)

      VStack(alignment: .leading, spacing: 4) {
        Text(chapter.title)
          .font(.body.weight(.semibold))

        if isHere || mark != nil {
          HStack(alignment: .firstTextBaseline, spacing: 12) {
            if isHere {
              YouAreHere()
            }

            if let mark {
              Text(mark)
                .font(.footnote.monospacedDigit())
                .foregroundStyle(.secondary)
            }
          }
        }

        if !chapter.lessons.isEmpty {
          Text(chapter.lessons.map(\.title).joined(separator: " · "))
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }
    }
  }
}
