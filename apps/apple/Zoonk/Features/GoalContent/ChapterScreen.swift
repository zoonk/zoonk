import SwiftUI

struct ChapterScreen: View {
  @Environment(GoalContentStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var mindMaps
  @State private var isReporting = false

  let chapterId: String

  var body: some View {
    // A language's chapters are its units: drawn here too, as main does, so a link never redirects.
    if let goal = learner.summary.value?.shownGoal, goal.kind == .language {
      LanguageUnitScreen(chapterId: chapterId)
    } else if let goal = learner.summary.value?.shownGoal {
      let chapter = store.chapter(goalId: goal.id, chapterId: chapterId)
      let map = mindMaps.map(goalId: goal.id, chapterId: chapterId)

      Group {
        switch chapter.state {
        case .loaded(let value):
          ChapterContent(goal: goal, chapter: value, map: map)
        case .failed(.notFound), .empty:
          notInPlan
        case .failed:
          PageLoadFailure {
            Label {
              Text(
                "Couldn't load this chapter", tableName: "Plan",
                comment: "Title shown when a chapter failed to load")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } retry: {
            await chapter.refresh()
          }
        case .idle, .loading:
          ProgressView()
        }
      }
      .barTitleAfterHero(chapter.value?.chapter.title ?? String(localized: untitledChapterTitle))
      .toolbar {
        TutorAskToolbarItem(scope: .chapter(chapterId: chapterId))

        ToolbarItem(placement: .primaryAction) {
          Menu {
            Button {
              isReporting = true
            } label: {
              Label {
                Text(
                  "Report a problem", tableName: "Plan",
                  comment: "Opens the feedback form about the chapter page")
              } icon: {
                Image(systemName: "flag")
              }
            }
          } label: {
            Label {
              Text(
                "Chapter options", tableName: "Plan",
                comment: "Spoken label of the chapter's … menu")
            } icon: {
              Image(systemName: "ellipsis")
            }
          }
        }
      }
      .feedbackSheet(
        isPresented: $isReporting,
        context: FeedbackContext(contentID: chapterId, contentKind: .chapter), isReport: true
      )
      .loads(chapter, map)
    } else if learner.summary.value != nil {
      notInPlan
        .navigationTitle(untitledChapter)
        .toolbarTitleDisplayMode(.inline)
    }
  }

  private var untitledChapterTitle: LocalizedStringResource {
    LocalizedStringResource(
      "Chapter", table: "Navigation",
      comment: "Title shown instead of a chapter of the plan until it can open")
  }

  private var untitledChapter: Text {
    Text(untitledChapterTitle)
  }

  private var notInPlan: some View {
    StateMessage {
      Label {
        Text(
          "This chapter isn't in your plan", tableName: "Plan",
          comment: "Shown for a chapter that isn't in the learner's plan")
      } icon: {
        Image(systemName: "book")
      }
    }
    .lonePage()
  }
}

private struct ChapterContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(GoalContentStore.self) private var store
  @State private var practicing = VisitRequest<PracticeEnd>()

  let goal: LearnerGoal
  let chapter: GoalChapter
  let map: Resource<ChapterMindMap>

  var body: some View {
    // As on the web: beside the lessons the map leads "For reference"; on one pane it follows the
    // summary.
    PaneSplit(primaryShare: 0.55) {
      ZoonkList {
        header
        lessonsSection
      }
    } secondary: {
      ZoonkList {
        practiceSection
        referenceSection(mapFirst: true)
      }
    } single: {
      ZoonkList {
        header
        lessonsSection
        practiceSection
        referenceSection(mapFirst: false)
      }
    }
    .bottomBar {
      if let next = lessons.first(where: { $0.state == .next }) {
        Button {
          router.open(.lesson(lessonId: next.lessonId))
        } label: {
          if done > 0 {
            Text("Continue", tableName: "Plan", comment: "Opens the chapter's next lesson")
          } else {
            Text("Start", tableName: "Plan", comment: "Opens the chapter's first lesson")
          }
        }
        .buttonStyle(.mainAction)
        .keyboardShortcut(.defaultAction)
      }
    }
    .onDisappear {
      practicing.leave()
    }
  }

  private var lessons: [GoalChapter.Lesson] { chapter.lessons }

  private var done: Int { lessons.filter { $0.state == .done }.count }

  private var header: some View {
    Section {
      PageHeader(
        Text(chapter.chapter.title),
        facts: facts
      )
    }
  }

  @ViewBuilder
  private var lessonsSection: some View {
    if !lessons.isEmpty {
      Section {
        ForEach(Array(lessons.enumerated()), id: \.element.id) { index, lesson in
          Button {
            router.open(.lesson(lessonId: lesson.lessonId))
          } label: {
            LessonRow(lesson: lesson, number: index + 1)
          }
          .currentRow(lesson.state == .next)
        }
      } header: {
        SectionTitle(Text("Lessons", tableName: "Plan", comment: "Section of a chapter's lessons"))
        {
          Text(
            "\(done) of \(lessons.count)", tableName: "Plan",
            comment: "Lessons done of the chapter's lessons"
          )
          .monospacedDigit()
        }
      }
    }
  }

  @ViewBuilder
  private var practiceSection: some View {
    if chapter.testOut.available || chapter.mistakes.open > 0 {
      Section {
        if chapter.testOut.available {
          Button {
            router.open(.testOut(chapterId: chapter.chapter.chapterId))
          } label: {
            ListRow(
              Text(
                "Already know this?", tableName: "Plan",
                comment: "Offers the chapter's test-out"),
              description: Text(
                "Take the test and skip the chapter", tableName: "Plan",
                comment: "What the chapter's test-out does")
            ) {
              KindDot(kind: .practice)
            }
            .disclosureChevron()
          }
        }

        if chapter.mistakes.open > 0 {
          Button {
            practice()
          } label: {
            ListRow(
              Text(
                "Practice this chapter", tableName: "Plan",
                comment: "Adds practice on the chapter")
            ) {
              KindMark(kind: .practice)
            }
            .disclosureChevron()
          }
          .disabled(practicing.isRunning)
          .announcesStatus(practiceNote)

          if let practiceNote {
            Text(practiceNote)
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
      } header: {
        SectionTitle(
          Text("Practice", tableName: "Plan", comment: "Section of a chapter's practice"))
      }
    }
  }

  @ViewBuilder
  private func referenceSection(mapFirst: Bool) -> some View {
    let shownMap = map.value?.status != .unavailable ? map : nil

    if shownMap != nil || !chapter.skills.isEmpty || !chapter.summaries.isEmpty {
      ChapterReferenceSection(goalId: goal.id, chapter: chapter, map: shownMap, mapFirst: mapFirst)
    }
  }

  /// Where the chapter sits, then its lessons and their time; the lesson list counts how many are done.
  private var facts: [String] {
    let minutes = lessons.reduce(0) { $0 + $1.minutes }
    let place = String(
      localized: "Chapter \(chapter.chapter.position)", table: "Plan",
      locale: .appLanguage, comment: "A chapter's number")

    guard !lessons.isEmpty else {
      return [place]
    }

    return [
      place,
      String(
        localized: "\(lessons.count) lessons", table: "Plan",
        locale: .appLanguage, comment: "How many lessons a chapter has"),
      planDurationText(minutes: Double(minutes)),
    ]
  }

  private var practiceNote: String? {
    if case .note(let note) = practicing.outcome { note } else { nil }
  }

  private func practice() {
    practicing.run { [store, goal, chapter] in
      switch await store.practice(goalId: goal.id, areaId: chapter.chapter.chapterId) {
      case .done(.opened(let route)):
        return PracticeEnd.opened(route)
      case .done(.nothingToPractice):
        return PracticeEnd.note(
          String(
            localized: "Nothing to practice in this chapter yet.", table: "Plan",
            comment: "Says the chapter has nothing to practice"))
      case .failed:
        return PracticeEnd.note(
          String(
            localized: "That didn't work. Try again in a moment.", table: "Plan",
            comment: "Says the practice didn't start"))
      case .obsolete:
        return nil
      }
    } then: { [router] ended in
      if case .opened(let route) = ended {
        router.open(route)
      }
    }
  }
}

private enum PracticeEnd {
  case opened(AppRoute)
  case note(String)
}

/// Main's lesson list row: numbered in the chapter or unit, its minutes at the trailing edge.
struct LessonRow: View {
  let lesson: GoalChapter.Lesson
  let number: Int

  var body: some View {
    ListRow(
      Text(lesson.title)
        .foregroundStyle(lesson.state == .done ? .mutedForeground : Color(.foreground)),
      number: number
    ) {
      StatusMark(status: status)
    } trailing: {
      if lesson.minutes > 0 {
        Text(planDurationText(minutes: Double(lesson.minutes)))
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(state)
    .disclosureChevron()
  }

  private var status: StatusMark.Status {
    switch lesson.state {
    case .done: .done
    case .next: .next
    case .upcoming: .todo
    }
  }

  private var state: Text {
    switch lesson.state {
    case .done: Text("Done", tableName: "Plan", comment: "Spoken state of a lesson done")
    case .next: Text("Up next", tableName: "Plan", comment: "Spoken state of the next lesson")
    case .upcoming: Text("Coming up", tableName: "Plan", comment: "Spoken state of a later lesson")
    }
  }
}

private struct ChapterReferenceSection: View {
  @ScaledMetric(relativeTo: .body) private var markSize = 14.0

  let goalId: String
  let chapter: GoalChapter
  /// Nil when the chapter gets no map.
  let map: Resource<ChapterMindMap>?
  let mapFirst: Bool

  var body: some View {
    Section {
      if mapFirst {
        mapRow
      }

      if !chapter.skills.isEmpty || !chapter.summaries.isEmpty {
        summary
      }

      if !mapFirst {
        mapRow
      }
    } header: {
      SectionTitle(
        Text(
          "For reference", tableName: "Plan",
          comment: "Section of a chapter with its mind map and summaries, to look back at"))
    }
  }

  @ViewBuilder
  private var mapRow: some View {
    if let map {
      MindMapRowContent(
        goalId: goalId, map: map, place: .chapter,
        placeholder: Text(
          "Mind map", tableName: "MindMaps", comment: "A chapter's mind map, on its page"))
    }
  }

  private var summary: some View {
    DisclosureGroup {
      ForEach(chapter.skills) { skill in
        LabeledContent {
          skillState(skill)
        } label: {
          Text(skill.name)
        }
      }

      LessonSummaries(summaries: chapter.summaries)
    } label: {
      ListRow(
        Text(
          "Chapter summary", tableName: "Plan",
          comment: "Folds a chapter's topics and summaries")
      ) {
        // Main's lucide NotebookText.
        Image(systemName: "text.book.closed")
          .resizable()
          .scaledToFit()
          .frame(width: markSize, height: markSize)
          .accessibilityHidden(true)
      }
    }
  }

  private func skillState(_ skill: GoalChapter.Skill) -> Text {
    if skill.fading {
      return Text("Fading", tableName: "Plan", comment: "A skill the learner is forgetting")
    }

    return skill.state.label
  }
}

extension GoalChapter.Skill.State {
  var label: Text {
    switch self {
    case .new: Text("New", tableName: "Plan", comment: "A skill not studied yet")
    case .learning: Text("Learning", tableName: "Plan", comment: "A skill being learned")
    case .solid: Text("Solid", tableName: "Plan", comment: "A skill learned well")
    case .mastered: Text("Mastered", tableName: "Plan", comment: "A skill mastered")
    }
  }
}

/// The finished lessons' summary cards, as rows of a disclosure.
struct LessonSummaries: View {
  let summaries: [GoalChapter.Summary]

  @Environment(\.legibilityWeight) private var legibilityWeight

  var body: some View {
    ForEach(summaries) { summary in
      VStack(alignment: .leading, spacing: 4) {
        Text(summary.title)
          .typeStyle(.body.weight(.semibold))

        ForEach(summary.ideas, id: \.self) { idea in
          Text(
            (try? AttributedString(markdown: idea)) ?? AttributedString(idea),
            legibility: legibilityWeight
          )
          .typeStyle(.note)
          .foregroundStyle(.mutedForeground)
        }
      }
    }
  }
}
