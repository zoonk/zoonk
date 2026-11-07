import SwiftUI

struct ChapterView: View {
  @Environment(CourseCatalogStore.self) private var catalog
  @State private var isFeedbackPresented = false

  let chapter: ChapterReference

  var body: some View {
    let course = catalog.course(id: chapter.courseID)

    Group {
      switch catalog.chapter(chapter.key).state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
          .accessibilityLabel(
            Text(
              "Loading chapter", tableName: "Courses",
              comment: "Accessibility status while a chapter loads."))
      case .loaded(let detail):
        ChapterLandingList(chapter: chapter, course: course.value, detail: detail)
          .onAppear {
            UsageAnalytics.track(.publicPageViewed(contentID: chapter.id, page: .chapter))
          }
      case .empty:
        ChapterLandingList(
          chapter: chapter, course: course.value, detail: ChapterDetail(chapter: nil, lessons: []))
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .chapter, failure: failure) {
          await catalog.chapter(chapter.key).refresh()
        }
      }
    }
    .loads(catalog.chapter(chapter.key), course)
    .toolbar {
      CatalogOptionsMenu(
        label: LocalizedStringResource(
          "Chapter options", table: "Courses", comment: "The chapter page's menu of options"),
        showFeedback: { isFeedbackPresented = true })
    }
    .feedbackSheet(
      isPresented: $isFeedbackPresented,
      context: FeedbackContext(contentID: chapter.id, contentKind: .chapter))
  }
}

private struct ChapterLandingList: View {
  let chapter: ChapterReference
  let course: CourseDetail?
  let detail: ChapterDetail

  var body: some View {
    // As on main's wide page: the lessons under the chapter, what it teaches beside them.
    PaneSplit {
      ZoonkList {
        header
        lessons
      }
    } secondary: {
      ZoonkList {
        strip
        learnAndStart
      }
    } single: {
      ZoonkList {
        header
        strip
        lessons
        learnAndStart
      }
    }
  }

  private var outline: [CourseChapter] {
    course?.chapters.sorted { $0.position < $1.position } ?? []
  }

  private var index: Int? {
    outline.firstIndex { $0.id == chapter.id }
  }

  private var areas: [String: String]? {
    course?.course.examplePlan?.chapterAreas
  }

  private var hasLesson: Bool {
    !detail.lessons.isEmpty
  }

  /// The course's first chapter, or one whose lessons aren't written yet, starts the course at the
  /// reader's level.
  private var startsHere: Bool {
    hasLesson && (index ?? chapter.position ?? 0) > 0
  }

