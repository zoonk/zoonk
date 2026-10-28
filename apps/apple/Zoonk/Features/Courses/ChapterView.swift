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
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(
        api: FeedbackAPI.live(),
        context: FeedbackContext(contentID: chapter.id, contentKind: .chapter))
    }
  }
}

private struct ChapterLandingList: View {
  let chapter: ChapterReference
  let course: CourseDetail?
  let detail: ChapterDetail

  var body: some View {
    PaneSplit {
      List {
        header
      }
    } secondary: {
      List {
        contents
      }
    } single: {
      List {
        header
        contents
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
          Text(areas?[chapter.id].map { "\(chapter.courseTitle) · \($0)" } ?? chapter.courseTitle)
        } icon: {
          SubjectGlyph(subject: course?.course.subject)
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)

        Text(chapter.title)
          .font(.largeTitle.bold())
          .fixedSize(horizontal: false, vertical: true)
          .accessibilityAddTraits(.isHeader)

        if let description = catalogText(detail.chapter?.description ?? chapter.description) {
          Text(description)
            .font(.title3)
            .foregroundStyle(.secondary)
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
  private var contents: some View {
    if let course, let index, outline.count > 1 {
      ChapterStrip(areas: areas, course: course.course, index: index, outline: outline)
    }

    if hasLesson {
      ChapterLessonsSection(
        lessons: detail.lessons.sorted { $0.position < $1.position },
        number: index.map { $0 + 1 }, total: outline.count)
    }

    if let objectives = detail.chapter?.objectives, !objectives.isEmpty {
      Section {
        ForEach(objectives, id: \.self) { CheckLine(text: $0) }
      } header: {
        Text(
          "What you'll learn", tableName: "Courses", comment: "Header of what a chapter teaches")
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
        .font(.title2.weight(.semibold))
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
        .foregroundStyle(.secondary)

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

private struct ChapterStrip: View {
  private static let next = 3

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

    Section {
      VStack(alignment: .leading, spacing: 8) {
        MeterParts(
          parts: groups.map { item in
            MeterParts.Part(
              weight: Double(item.chapters.count),
              fill: item.id == group?.id ? .color(.primary) : .track)
          }
        )

        Text(
          "Chapter \(number.formatted()) of \(counted.count.formatted()) · \(group?.label ?? "")",
          tableName: "Courses", comment: "Where a chapter sits in its course, and its level"
        )
        .font(.footnote.monospacedDigit())
        .foregroundStyle(.secondary)
      }
      .padding(.vertical, 4)

      LabeledContent {
        Text("This chapter", tableName: "Courses", comment: "Marks the open chapter in its course")
      } label: {
        Text(here.title)
          .fontWeight(.semibold)
      }

      ForEach(outline.dropFirst(index + 1).prefix(Self.next)) { chapter in
        NavigationLink(value: CourseDestination.chapter(ChapterReference((course, chapter)))) {
          Text(chapter.title)
        }
      }
    } header: {
      Text(
        "Where this chapter sits in the course", tableName: "Courses",
        comment: "Header of where a chapter sits in its course")
    }
  }

  private struct Group {
    let chapters: [CourseChapter]
    let id: String
    let label: String
  }

  private var stripGroups: [Group] {
    guard let areas else {
      return courseLevelBands(outline).map {
        Group(
          chapters: $0.chapters, id: $0.level.rawValue,
          label: String(localized: $0.level.localizedTitle))
      }
    }

    var groups: [Group] = []

    for chapter in outline {
      let area = areas[chapter.id] ?? ""

      if let at = groups.firstIndex(where: { $0.id == area }) {
        groups[at] = Group(chapters: groups[at].chapters + [chapter], id: area, label: area)
      } else {
        groups.append(Group(chapters: [chapter], id: area, label: area))
      }
    }

    return groups
  }
}

private struct ChapterLessonsSection: View {
  @Environment(AppRouter.self) private var router

  let lessons: [CourseLesson]
  let number: Int?
  let total: Int

  var body: some View {
    Section {
      ForEach(Array(lessons.enumerated()), id: \.element.id) { offset, lesson in
        Button {
          router.open(.lesson(lessonId: lesson.id))
        } label: {
          LabeledContent {
            Text(studyDuration(minutes: lesson.estimatedMinutes))
              .monospacedDigit()
          } label: {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
              Text(offset + 1, format: .number)
                .font(.footnote.monospacedDigit())
                .foregroundStyle(.tertiary)
              Text(lesson.displayTitle())
                .foregroundStyle(.primary)
            }
          }
        }
      }
    } header: {
      CatalogSectionHeader {
        Text("Lessons", tableName: "Courses", comment: "Header of a chapter's lessons")
      } detail: {
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

    return [position, lessonsText, minutes].compactMap(\.self).joined(separator: " · ")
  }
}
