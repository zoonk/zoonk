import SwiftUI

/// Main's Library lesson page: its first screen, what it teaches and where the course places it,
/// before the lesson starts.
struct CatalogLessonView: View {
  @Environment(CourseCatalogStore.self) private var catalog

  let lesson: LessonReference

  var body: some View {
    let resource = catalog.lesson(lesson.key)
    // The chapter page that opened this lesson read both already.
    let chapter = catalog.chapter(lesson.chapter.key)
    let course = catalog.course(id: lesson.chapter.courseID)

    Group {
      switch resource.state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      case .loaded(let value):
        CatalogLessonList(
          lesson: lesson, value: value, subject: course.value?.course.subject,
          chapterLessons: chapter.value?.lessons.sorted { $0.position < $1.position } ?? []
        )
        .onAppear {
          UsageAnalytics.track(.publicPageViewed(contentID: lesson.id, page: .lesson))
        }
      case .empty:
        CatalogFailureRecoveryView(context: .lesson, failure: .notFound) {
          await resource.refresh()
        }
      case .failed(let failure):
        CatalogFailureRecoveryView(context: .lesson, failure: failure) {
          await resource.refresh()
        }
      }
    }
    .loads(resource, chapter, course)
  }
}

private struct CatalogLessonList: View {
  @Environment(AppRouter.self) private var router
  @Environment(SessionStore.self) private var session

  let lesson: LessonReference
  let value: CatalogLesson
  let subject: CourseCategory?
  let chapterLessons: [CourseLesson]

  var body: some View {
    ZoonkList {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Label {
            Text(lesson.chapter.courseTitle)
          } icon: {
            SubjectGlyph(subject: subject)
          }
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)

          Text(value.title)
            .typeStyle(.heroTitle)
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)
            .heroTitle()

          if !value.description.isEmpty {
            Text(value.description)
              .typeStyle(.lead)
              .foregroundStyle(.mutedForeground)
          }

          if case .text(let text) = value.firstScreen {
            LessonTextBlocks(text)
              .typeStyle(.section.weight(.regular))
          }
        }
      }
      .listRowBackground(Color.clear)

      if case .choice(let context, let guess, let options, let question) = value.firstScreen {
        Section {
          if let context, !context.isEmpty {
            LessonTextBlocks(context)
              .foregroundStyle(.mutedForeground)
          }

          LessonTextBlocks(question)
            .typeStyle(.body.weight(.semibold))

          ForEach(options) { option in
            Label {
              LessonRichText(option.text)
            } icon: {
              Image(systemName: "circle.fill")
                .imageScale(.small)
                .typeStyle(.small)
                .foregroundStyle(.faint)
                .accessibilityHidden(true)
            }
          }
        } header: {
          Label {
            if guess {
              Text(
                "Just a guess, it doesn't count", tableName: "Courses",
                comment:
                  "Over a lesson's first question on its Library page, which the learner answers before being taught: it's only a guess, and a guess never earns or loses points."
              )
            } else {
              Text(
                "Quick question", tableName: "Courses", comment: "Over a lesson's first question")
            }
          } icon: {
            Image(systemName: "sparkles")
              .accessibilityHidden(true)
          }
          .sectionTitleStyle()
        } footer: {
          SectionFooter {
            Text(
              "You answer it as the lesson starts.", tableName: "Courses",
              comment: "Under a lesson's first question, shown before starting it")
          }
        }
      }

      Section {
        Button {
          router.open(.lesson(lessonId: value.id, fromCatalog: true))
        } label: {
          Group {
            if value.firstScreen == nil {
              Text("Start this lesson", tableName: "Courses", comment: "Starts an unwritten lesson")
            } else {
              Text("Start the lesson", tableName: "Courses", comment: "Starts the lesson")
            }
          }
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      } footer: {
        SectionFooter {
          VStack(alignment: .leading, spacing: 2) {
            Text(
              "\(value.estimatedMinutes) minutes", tableName: "Courses",
              comment: "How long a lesson takes")

            if session.authenticatedSession == nil {
              Text(
                "No sign-up needed.", tableName: "Courses",
                comment: "Under a lesson's length for someone who isn't signed in")
            }
          }
        }
      }
      .listRowBackground(Color.clear)

      // Folded, as on main: an idea can answer the first question.
      if let ideas = value.summary?.ideas.map(\.text) {
        Section {
          DisclosureGroup {
            ForEach(ideas, id: \.self) { idea in CheckLine { LessonRichText(idea) } }
          } label: {
            Text(
              "What you'll learn", tableName: "Courses",
              comment: "Header of what a lesson teaches")
          }
        }
      }

      LessonPlanDay(lesson: lesson, chapterLessons: chapterLessons)
    }
  }
}

/// Main's chapter fold and closing: the chapter's other lessons, then the way into a plan.
private struct LessonPlanDay: View {
  let lesson: LessonReference
  let chapterLessons: [CourseLesson]

  var body: some View {
    if !chapterLessons.isEmpty {
      let minutes = chapterLessons.reduce(0) { $0 + $1.estimatedMinutes }

      Section {
        DisclosureGroup {
          ForEach(Array(chapterLessons.enumerated()), id: \.element.id) { offset, item in
            let row = LabeledContent {
              Text(studyDuration(minutes: item.estimatedMinutes))
                .monospacedDigit()
            } label: {
              Text(item.displayTitle())
            }

            if item.id == lesson.id {
              row.currentRow()
            } else {
              NavigationLink(
                value: CourseDestination.lesson(
                  LessonReference(
                    chapter: lesson.chapter, chapterNumber: lesson.chapterNumber, id: item.id,
                    lessonCount: chapterLessons.count, minutes: item.estimatedMinutes,
                    number: offset + 1, title: item.displayTitle()))
              ) {
                row
              }
            }
          }
        } label: {
          LabeledContent {
            Text(
              "\(chapterLessons.count) lessons\u{00A0}· \(studyDuration(minutes: minutes))",
              tableName: "Courses", comment: "How many lessons a chapter has, and how long")
          } label: {
            Text(
              "Lessons in \(lesson.chapter.title)", tableName: "Courses",
              comment: "Folds the lessons of a lesson's chapter; the argument is the chapter's name"
            )
          }
        }
      }
    }

    // Main's `StartPlanLink`, secondary beside the lesson's own start: past the first chapter
    // the plan starts from this one.
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "Keep going with \(lesson.chapter.courseTitle)", tableName: "Courses",
          comment:
            "Heads the way into a plan on a lesson's Library page; the argument is the course"
        )
        .typeStyle(.section)
        .accessibilityAddTraits(.isHeader)

        PlanLine(start: startsAtChapter ? .chapter : .course)

        CatalogStartActions(
          courseID: lesson.chapter.courseID, chapterID: startsAtChapter ? lesson.chapter.id : nil,
          tryLessonID: nil, isSecondary: true
        )
        .padding(.top, 8)
      }
      .listRowBackground(Color.clear)
    }
  }

  private var startsAtChapter: Bool {
    (lesson.chapterNumber ?? 1) > 1
  }
}