  private var header: some View {
    Section {
      VStack(alignment: .leading, spacing: 12) {
        Label {
          Text(
            areas?[chapter.id].map { "\(chapter.courseTitle)\u{00A0}· \($0)" }
              ?? chapter.courseTitle)
        } icon: {
          SubjectGlyph(subject: course?.course.subject)
        }
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)

        Text(chapter.title)
          .typeStyle(.heroTitle)
          .fixedSize(horizontal: false, vertical: true)
          .accessibilityAddTraits(.isHeader)
          .heroTitle()

        if let description = catalogText(detail.chapter?.description ?? chapter.description) {
          Text(description)
            .typeStyle(.lead)
            .foregroundStyle(.mutedForeground)
        }

        PlanLine(startsHere: startsHere)

        ChapterStart(
          chapter: chapter, hasLesson: hasLesson, startsHere: startsHere,
          tryLessonID: detail.tryLessonID
        )
        .padding(.top, 4)
      }
      .listRowBackground(Color.clear)
    }
  }

  @ViewBuilder
  private var strip: some View {
    if let course, let index, outline.count > 1 {
      ChapterStrip(areas: areas, course: course.course, index: index, outline: outline)
    }
  }

  @ViewBuilder
  private var lessons: some View {
    if hasLesson {
      ChapterLessonsSection(
        chapter: chapter, lessons: detail.lessons.sorted { $0.position < $1.position },
        number: index.map { $0 + 1 }, total: outline.count)
    }
  }

  @ViewBuilder
  private var learnAndStart: some View {
    if let objectives = detail.chapter?.objectives, !objectives.isEmpty {
      Section {
        ForEach(objectives, id: \.self) { CheckLine(text: $0) }
      } header: {
        SectionTitle(
          Text(
            "What you'll learn", tableName: "Courses", comment: "Header of what a chapter teaches"))
      }
    }

    Section {
      VStack(alignment: .leading, spacing: 8) {
        Group {
          if startsHere {
            Text(
              "Your plan from this chapter", tableName: "Courses",
              comment: "A chapter page's last call, when the plan starts there")
          } else {
            Text(
              "Start today, at your level", tableName: "Courses",
              comment: "A course page's last call")
          }
        }
        .typeStyle(.section)
        .accessibilityAddTraits(.isHeader)

        Group {
          if startsHere {
            Text(
              "It follows the course from here, at your pace, with reviews before you forget.",
              tableName: "Courses", comment: "Under a chapter page's last call")
          } else {
            Text(
              "A few quick questions, then your plan and your first lesson.",
              tableName: "Courses", comment: "Under a course page's last call")
          }
        }
        .foregroundStyle(.mutedForeground)

        ChapterStart(
          chapter: chapter, hasLesson: hasLesson, startsHere: startsHere, tryLessonID: nil
        )
        .padding(.top, 8)
      }
      .listRowBackground(Color.clear)
    }
  }
}

private struct ChapterStart: View {
  let chapter: ChapterReference
  let hasLesson: Bool
  let startsHere: Bool
  let tryLessonID: String?

  var body: some View {
    CatalogStartActions(
      courseID: chapter.courseID, chapterID: startsHere ? chapter.id : nil,
      tryLessonID: tryLessonID,
      note: hasLesson
        ? nil
        : Text(
          "Start here and Zoonk writes its lessons for your level.", tableName: "Courses",
          comment: "Under a chapter's start when its lessons aren't written yet"))
  }
}

/// Main's `ChapterStrip`: the course's parts on one bar with this chapter's station, then this
/// chapter and the next ones on the course's line.
private struct ChapterStrip: View {
  private static let next = 3

  @Environment(\.colorSchemeContrast) private var contrast

  let areas: [String: String]?
  let course: Course
  let index: Int
  let outline: [CourseChapter]

  var body: some View {
    let here = outline[index]
    let groups = stripGroups
    let group = groups.first { $0.chapters.contains { $0.id == here.id } }
    let counted = areas != nil ? group?.chapters ?? outline : outline
    let number = (counted.firstIndex { $0.id == here.id } ?? index) + 1

    let colors = SubjectColors(course.subject)
    let line = contrast == .increased ? colors.mark : colors.mark.opacity(0.35)
    let stretch = [here] + outline.dropFirst(index + 1).prefix(Self.next)

    Section {
      Text(
        "Where this chapter sits in the course", tableName: "Courses",
        comment: "Header of where a chapter sits in its course"
      )
      .typeStyle(.section)
      .foregroundStyle(Color(.foreground))
      .accessibilityAddTraits(.isHeader)
      .listRowSeparator(.hidden)

      VStack(alignment: .leading, spacing: 10) {
        CourseMapBar(
          parts: groups.map { item in
            CourseMapBar.Part(
              id: item.id, count: item.chapters.count,
              here: item.chapters.firstIndex { $0.id == here.id })
          }, line: line)

        Text(
          "Chapter \(number.formatted()) of \(counted.count.formatted())\u{00A0}· \(group?.label ?? "")",
          tableName: "Courses", comment: "Where a chapter sits in its course, and its level"
        )
        .typeStyle(.meta)
        .foregroundStyle(.mutedForeground)
      }
      .padding(.vertical, 4)
      .accessibilityElement(children: .combine)
      .listRowSeparator(.hidden)

      ForEach(Array(stretch.enumerated()), id: \.element.id) { offset, chapter in
        let stop = ChapterRouteStop(
          label: offset == 0
            ? Text(
              "This chapter", tableName: "Courses", comment: "Marks the open chapter in its course")
            : offset == 1
              ? Text(
                "After this chapter", tableName: "Courses",
                comment: "Over the chapter that comes after the open one")
              : nil,
          title: Text(chapter.title), isHere: offset == 0, isLast: offset == stretch.count - 1,
          line: line, stop: colors.mark)

        Group {
          if offset == 0 {
            stop
          } else {
            NavigationLink(value: CourseDestination.chapter(ChapterReference((course, chapter)))) {
              stop
            }
          }
        }
        .listRowInsets(.vertical, 0)
        .listRowSeparator(.hidden)
      }
    }
  }

