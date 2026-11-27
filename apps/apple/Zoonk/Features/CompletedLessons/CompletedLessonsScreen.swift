import SwiftUI

struct CompletedLessonsScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner

  var body: some View {
    Group {
      if let summary = learner.summary.value, let goal = summary.shownGoal {
        CompletedLessonsList(
          goalId: goal.id,
          today: PlanDate.today(
            in: summary.timeZone.flatMap(TimeZone.init(identifier:)) ?? .current)
        )
        .id(goal.id)
      } else {
        ProgressView()
          .lonePage()
      }
    }
    .barTitleAfterHero(
      String(
        localized: "Completed lessons", table: "CompletedLessons",
        comment: "Title of the page listing the lessons the learner finished"))
  }
}

/// Newest first, a section per month, each lesson's day at its row's end. A list long enough to
/// narrow has its plan's groups as its filter: beside it where the page splits into panes, a row of
/// chips over it otherwise. The filter is the same whichever group shows, so it stays while a
/// group's lessons load.
private struct CompletedLessonsList: View {
  @Environment(CompletedLessonsStore.self) private var store
  @State private var group: String?

  let goalId: String
  /// The learner's own day, which decides whether a lesson's day names its year.
  let today: String

  var body: some View {
    let every = store.lessons(CompletedLessonsQuery(goalId: goalId))
    let query = CompletedLessonsQuery(goalId: goalId, group: group)
    let lessons = store.lessons(query)
    let filter = lessons.value?.filter ?? every.value?.filter

    PaneBeside(isAvailable: filter != nil, paneEdge: .trailing, primaryShare: 0.66) {
      if let filter {
        ZoonkList {
          CompletedLessonGroupsSection(filter: filter, selection: $group)
        }
      }
    } content: { isBeside in
      content(lessons, query: query, chips: isBeside ? nil : filter)
    }
    .loads(lessons)
    .lessonSaveFailureAlert(goalId: goalId)
  }

  private var title: Text {
    Text(
      "Completed lessons", tableName: "CompletedLessons",
      comment: "Title of the page listing the lessons the learner finished")
  }

  @ViewBuilder
  private func content(
    _ lessons: Resource<CompletedLessonsPage>, query: CompletedLessonsQuery,
    chips: CompletedLessonsFilter?
  ) -> some View {
    switch lessons.state {
    case .empty:
      StateMessage {
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
    case .failed(let error) where chips == nil:
      PracticeLoadFailureView(error: error) {
        Task { await lessons.refresh() }
      }
    case .idle where chips == nil, .loading where chips == nil:
      ProgressView()
        .lonePage()
    default:
      ZoonkList {
        Section {
          PageHeader(title)
        }

        if let chips {
          Section {
            CompletedLessonGroupChips(filter: chips, selection: $group)
          }
          .listRowInsets(.vertical, 0)
          .listRowBackground(Color.clear)
        }

        rows(lessons, query: query)
      }
      .lonePage()
    }
  }

  /// Under the filter, which stays where it is while another group's lessons load or fail.
  @ViewBuilder
  private func rows(_ lessons: Resource<CompletedLessonsPage>, query: CompletedLessonsQuery)
    -> some View
  {
    switch lessons.state {
    case .loaded(let page):
      ForEach(months(page.lessons)) { month in
        Section {
          ForEach(month.lessons) { lesson in
            CompletedLessonRow(lesson: lesson, goalId: goalId, today: today)
          }
        } header: {
          SectionTitle(Text(month.title))
        }
      }

      if let cursor = page.nextCursor {
        NextPageRow(failure: store.loadMoreFailures[query]) {
          await store.loadMore(query)
        }
        // Again for each page that lands while the row still shows, and once a refresh ends.
        .task(id: NextPageTrigger(cursor: cursor, isRefreshing: lessons.isRefreshing)) {
          guard !lessons.isRefreshing else {
            return
          }

          await store.loadMore(query)
        }
      }
    case .failed(let error):
      PracticeLoadFailureView(error: error) {
        Task { await lessons.refresh() }
      }
    default:
      ProgressView()
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
    }
  }

  private func months(_ lessons: [CompletedLesson]) -> [CompletedLessonsMonth] {
    var order: [String] = []
    var byMonth: [String: [CompletedLesson]] = [:]

    for lesson in lessons {
      let month = String(lesson.finishedOn.prefix(7))

      if byMonth[month] == nil {
        order.append(month)
      }

      byMonth[month, default: []].append(lesson)
    }

    return order.map { month in
      CompletedLessonsMonth(
        id: month, title: completedLessonsMonthTitle(month, today: today),
        lessons: byMonth[month] ?? [])
    }
  }
}

private struct CompletedLessonsMonth: Identifiable {
  let id: String
  let title: String
  let lessons: [CompletedLesson]
}

extension CompletedLessonsFilter.Kind {
  /// The plan's own word for its groups, as its Plan page titles them.
  fileprivate var title: Text {
    switch self {
    case .subjects: Text("Subjects", tableName: "Plan", comment: "Section of an exam's subjects")
    case .modules: Text("Modules", tableName: "Plan", comment: "Section of a plan's modules")
    case .phases: Text("Phases", tableName: "Plan", comment: "Header over a new plan's phases")
    }
  }
}

private var everyLessonTitle: Text {
  Text(
    "All", tableName: "CompletedLessons",
    comment:
      "The first choice of the filter on Completed lessons, before the subjects: every lesson.")
}

/// The filter where there's no room beside the list: each group with its count.
private struct CompletedLessonGroupChips: View {
  let filter: CompletedLessonsFilter
  @Binding var selection: String?

