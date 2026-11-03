import SwiftUI

struct CompletedLessonsScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(CompletedLessonsStore.self) private var store

  var body: some View {
    Group {
      if let goal = learner.summary.value?.shownGoal {
        let lessons = store.lessons(goalId: goal.id)

        content(lessons, goalId: goal.id)
          .id(goal.id)
          .loads(lessons)
      } else {
        ProgressView()
          .lonePage()
      }
    }
    .navigationTitle(
      Text(
        "Completed lessons", tableName: "CompletedLessons",
        comment: "Title of the page listing the lessons the learner finished"))
  }

  @ViewBuilder
  private func content(_ lessons: Resource<CompletedLessonsPage>, goalId: String) -> some View {
    switch lessons.state {
    case .loaded(let page):
      List {
        ForEach(days(page.lessons)) { day in
          Section {
            ForEach(day.lessons) { lesson in
              CompletedLessonRow(lesson: lesson)
            }
          } header: {
            Text(day.title)
          }
        }

        if let cursor = page.nextCursor {
          NextPageRow(failure: store.loadMoreFailures[goalId]) {
            await store.loadMore(goalId: goalId)
          }
          // Again for each page that lands while the row still shows, and once a refresh ends.
          .task(id: NextPageTrigger(cursor: cursor, isRefreshing: lessons.isRefreshing)) {
            guard !lessons.isRefreshing else {
              return
            }

            await store.loadMore(goalId: goalId)
          }
        }
      }
      .lonePage()
    case .empty:
      ContentUnavailableView {
        Label {
          Text(
            "No completed lessons yet", tableName: "CompletedLessons",
            comment: "Title when the learner hasn't finished a lesson for this goal")
        } icon: {
          Image(systemName: "clock.arrow.circlepath")
        }
      } description: {
        Text(
          "Lessons you finish show up here, so you can do them again anytime.",
          tableName: "CompletedLessons",
          comment: "Explains what the completed lessons page lists, before there's any")
      }
      .lonePage()
    case .failed(let error):
      PracticeLoadFailureView(error: error) {
        Task { await lessons.refresh() }
      }
    case .idle, .loading:
      ProgressView()
        .lonePage()
    }
  }

  private func days(_ lessons: [CompletedLesson]) -> [CompletedLessonsDay] {
    let timeZone = learner.summary.value?.timeZone.flatMap(TimeZone.init(identifier:)) ?? .current
    var order: [String] = []
    var byDay: [String: [CompletedLesson]] = [:]

    for lesson in lessons {
      if byDay[lesson.finishedOn] == nil {
        order.append(lesson.finishedOn)
      }

      byDay[lesson.finishedOn, default: []].append(lesson)
    }

    return order.map { day in
      CompletedLessonsDay(
        id: day, title: completedLessonsDayTitle(day, timeZone: timeZone),
        lessons: byDay[day] ?? [])
    }
  }
}

private struct CompletedLessonsDay: Identifiable {
  let id: String
  let title: String
  let lessons: [CompletedLesson]
}

private struct CompletedLessonRow: View {
  @Environment(AppRouter.self) private var router

  let lesson: CompletedLesson

  var body: some View {
    Button {
      router.open(.lesson(lessonId: lesson.lessonId))
    } label: {
      VStack(alignment: .leading, spacing: 2) {
        Text(lesson.title)
          .foregroundStyle(.primary)

        if let chapterTitle = lesson.chapterTitle {
          Text(chapterTitle)
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .disclosureChevron()
    }
  }
}

private struct NextPageTrigger: Equatable {
  let cursor: String
  let isRefreshing: Bool
}

/// Shown while there's more, so reaching it loads the next page.
private struct NextPageRow: View {
  let failure: APIError?
  let retry: @MainActor () async -> Void

  var body: some View {
    if let failure {
      Button {
        Task { await retry() }
      } label: {
        Label {
          Text(
            "Try again", tableName: "CompletedLessons",
            comment: "Loads the next completed lessons again after it failed")
        } icon: {
          Image(systemName: failure == .network ? "wifi.exclamationmark" : "arrow.clockwise")
        }
      }
    } else {
      ProgressView()
        .frame(maxWidth: .infinity)
    }
  }
}

/// Main's day sections: the learner's own today and yesterday, else the date, with the year only
/// when it isn't this one. A finished day is a calendar day, so it's formatted in UTC.
func completedLessonsDayTitle(_ finishedOn: String, now: Date = .now, timeZone: TimeZone) -> String
{
  guard let finished = studyDate(finishedOn) else {
    return finishedOn
  }

  var local = Calendar(identifier: .gregorian)
  local.timeZone = timeZone
  var utc = Calendar(identifier: .gregorian)
  utc.timeZone = .gmt
  let today = local.dateComponents([.year, .month, .day], from: now)

  switch utc.date(from: today).flatMap({ utc.dateComponents([.day], from: finished, to: $0).day }) {
  case 0:
    return String(
      localized: "Today", table: "CompletedLessons",
      comment: "Section of the lessons last finished today")
  case 1:
    return String(
      localized: "Yesterday", table: "CompletedLessons",
      comment: "Section of the lessons last finished yesterday")
  default:
    let date = Date.FormatStyle.studyDay.weekday(.wide).month(.wide).day()
    return finished.formatted(
      utc.component(.year, from: finished) == today.year ? date : date.year())
  }
}
