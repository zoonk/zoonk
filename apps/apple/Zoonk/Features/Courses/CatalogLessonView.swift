import SwiftUI

/// Main's Library lesson page: its first screen, what it teaches and where the course places it,
/// before the lesson starts.
struct CatalogLessonView: View {
  @Environment(CourseCatalogStore.self) private var catalog

  let lesson: LessonReference

  var body: some View {
    let resource = catalog.lesson(lesson.key)

    Group {
      switch resource.state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      case .loaded(let value):
        CatalogLessonList(lesson: lesson, value: value)
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
    .loads(resource)
  }
}

private struct CatalogLessonList: View {
  @Environment(AppRouter.self) private var router

  let lesson: LessonReference
  let value: CatalogLesson

  var body: some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 12) {
          Text(lesson.chapter.courseTitle)
            .font(.subheadline)
            .foregroundStyle(.secondary)

          Text(value.title)
            .font(.largeTitle.bold())
            .fixedSize(horizontal: false, vertical: true)
            .accessibilityAddTraits(.isHeader)

          if !value.description.isEmpty {
            Text(value.description)
              .font(.title3)
              .foregroundStyle(.secondary)
          }

          if case .text(let text) = value.firstScreen {
            Text(text)
              .font(.title3)
          }
        }
      }
      .listRowBackground(Color.clear)

      if case .choice(let context, let guess, let options, let question) = value.firstScreen {
        Section {
          if let context, !context.isEmpty {
            ItemText(context)
              .foregroundStyle(.secondary)
          }

          ItemText(question)
            .font(.headline)

          ForEach(options) { option in
            Label {
              ItemText(option.text)
            } icon: {
              Image(systemName: "circle.fill")
                .imageScale(.small)
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
            }
          }
        } header: {
          Label {
            if guess {
              Text(
                "Guess first. It doesn't count.", tableName: "Courses",
                comment: "Over a lesson's first question that asks for a guess")
            } else {
              Text(
                "Quick question", tableName: "Courses", comment: "Over a lesson's first question")
            }
          } icon: {
            Image(systemName: "sparkles")
              .accessibilityHidden(true)
          }
        } footer: {
          Text(
            "You answer it as the lesson starts.", tableName: "Courses",
            comment: "Under a lesson's first question, shown before starting it")
        }
      }

      Section {
        Button {
          router.open(.lesson(lessonId: value.id))
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
        Text(
          "\(value.estimatedMinutes) minutes", tableName: "Courses",
          comment: "How long a lesson takes")
      }
      .listRowBackground(Color.clear)

      // Folded, as on main: an idea can answer the first question.
      if !value.summaryIdeas.isEmpty {
        Section {
          DisclosureGroup {
            ForEach(value.summaryIdeas, id: \.self) { CheckLine(text: $0) }
          } label: {
            LabeledContent {
              Text(
                "\(value.summaryIdeas.count) ideas", tableName: "Courses",
                comment: "How many ideas a lesson teaches")
            } label: {
              Text(
                "What you'll learn", tableName: "Courses",
                comment: "Header of what a lesson teaches")
            }
          }
        }
      }

      Section {
        LabeledContent {
          Text(
            "Lesson \(lesson.number) of \(lesson.lessonCount)", tableName: "Courses",
            comment: "A lesson's place in its chapter")
        } label: {
          if let number = lesson.chapterNumber {
            Text(
              "Chapter \(number): \(lesson.chapter.title)", tableName: "Courses",
              comment: "The chapter a lesson is in, with its number")
          } else {
            Text(lesson.chapter.title)
          }
        }
      } header: {
        Text("In this course", tableName: "Courses", comment: "Header of a lesson's place")
      }
    }
  }
}
