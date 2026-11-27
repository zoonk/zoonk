import SwiftUI

struct SavedLessonsScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Group {
      if let goal = learner.summary.value?.shownGoal {
        SavedLessonsList(goalId: goal.id)
          .id(goal.id)
      } else {
        ProgressView()
          .lonePage()
      }
    }
    .barTitleAfterHero(
      String(
        localized: "Saved lessons", table: "SavedLessons",
        comment: "Title of the page listing the lessons the learner saved to do again"))
  }
}

/// Newest save first, the lessons that open, then those that can't anymore. A row whose bookmark
/// the learner tapped keeps its place until they leave the page.
private struct SavedLessonsList: View {
  @Environment(SavedLessonsStore.self) private var store
  @State private var kept = KeptRows<SavedLesson>()
  @State private var shownCount = Self.pageSize

  let goalId: String

  private static let pageSize = 50

  var body: some View {
    let lessons = store.lessons(goalId: goalId)

    content(lessons)
      .loads(lessons)
      .lessonSaveFailureAlert(goalId: goalId)
      .onDisappear {
        kept = KeptRows()
      }
  }

  @ViewBuilder
  private func content(_ lessons: Resource<[SavedLesson]>) -> some View {
    switch lessons.state {
    case .loaded(let read):
      let open = kept.rows(
        read.filter { $0.available && store.saves.isSaved($0.lessonId, server: true) })
      let gone = read.filter { !$0.available && store.saves.isSaved($0.lessonId, server: true) }

      if open.isEmpty, gone.isEmpty {
        StateMessage {
          Label {
            Text(
              "Nothing saved yet", tableName: "SavedLessons",
              comment: "Title when the learner hasn't saved a lesson for this goal")
          } icon: {
            Image(systemName: "bookmark")
          }
        } description: {
          Text(
            "Tap the bookmark on a lesson to keep it here.", tableName: "SavedLessons",
            comment: "Explains how a lesson gets on the saved lessons page, before there's any")
        }
        .lonePage()
      } else {
        ZoonkList {
          Section {
            PageHeader(
              Text(
                "Saved lessons", tableName: "SavedLessons",
                comment: "Title of the page listing the lessons the learner saved to do again"))
          }

          Section {
            ForEach(open.prefix(shownCount)) { lesson in
              SavedLessonRow(
                lesson: lesson, goalId: goalId,
                isListed: read.contains { $0.lessonId == lesson.lessonId }
              ) {
                kept.keep(lesson, shown: open)
              }
            }

            if open.count > shownCount {
              Button {
                shownCount += Self.pageSize
              } label: {
                Text(
                  "Show more", tableName: "SavedLessons",
                  comment: "Shows the next saved lessons of a long list")
              }
            }
          }

          if !gone.isEmpty {
            Section {
              ForEach(gone) { lesson in
                UnavailableSaveRow(
                  title: lesson.title,
                  remove: Text(
                    "Remove", tableName: "SavedLessons",
                    comment: "Takes a saved lesson that can't open anymore off the list")
                ) {
                  store.saves.set(
                    false,
                    LessonSaveTarget(
                      lessonId: lesson.lessonId, title: lesson.title,
                      chapterTitle: lesson.chapterTitle),
                    goalId: goalId)
                } detail: {
                  EmptyView()
                }
              }
            } header: {
              SectionTitle(
                Text(
                  "No longer available", tableName: "SavedLessons",
                  comment: "Saved lessons that can't open anymore"))
            }
          }
        }
        .lonePage()
      }
    case .failed(let error):
      PracticeLoadFailureView(error: error) {
        Task { await lessons.refresh() }
      }
    case .empty, .idle, .loading:
      ProgressView()
        .lonePage()
    }
  }
}

/// Opens the lesson; its bookmark takes it out and back, the row staying where it is.
private struct SavedLessonRow: View {
  @Environment(AppRouter.self) private var router

  let lesson: SavedLesson
  let goalId: String
  /// The last read lists it: a row kept after its removal isn't.
  let isListed: Bool
  let keep: () -> Void

  var body: some View {
    Button {
      router.open(.lesson(lessonId: lesson.lessonId))
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Text(lesson.title)
          .foregroundStyle(.primary)

        if let chapterTitle = lesson.chapterTitle {
          Text(chapterTitle)
            .typeStyle(.note)
            .foregroundStyle(.mutedForeground)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .savesLesson(
      LessonSaveTarget(
        lessonId: lesson.lessonId, title: lesson.title, chapterTitle: lesson.chapterTitle),
      goalId: goalId, server: isListed, keep: keep)
  }
}