  private struct StripGroup {
    let chapters: [CourseChapter]
    let id: String
    let label: String
  }

  private var stripGroups: [StripGroup] {
    guard let areas else {
      return courseLevelBands(outline).map {
        StripGroup(
          chapters: $0.chapters, id: $0.level.rawValue,
          label: String(localized: $0.level.localizedTitle))
      }
    }

    var groups: [StripGroup] = []

    for chapter in outline {
      let area = areas[chapter.id] ?? ""

      if let at = groups.firstIndex(where: { $0.id == area }) {
        groups[at] = StripGroup(
          chapters: groups[at].chapters + [chapter], id: area, label: area)
      } else {
        groups.append(StripGroup(chapters: [chapter], id: area, label: area))
      }
    }

    return groups
  }
}

private struct ChapterLessonsSection: View {
  let chapter: ChapterReference
  let lessons: [CourseLesson]
  let number: Int?
  let total: Int

  var body: some View {
    Section {
      ForEach(Array(lessons.enumerated()), id: \.element.id) { offset, lesson in
        NavigationLink(
          value: CourseDestination.lesson(
            LessonReference(
              chapter: chapter, chapterNumber: number, id: lesson.id, lessonCount: lessons.count,
              minutes: lesson.estimatedMinutes, number: offset + 1, title: lesson.displayTitle()))
        ) {
          LabeledContent {
            Text(studyDuration(minutes: lesson.estimatedMinutes))
              .monospacedDigit()
          } label: {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
              Text(offset + 1, format: .number)
                .typeStyle(.data)
                .foregroundStyle(.faint)
              Text(lesson.displayTitle())
                .foregroundStyle(.primary)
            }
          }
        }
      }
    } header: {
      SectionTitle(Text("Lessons", tableName: "Courses", comment: "Header of a chapter's lessons"))
      {
        Text(facts)
      }
    }
  }

  private var facts: String {
    let lessonsText = String(
      localized: "\(lessons.count) short lessons", table: "Courses",
      comment: "How many lessons a course or a chapter has")
    let minutes = catalogDurationText(minutes: lessons.reduce(0) { $0 + $1.estimatedMinutes })
    let position = number.map {
      String(
        localized: "Chapter \($0.formatted()) of \(total.formatted())", table: "Courses",
        comment: "Where a chapter sits in its course")
    }

    return [position, lessonsText, minutes].compactMap(\.self).joinedFacts()
  }
}

/// Main's `CourseMap`: one bar per part of the course, as wide as its chapters, with the course's
/// line through them and this chapter's station on it.
private struct CourseMapBar: View {
  struct Part: Identifiable {
    let id: String
    let count: Int
    /// This chapter's place in the part, when it's in it.
    let here: Int?
  }

  let parts: [Part]
  let line: Color

  // Main's map keeps its size while the words around it grow.
  private let height: CGFloat = 28
  private let stationSize: CGFloat = 14

  private static let spacing: CGFloat = 4

