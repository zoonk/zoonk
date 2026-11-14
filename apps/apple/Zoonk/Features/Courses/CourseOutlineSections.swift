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
/// way no level opens, so none closes under them.
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
  /// Places an exam course's chapters in its subjects.
  let estimate: CoursePlanEstimate?
  let lead: String?
  let learner: OutlineLearner
  @Binding var disclosures: CourseOutlineDisclosures

  var body: some View {
    let chapters = detail.chapters.sorted { $0.position < $1.position }
    let areaOf = Dictionary(
      (estimate?.chapters ?? []).compactMap { place in place.area.map { (place.chapterID, $0) } },
      uniquingKeysWith: { first, _ in first })

    Section {
      if let lead {
        Text(lead)
      }

      if chapters.isEmpty {
        Label {
          Text(
            "Build your plan and Zoonk gets this course's lessons ready, starting from what you already know.",
            tableName: "Courses", comment: "A course outline before its chapters are written")
        } icon: {
          Image(systemName: "sparkles")
            .foregroundStyle(.mutedForeground)
            .accessibilityHidden(true)
        }
      }
    } header: {
      SectionTitle(
        Text("Course outline", tableName: "Courses", comment: "Header of a course's outline")
      ) {
        if let size = sizeText(chapters) {
          Text(size)
        }
      }
    }

    if case .byDate(let areas) = estimate?.reach, !chapters.isEmpty {
      CourseAreaOutline(
        areaOf: areaOf, areas: areas, chapters: chapters, course: detail.course, learner: learner,
        disclosures: $disclosures)
    } else if !chapters.isEmpty {
      let bands = courseLevelBands(chapters)

      ForEach(detail.course.levels, id: \.self) { level in
        if let band = bands.first(where: { $0.level == level }) {
          CourseLevelOutline(
            band: band, course: detail.course, learner: learner,
            isOpen: learner.opens(level, isFirst: level == bands.first?.level),
            disclosures: $disclosures)
        } else {
          UnwrittenLevel(level: level, isHere: learner.isHere(level: level))
        }
      }
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
      localized: "\(lessons.count) short lessons", table: "Courses",
      comment: "How many lessons a course or a chapter has")
    return [chapterText, lessonText].joinedFacts()
  }
}

private struct CourseLevelOutline: View {
  private static let named = 3

  let band: CourseLevelBand
  let course: Course
  let learner: OutlineLearner
  let isOpen: Bool
  @Binding var disclosures: CourseOutlineDisclosures

  var body: some View {
    let key = "level:\(band.level)"
    let isExpanded = $disclosures.isExpanded(key, otherwise: isOpen)

    Section {
      OutlineDisclosure(isExpanded: isExpanded) {
        OutlineChapterRows(
          chapters: band.chapters, course: course, learner: learner,
          disclosures: $disclosures, key: key)
      } label: {
        VStack(alignment: .leading, spacing: 2) {
          LabeledContent {
            Text(
              "\(band.chapters.count) chapters", tableName: "Courses",
              comment: "How many chapters a course or an exam area has"
            )
            .typeStyle(.data)
          } label: {
            LevelTitle(level: band.level, isHere: learner.isHere(level: band.level))
          }

          if !isExpanded.wrappedValue {
            Text(band.chapters.prefix(Self.named).map(\.title).joinedFacts())
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
        .accessibilityElement(children: .combine)
      }
    }
  }
}

/// A `DisclosureGroup` in a list indents what it opens, where main's outline keeps its chapters on
/// the page margin; so the label row opens and closes the rows after it.
private struct OutlineDisclosure<Label: View, Content: View>: View {
  @Binding var isExpanded: Bool
  @ViewBuilder let content: Content
  @ViewBuilder let label: Label

  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    Button {
      withAnimation(reduceMotion ? nil : .default) {
        isExpanded.toggle()
      }
    } label: {
      HStack(spacing: 12) {
        label
          .frame(maxWidth: .infinity, alignment: .leading)

        DisclosureChevron(pointsDown: isExpanded)
      }
    }
    .accessibilityValue(
      isExpanded
        ? Text("Expanded", tableName: "Courses", comment: "VoiceOver: a level's chapters are shown")
        : Text(
          "Collapsed", tableName: "Courses", comment: "VoiceOver: a level's chapters are hidden"))

    if isExpanded {
      content
    }
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
          "Ready when you get there.", tableName: "Courses",
          comment:
            "Under the name of a course's level, such as Intermediate, whose chapters aren't ready yet"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
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
      .typeStyle(.body.weight(.semibold))
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
    .typeStyle(.note)
    .foregroundStyle(.successText)
  }
}

/// A chapter the estimate can't place in an area yet isn't listed. Chapters keep the course's order.
private struct CourseAreaOutline: View {
  private static let named = 3

  let areaOf: [String: String]
  let areas: [String]
  let chapters: [CourseChapter]
  let course: Course
  let learner: OutlineLearner
  @Binding var disclosures: CourseOutlineDisclosures

  var body: some View {
    let names = areas.reduce(into: [String]()) { names, name in
      if !names.contains(name), chapters.contains(where: { areaOf[$0.id] == name }) {
        names.append(name)
      }
    }

    if names.count <= 1 {
      Section {
        OutlineChapterRows(
          chapters: chapters, course: course, learner: learner, disclosures: $disclosures,
          key: "areas")
      }
    } else {
      ForEach(names, id: \.self) { name in
        let areaChapters = chapters.filter { areaOf[$0.id] == name }
        let key = "area:\(name)"
        let isExpanded = $disclosures.isExpanded(
          key,
          otherwise: name == names.first || learner.unfolds(areaChapters.map(\.id)))

        Section {
          OutlineDisclosure(isExpanded: isExpanded) {
            OutlineChapterRows(
              chapters: areaChapters, course: course, learner: learner,
              disclosures: $disclosures, key: key)
          } label: {
            VStack(alignment: .leading, spacing: 2) {
              LabeledContent {
                Text(
                  "\(areaChapters.count) chapters", tableName: "Courses",
                  comment: "How many chapters a course or an exam area has"
                )
                .typeStyle(.data)
              } label: {
                Text(name)
                  .typeStyle(.body.weight(.semibold))
              }

              if !isExpanded.wrappedValue {
                Text(areaChapters.prefix(Self.named).map(\.title).joinedFacts())
                  .typeStyle(.note)
                  .foregroundStyle(.mutedForeground)
              }
            }
            .accessibilityElement(children: .combine)
          }
        }
      }
    }
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

  var body: some View {
    let folds = chapters.count >= Self.foldedFrom
    let showsAll = $disclosures.isShowingAll(
      key, otherwise: learner.unfolds(chapters.dropFirst(Self.shown).map(\.id)))

    ForEach(folds && !showsAll.wrappedValue ? Array(chapters.prefix(Self.shown)) : chapters) {
      chapter in
      NavigationLink(value: CourseDestination.chapter(ChapterReference((course, chapter)))) {
        OutlineChapterRow(chapter: chapter, isHere: learner.isHere(chapterID: chapter.id))
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

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(chapter.position + 1, format: .number)
        .typeStyle(.data)
        .foregroundStyle(.faint)

      VStack(alignment: .leading, spacing: 4) {
        Text(chapter.title)
          .typeStyle(.body.weight(.semibold))

        if isHere {
          YouAreHere()
        }

        if !chapter.lessons.isEmpty {
          Text(chapter.lessons.map(\.title).joinedFacts())
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
  }
}
