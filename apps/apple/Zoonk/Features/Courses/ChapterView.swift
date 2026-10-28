import SwiftUI

/// A chapter's page in the catalog (main's `LibraryChapterPage`), for someone who landed on its
/// topic: the course it belongs to, what the chapter teaches, what Zoonk does with it and the way
/// to start; where it sits in the course and the chapters after it; its lessons, one tap each; what
/// it teaches; and the plan it starts, with the way in again. It reads its course too, which a
/// course page opening it has already.
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
  /// The chapter's course with its outline, once it's read.
  let course: CourseDetail?
  let detail: ChapterDetail

  var body: some View {
    let outline = course?.chapters.sorted { $0.position < $1.position } ?? []
    let index = outline.firstIndex { $0.id == chapter.id }
    let hasLesson = !detail.lessons.isEmpty
    // The course's first chapter, or one whose lessons aren't written yet, starts the course at
    // the reader's level; any other starts the plan here.
    let startsHere = hasLesson && (index ?? chapter.position ?? 0) > 0

    List {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Label {
            Text(chapter.courseTitle)
          } icon: {
            SubjectGlyph(subject: course?.course.subject)
          }
          .font(.subheadline)
          .foregroundStyle(.secondary)

          Text(chapter.title)
            .font(.largeTitle.bold())
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
        .listRowInsets(EdgeInsets())
      }

      if let course, let index, outline.count > 1 {
        ChapterStrip(course: course.course, index: index, outline: outline)
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
        .listRowInsets(EdgeInsets())
      }
    }
    .catalogReadableWidth()
  }
}

/// The chapter's way in: "Build my plan" from this chapter (`startsHere`), or the course's at the
/// reader's level; a chapter whose lessons aren't written yet says its start writes them.
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

/// Where the chapter sits in its course (main's `ChapterStrip`): the course's levels as a meter,
/// each as long as its chapters, this chapter's level in ink, "Chapter 12 of 77 · Beginner" under
/// it, then this chapter and the next ones, one tap each.
private struct ChapterStrip: View {
  private static let next = 3

  let course: Course
  let index: Int
  let outline: [CourseChapter]

  var body: some View {
    let here = outline[index]
    let bands = courseLevelBands(outline)

    Section {
      VStack(alignment: .leading, spacing: 8) {
        MeterParts(
          parts: bands.map { band in
            MeterParts.Part(
              weight: Double(band.chapters.count),
              fill: band.level == here.level ? .color(.primary) : .track)
          }
        )

        Text(
          "Chapter \((index + 1).formatted()) of \(outline.count.formatted()) · \(Text(here.level.localizedTitle))",
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
}

/// The chapter's lessons in order, one tap each, with how long each takes; the header says where
/// the chapter sits, how many lessons it has and how long they take.
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
      HStack(alignment: .firstTextBaseline) {
        Text("Lessons", tableName: "Courses", comment: "Header of a chapter's lessons")
        Spacer()
        Text(facts)
          .monospacedDigit()
      }
    }
  }

  /// "Chapter 1 of 12 · 5 short lessons · 32 min".
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
