import SwiftUI

/// Everything the course covers (main's `LibraryCourseOutline`): its size beside its title, the
/// example plan's line, its description, then its levels, each folded to its name and first
/// chapters, the first open, its chapters numbered across the course with their lessons and their
/// week in the example plan. An exam course read against its date groups its chapters by the
/// exam's areas instead. A course whose outline isn't written yet invites the reader to build
/// their plan, which writes it for them.
struct CourseOutlineSections: View {
  let detail: CourseDetail
  let estimate: CoursePlanEstimate?
  let exam: CoursePlanExample.Exam?
  let lead: String?
  let minutes: Int?

  var body: some View {
    let chapters = detail.chapters.sorted { $0.position < $1.position }
    let places = Dictionary(
      (estimate?.chapters ?? []).map { ($0.chapterID, $0) }, uniquingKeysWith: { first, _ in first }
    )

    Section {
      if let estimate, !chapters.isEmpty {
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
        areas: areas, chapters: chapters, course: detail.course, places: places)
    } else {
      ForEach(Array(courseLevelBands(chapters).enumerated()), id: \.element.id) { index, band in
        CourseLevelOutline(
          band: band, course: detail.course, isFirst: index == 0, places: places)
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

  /// "12 chapters · 80 short lessons · ~9 hr", the lessons once they're written.
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
      localized: "\(lessons.count) short lessons", table: "Courses",
      comment: "How many lessons a course or a chapter has")
    let minutes = lessons.reduce(0) { $0 + $1.estimatedMinutes }
    return [chapterText, lessonText, catalogDurationText(minutes: minutes)].joined(separator: " · ")
  }
}

/// A level of the course (Overview, Beginner…), folded to its name, its first chapters and how
/// many there are, with the weeks it takes in the example plan; open, its chapters as rows.
private struct CourseLevelOutline: View {
  /// How many chapter names a folded level mentions.
  private static let named = 3

  let band: CourseLevelBand
  let course: Course
  let isFirst: Bool
  let places: [String: CoursePlanEstimate.ChapterPlace]

  @State private var isExpanded: Bool?

  var body: some View {
    let isExpanded = Binding {
      self.isExpanded ?? isFirst
    } set: {
      self.isExpanded = $0
    }

    Section {
      DisclosureGroup(isExpanded: isExpanded) {
        OutlineChapterRows(
          chapters: band.chapters, course: course,
          mark: { chapter in places[chapter.id].flatMap(weekText) })
      } label: {
        VStack(alignment: .leading, spacing: 2) {
          LabeledContent {
            Text(aside)
              .font(.footnote.monospacedDigit())
          } label: {
            Text(band.level.localizedTitle)
              .font(.headline)
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

  /// "12 chapters · weeks 2–15": the level's size and its weeks in the example plan.
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

/// An exam course's chapters by the exam's areas, as its plan against the exam's date reads them:
/// each area folded to its name and how much of it fits, its chapters in the plan's order. A
/// chapter the estimate can't place in an area yet isn't listed.
private struct CourseAreaOutline: View {
  let areas: [CoursePlanEstimate.Area]
  let chapters: [CourseChapter]
  let course: Course
  let places: [String: CoursePlanEstimate.ChapterPlace]

  var body: some View {
    let names = areas.compactMap(\.name).reduce(into: [String]()) { names, name in
      if !names.contains(name), chapters.contains(where: { places[$0.id]?.area == name }) {
        names.append(name)
      }
    }

    if names.count <= 1 {
      Section {
        areaRows(chapters: chapters)
      } header: {
        Text(areaFit(name: names.first, chapters: chapters))
      }
    } else {
      ForEach(names, id: \.self) { name in
        let areaChapters = chapters.filter { places[$0.id]?.area == name }

        Section {
          DisclosureGroup {
            areaRows(chapters: areaChapters)
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

              Text(areaFit(name: name, chapters: areaChapters))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
          }
        }
      }
    }
  }

  /// The area's chapters in the order the plan studies them, what's left out last.
  private func areaRows(chapters: [CourseChapter]) -> some View {
    let ordered = chapters.sorted {
      (places[$0.id]?.studyOrder ?? .max) < (places[$1.id]?.studyOrder ?? .max)
    }

    return OutlineChapterRows(chapters: ordered, course: course, mark: mark)
  }

  /// A chapter's weeks, with how many of its lessons fit when not all do, or what it's studied
  /// through when none does; "Left out" only when the plan holds nothing of it.
  private func mark(_ chapter: CourseChapter) -> String? {
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

  /// How an area fares: its study time, how many of its lessons fit, and its chapters left out.
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

/// What a chapter none of whose own lessons fit is studied through.
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

/// The week a chapter starts in the example plan, "Week 18"; nil when the plan holds none of it.
/// The weeks a chapter starts only ever go up, while ranges would read as out of order.
private func weekText(_ place: CoursePlanEstimate.ChapterPlace) -> String? {
  place.week.map {
    String(
      localized: "Week \($0)", table: "Courses", comment: "The week a chapter starts in a plan")
  }
}

/// A level's or an area's chapters, a long list showing its first few with the rest one tap away.
private struct OutlineChapterRows: View {
  private static let shown = 6
  /// A list only a little longer shows whole: a fold that hides two chapters saves nothing.
  private static let foldedFrom = shown + 3

  let chapters: [CourseChapter]
  let course: Course
  let mark: (CourseChapter) -> String?

  @State private var showsAll = false

  var body: some View {
    let folds = chapters.count >= Self.foldedFrom

    ForEach(folds && !showsAll ? Array(chapters.prefix(Self.shown)) : chapters) { chapter in
      NavigationLink(value: CourseDestination.chapter(ChapterReference((course, chapter)))) {
        OutlineChapterRow(chapter: chapter, mark: mark(chapter))
      }
    }

    if folds {
      Button {
        showsAll.toggle()
      } label: {
        if showsAll {
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

/// A chapter in the outline: its number across the course, its title, its place in the example
/// plan, and its lessons in one line.
private struct OutlineChapterRow: View {
  let chapter: CourseChapter
  let mark: String?

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(chapter.position + 1, format: .number)
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.tertiary)

      VStack(alignment: .leading, spacing: 4) {
        ViewThatFits(in: .horizontal) {
          HStack(alignment: .firstTextBaseline) {
            title
            Spacer(minLength: 8)
            markText
          }

          VStack(alignment: .leading, spacing: 2) {
            title
            markText
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

  private var title: some View {
    Text(chapter.title)
      .font(.body.weight(.semibold))
  }

  @ViewBuilder
  private var markText: some View {
    if let mark {
      Text(mark)
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.secondary)
    }
  }
}
