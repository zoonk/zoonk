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
          ContentUnavailableView {
            Label {
              Text(
                "Couldn't load this chapter", tableName: "Plan",
                comment: "Title shown when a chapter failed to load")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } actions: {
            Button {
              Task { await chapter.refresh() }
            } label: {
              Text("Try again", tableName: "Plan", comment: "Retries loading the plan")
            }
            .buttonStyle(.outline)
          }
          .lonePage()
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
    ContentUnavailableView {
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
  @State private var isPracticing = false
  @State private var practiceNote: String?
  @State private var practiceTask: Task<Void, Never>?

  let goal: LearnerGoal
  let chapter: GoalChapter
  let map: Resource<ChapterMindMap>

  var body: some View {
    // Beside the lessons, the map sits with what the chapter leaves for reference, as on the web's
    // sidebar; on one pane it comes right under the header, where it's seen first.
    PaneSplit(primaryShare: 0.55) {
      ZoonkList {
        header
        lessonsSection
      }
    } secondary: {
      ZoonkList {
        practiceSection
        referenceSection(withMap: true)
      }
    } single: {
      ZoonkList {
        header
        mindMapSection
        lessonsSection
        practiceSection
        referenceSection(withMap: false)
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
      practiceTask?.cancel()
    }
  }

  private var lessons: [GoalChapter.Lesson] { chapter.lessons }

  private var done: Int { lessons.filter { $0.state == .done }.count }

  private var header: some View {
    Section {
      PageHeader(
        Text(chapter.chapter.title),
        supporting: Text(verbatim: facts.joinedFacts()).monospacedDigit()
      )
    }
  }

  private var mindMapSection: some View {
    MindMapRowSection(
      goalId: goal.id, map: map, place: .chapter,
      placeholder: Text(
        "Mind map", tableName: "MindMaps", comment: "A chapter's mind map, on its page"))
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
        SectionTitle(
          Text("Lessons", tableName: "Plan", comment: "Section of a chapter's lessons")
        ) {
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
            VStack(alignment: .leading, spacing: 2) {
              Text(
                "Already know this?", tableName: "Plan",
                comment: "Offers the chapter's test-out"
              )
              .foregroundStyle(.primary)

              Text(
                "Take the test and skip the chapter", tableName: "Plan",
                comment: "What the chapter's test-out does"
              )
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .disclosureChevron()
          }
        }

        if chapter.mistakes.open > 0 {
          Button {
            practice()
          } label: {
            Label {
              Text(
                "Practice this chapter", tableName: "Plan",
                comment: "Adds practice on the chapter"
              )
              .foregroundStyle(.primary)
            } icon: {
              KindMark(kind: .practice)
            }
          }
          .disabled(isPracticing)
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
  private func referenceSection(withMap: Bool) -> some View {
    let shownMap = withMap && map.value?.status != .unavailable ? map : nil

    if shownMap != nil || !chapter.skills.isEmpty || !chapter.summaries.isEmpty {
      ChapterReferenceSection(goalId: goal.id, chapter: chapter, map: shownMap)
    }
  }

  /// Where the chapter sits, then its lessons, their time and how much is done.
  private var facts: [String] {
    let minutes = lessons.reduce(0) { $0 + $1.minutes }
    let share = Double(done) / Double(max(lessons.count, 1))
    let place =
      chapter.chapter.subject.map { subject in
        String(
          localized: "\(subject.name)\u{00A0}· Chapter \(chapter.chapter.position)", table: "Plan",
          comment: "A chapter's subject and its number there")
      }
      ?? String(
        localized: "Chapter \(chapter.chapter.position)", table: "Plan",
        comment: "A chapter's number")

    guard !lessons.isEmpty else {
      return [place]
    }

    return [
      place,
      String(
        localized: "\(lessons.count) lessons", table: "Plan",
        comment: "How many lessons a chapter has"),
      planDurationText(minutes: Double(minutes)),
      String(
        localized: "\(share.formatted(.percent.precision(.fractionLength(0)))) done", table: "Plan",
        comment: "The share of a chapter's lessons done"),
    ]
  }

  private func practice() {
    isPracticing = true
    practiceNote = nil

    practiceTask = Task {
      let result = await store.practice(goalId: goal.id, areaId: chapter.chapter.chapterId)
      isPracticing = false

      switch result {
      case .done(.opened(let route)):
        router.open(route)
      case .done(.nothingToPractice):
        practiceNote = String(
          localized: "Nothing to practice in this chapter yet.", table: "Plan",
          comment: "Says the chapter has nothing to practice")
      case .failed:
        practiceNote = String(
          localized: "That didn't work. Try again in a moment.", table: "Plan",
          comment: "Says the practice didn't start")
      case .obsolete:
        break
      }
    }
  }
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
  let goalId: String
  let chapter: GoalChapter
  /// Set where the section holds the map too.
  let map: Resource<ChapterMindMap>?

  var body: some View {
    Section {
      if let map {
        MindMapRowContent(
          goalId: goalId, map: map, place: .chapter,
          placeholder: Text(
            "Mind map", tableName: "MindMaps", comment: "A chapter's mind map, on its page"))
      }

      if !chapter.skills.isEmpty || !chapter.summaries.isEmpty {
        summary
      }
    } header: {
      SectionTitle(
        Text(
          "For reference", tableName: "Plan",
          comment: "Section of a chapter with its mind map and summaries, to look back at"))
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
      Label {
        Text(
          "Chapter summary", tableName: "Plan",
          comment: "Folds a chapter's topics and summaries")
      } icon: {
        Image(systemName: "list.bullet.clipboard")
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