  var body: some View {
    let total = max(parts.reduce(0) { $0 + $1.count }, 1)

    GeometryReader { proxy in
      let room = proxy.size.width - Self.spacing * CGFloat(max(parts.count - 1, 0))

      HStack(spacing: Self.spacing) {
        ForEach(parts) { part in
          let width = room * CGFloat(part.count) / CGFloat(total)

          ZStack(alignment: .leading) {
            Rectangle()
              .fill(line)
              .frame(height: 4)

            if let here = part.here {
              RouteStation(isHere: true, color: line, fill: Color(.ground))
                .frame(width: stationSize, height: stationSize)
                .offset(
                  x: 4 + (width - 8) * (CGFloat(here) + 0.5) / CGFloat(part.count) - stationSize / 2
                )
            }
          }
          .frame(width: width, height: height)
          .background(Color(.ground), in: .rect(cornerRadius: Radius.sm, style: .continuous))
        }
      }
    }
    .frame(height: height)
    .accessibilityHidden(true)
  }
}

/// A station on the course's line: this chapter as an ink ring, a stop as a ring in the subject's
/// color.
private struct RouteStation: View {
  let isHere: Bool
  let color: Color
  /// What it sits on, so the line doesn't show through it: the page, or the map's bar.
  var fill = Color(.systemBackground)

  var body: some View {
    Circle()
      .strokeBorder(isHere ? Color(.foreground) : color, lineWidth: isHere ? 3 : 2.5)
      .background(Circle().fill(fill))
  }
}

private struct StationAnchorKey: PreferenceKey {
  static let defaultValue: Anchor<CGPoint>? = nil

  static func reduce(value: inout Anchor<CGPoint>?, nextValue: () -> Anchor<CGPoint>?) {
    value = value ?? nextValue()
  }
}

/// Main's route stop on the chapter strip: its station on the first line of its words, and the
/// line running from it to the next stop, fading out after the last.
private struct ChapterRouteStop: View {
  let label: Text?
  let title: Text
  let isHere: Bool
  let isLast: Bool
  let line: Color
  let stop: Color

  // Main's stations keep their size; the line stays on the words' first line as they grow.
  private let pageSize: CGFloat = 16
  private let stopSize: CGFloat = 14

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      RouteStation(isHere: isHere, color: stop)
        .frame(width: isHere ? pageSize : stopSize, height: isHere ? pageSize : stopSize)
        .frame(width: pageSize)
        // On the middle of the first line rather than its baseline.
        .alignmentGuide(.firstTextBaseline) { $0[VerticalAlignment.center] + 4 }
        .anchorPreference(key: StationAnchorKey.self, value: .center) { $0 }

      VStack(alignment: .leading, spacing: 2) {
        if let label {
          label
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }

        title
          .typeStyle(isHere ? .rowTitle.weight(.semibold) : .rowTitle)
          .foregroundStyle(Color(.foreground))
      }
    }
    .padding(.vertical, 10)
    .frame(maxWidth: .infinity, alignment: .leading)
    .backgroundPreferenceValue(StationAnchorKey.self) { anchor in
      GeometryReader { proxy in
        if let anchor {
          let center = proxy[anchor]
          // Past the row's edges, over the hairline's room a hidden separator keeps between rows.
          let overlap: CGFloat = 2
          let top = isHere ? center.y : -overlap

          VStack(spacing: 0) {
            Rectangle()
              .fill(line)
              .frame(height: max(center.y - top, 0))

            Rectangle()
              .fill(
                isLast
                  ? AnyShapeStyle(
                    LinearGradient(
                      colors: [line, line.opacity(0)], startPoint: .top, endPoint: .bottom))
                  : AnyShapeStyle(line)
              )
              .frame(height: max(proxy.size.height - center.y + (isLast ? 0 : overlap), 0))
          }
          .frame(width: 4)
          .offset(x: center.x - 2, y: top)
        }
      }
      .accessibilityHidden(true)
    }
  }
}
