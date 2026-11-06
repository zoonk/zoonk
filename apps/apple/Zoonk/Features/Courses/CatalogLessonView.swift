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
            LabeledContent {
              Text(
                "\(ideas.count) ideas", tableName: "Courses",
                comment: "How many ideas a lesson teaches")
            } label: {
              Text(
                "What you'll learn", tableName: "Courses",
                comment: "Header of what a lesson teaches")
            }
          }
        }
      }

      LessonPlanDay(lesson: lesson, chapterLessons: chapterLessons)
    }
  }
}

/// Main's `LessonPlanDay`: the course this lesson belongs to, as a day of its plan would hold it
/// (the lesson before, this one, the next).
private struct LessonPlanDay: View {
  private static let dayLessons = 3

  let lesson: LessonReference
  let chapterLessons: [CourseLesson]

  var body: some View {
    let index = chapterLessons.firstIndex { $0.id == lesson.id }

    if let index {
      let start = max(0, min(index - 1, chapterLessons.count - Self.dayLessons))
      let day = Array(chapterLessons[start..<min(start + Self.dayLessons, chapterLessons.count)])
      let minutes = day.reduce(0) { $0 + $1.estimatedMinutes }

      Section {
        Text(
          "This lesson is part of the \(lesson.chapter.courseTitle) course.", tableName: "Courses",
          comment: "Heads a lesson's example plan on its Library page; the argument is the course"
        )
        .typeStyle(.section)
        .foregroundStyle(Color(.foreground))
        .accessibilityAddTraits(.isHeader)
        .listRowSeparator(.hidden)
      }

      Section {
        ForEach(Array(day.enumerated()), id: \.element.id) { offset, item in
          let position = start + offset
          let isDone = position < index

          ListRow(
            Text(item.displayTitle()),
            description: isDone ? nil : Text(lesson.chapter.title)
          ) {
            if isDone {
              StatusMark(status: .done)
            } else {
              KindMark(kind: .lesson)
            }
          } trailing: {
            Text(studyDuration(minutes: item.estimatedMinutes))
          }
          .accessibilityElement(children: .combine)
          .currentRow(position == index)
        }
      } header: {
        SectionTitle(
          Text(
            "Example plan", tableName: "Courses", comment: "Heads a lesson's example day of a plan")
        ) {
          Text(
            "\(day.count) lessons\u{00A0}· \(studyDuration(minutes: minutes))",
            tableName: "Courses",
            comment: "How many lessons an example plan's first day has, and how long")
        }
      } footer: {
        SectionFooter {
          Text(
            "An example. Your plan follows your answers, so it can start later and end sooner.",
            tableName: "Courses", comment: "Under a lesson's example plan")
        }
      }

      // Main's `StartPlanLink`, secondary beside the lesson's own start: past the first chapter
      // the plan starts from this one.
      Section {
        CatalogStartActions(
          courseID: lesson.chapter.courseID,
          chapterID: (lesson.chapterNumber ?? 1) > 1 ? lesson.chapter.id : nil,
          tryLessonID: nil, isSecondary: true)
      }
      .listRowSeparator(.hidden)
    }
  }
}