  var body: some View {
    FilterChips(groups: filter.groups.map(\.key), selection: $selection, name: filter.kind.title) {
      key in
      let group = filter.groups.first { $0.key == key }

      if let group {
        Text(group.name)
      } else {
        everyLessonTitle
      }

      Text((group?.lessons ?? filter.total).formatted(.number.locale(.appLanguage)))
        .typeStyle(.data)
    }
  }
}

/// The filter beside the list: the group shown on `muted`, each with its count at its row's end.
private struct CompletedLessonGroupsSection: View {
  let filter: CompletedLessonsFilter
  @Binding var selection: String?

  var body: some View {
    Section {
      row(nil, title: everyLessonTitle, lessons: filter.total)

      ForEach(filter.groups) { group in
        row(group.key, title: Text(group.name), lessons: group.lessons)
      }
    } header: {
      SectionTitle(filter.kind.title)
    }
  }

  private func row(_ key: String?, title: Text, lessons: Int) -> some View {
    Button {
      selection = key
    } label: {
      HStack(spacing: 12) {
        title
          .foregroundStyle(.primary)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)

        Text(lessons.formatted(.number.locale(.appLanguage)))
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    }
    .currentRow(selection == key)
    .accessibilityAddTraits(selection == key ? .isSelected : [])
  }
}

/// Opens the lesson to do again; its bookmark saves it without opening it.
private struct CompletedLessonRow: View {
  @Environment(AppRouter.self) private var router

  let lesson: CompletedLesson
  let goalId: String
  let today: String

  var body: some View {
    if lesson.available {
      Button {
        router.open(.lesson(lessonId: lesson.lessonId))
      } label: {
        row
      }
      .savesLesson(
        LessonSaveTarget(
          lessonId: lesson.lessonId, title: lesson.title, chapterTitle: lesson.chapterTitle),
        goalId: goalId, server: lesson.saved)
    } else {
      HStack(spacing: 4) {
        row
        RowSaveSpace()
      }
      .accessibilityElement(children: .combine)
    }
  }

  private var row: some View {
    HStack(spacing: 12) {
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

      Text(PlanDate.format(lesson.finishedOn, today: today))
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
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

/// A month's section title: "November", with its year once it isn't this one, capitalized as a
/// title is in every language.
func completedLessonsMonthTitle(_ month: String, today: String) -> String {
  let title = PlanDate.monthText("\(month)-01", today: today, wide: true)
  return title.prefix(1).localizedUppercase + title.dropFirst()
}
