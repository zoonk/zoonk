import SwiftUI

/// A chapter of the learner's plan: its subject and number, how much it holds and how far the
/// learner is, "Continue" into the next lesson, its lessons in order (the next one marked), a test
/// that skips a chapter they may already know, its practice when it has mistakes, and for
/// reference its mind map, its skills and the summaries its lessons left.
struct ChapterScreen: View {
  @Environment(GoalContentStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var learner

  let chapterId: String

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let chapter = store.chapter(goalId: goal.id, chapterId: chapterId)

      Group {
        switch chapter.state {
        case .loaded(let value):
          ChapterContent(goal: goal, chapter: value)
        case .failed(.notFound), .empty:
          ContentUnavailableView {
            Label {
              Text(
                "This chapter isn't in your plan", tableName: "Plan",
                comment: "Shown for a chapter that isn't in the learner's plan")
            } icon: {
              Image(systemName: "book")
            }
          }
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
            .buttonStyle(.bordered)
          }
        case .idle, .loading:
          ProgressView()
        }
      }
      .navigationTitle(chapter.value.map { Text($0.chapter.title) } ?? Text(verbatim: ""))
      .toolbarTitleDisplayMode(.inline)
      // The page heads itself with its title, as main does; the bar keeps it for the back button.
      .toolbar(removing: .title)
      .loads(chapter)
    }
  }
}

private struct ChapterContent: View {
  @Environment(AppRouter.self) private var router
  @Environment(GoalContentStore.self) private var store
  @State private var isPracticing = false
  @State private var practiceNote: Text?

  let goal: LearnerGoal
  let chapter: GoalChapter

  var body: some View {
    let lessons = chapter.lessons
    let done = lessons.filter { $0.state == .done }.count
    let next = lessons.first { $0.state == .next }

    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          eyebrow
            .font(.subheadline)
            .foregroundStyle(.secondary)

          Text(chapter.chapter.title)
            .font(.title2.weight(.semibold))

          if !lessons.isEmpty {
            facts(done: done)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }

          if let next {
            Button {
              router.open(.lesson(lessonId: next.lessonId))
            } label: {
              Group {
                if done > 0 {
                  Text("Continue", tableName: "Plan", comment: "Opens the chapter's next lesson")
                } else {
                  Text("Start", tableName: "Plan", comment: "Opens the chapter's first lesson")
                }
              }
              .frame(maxWidth: .infinity)
            }
            .buttonStyle(.mainAction)
            .controlSize(.large)
            .padding(.top, 8)
          }
        }
        .padding(.vertical, 4)
      }

      if !lessons.isEmpty {
        Section {
          ForEach(lessons) { lesson in
            Button {
              router.open(.lesson(lessonId: lesson.lessonId))
            } label: {
              LessonRow(lesson: lesson)
            }
          }
        } header: {
          HStack {
            Text("Lessons", tableName: "Plan", comment: "Section of a chapter's lessons")
            Spacer()
            Text(
              "\(done) of \(lessons.count)", tableName: "Plan",
              comment: "Lessons done of the chapter's lessons"
            )
            .monospacedDigit()
          }
        }
      }

      if chapter.testOut.available || chapter.mistakes.open > 0 {
        Section {
          if chapter.testOut.available {
            Button {
              router.open(.testOut(chapterId: chapter.chapter.chapterId))
            } label: {
              VStack(alignment: .leading, spacing: 2) {
                HStack {
                  Text(
                    "Already know this?", tableName: "Plan",
                    comment: "Offers the chapter's test-out"
                  )
                  .foregroundStyle(.primary)

                  if chapter.testOut.plusRequired {
                    // TODO(S10): use `PlusMark()` once PlusLock.swift lands.
                    Text("Plus", tableName: "Plan", comment: "Marks a feature that comes with Plus")
                      .chip()
                  }
                }

                Text(
                  "Take the test and skip the chapter", tableName: "Plan",
                  comment: "What the chapter's test-out does"
                )
                .font(.subheadline)
                .foregroundStyle(.secondary)
              }
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

            if let practiceNote {
              practiceNote
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
          }
        } header: {
          Text("Practice", tableName: "Plan", comment: "Section of a chapter's practice")
        }
      }

      if !chapter.skills.isEmpty || !chapter.summaries.isEmpty || chapter.chapter.state == "done" {
        ChapterReferenceSection(chapter: chapter)
      }
    }
  }

  private var eyebrow: Text {
    if let subject = chapter.chapter.subject {
      return Text(
        "\(subject.name) · Chapter \(chapter.chapter.position)", tableName: "Plan",
        comment: "A chapter's subject and its number there")
    }

    return Text(
      "Chapter \(chapter.chapter.position)", tableName: "Plan", comment: "A chapter's number")
  }

  /// "11 lessons · 40 min · 33% done".
  private func facts(done: Int) -> Text {
    let lessons = chapter.lessons
    let minutes = lessons.reduce(0) { $0 + $1.minutes }
    let share = Double(done) / Double(max(lessons.count, 1))

    return Text(
      "^[\(lessons.count) lesson](inflect: true) · \(planDurationText(minutes: Double(minutes))) · \(share.formatted(.percent.precision(.fractionLength(0)))) done",
      tableName: "Plan", comment: "A chapter's lessons, their time and the share done")
  }

  private func practice() {
    Task {
      isPracticing = true
      practiceNote = nil
      let outcome = await store.practice(goalId: goal.id, areaId: chapter.chapter.chapterId)
      isPracticing = false

      switch outcome {
      case .opened(let route):
        router.open(route)
      case .dailyCap:
        practiceNote = Text(
          "That's all the bonus practice for today. Tomorrow's session picks this chapter up.",
          tableName: "Plan", comment: "Says today's bonus practice is used up")
      case .nothingToPractice:
        practiceNote = Text(
          "Nothing to practice in this chapter yet.", tableName: "Plan",
          comment: "Says the chapter has nothing to practice")
      case nil:
        practiceNote = Text(
          "That didn't work. Try again in a moment.", tableName: "Plan",
          comment: "Says the practice didn't start")
      }
    }
  }
}

/// A lesson in a chapter or unit: its mark (done, up next, coming up), its title and minutes.
struct LessonRow: View {
  let lesson: GoalChapter.Lesson

  var body: some View {
    LabeledContent {
      Text(planDurationText(minutes: Double(lesson.minutes)))
        .monospacedDigit()
    } label: {
      Label {
        HStack {
          Text(lesson.title)
            .foregroundStyle(.primary)

          if lesson.plusRequired {
            // TODO(S10): use `PlusMark()` once PlusLock.swift lands.
            Text("Plus", tableName: "Plan", comment: "Marks a feature that comes with Plus")
              .chip()
          }
        }
      } icon: {
        StatusMark(status: status)
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityValue(state)
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

/// "For reference": the chapter's mind map once it's done, then, folded, its skills with their
/// state and the summaries its lessons left.
private struct ChapterReferenceSection: View {
  @Environment(AppRouter.self) private var router

  let chapter: GoalChapter

  var body: some View {
    Section {
      if chapter.chapter.state == "done" {
        Button {
          router.open(.mindMap(chapterId: chapter.chapter.chapterId))
        } label: {
          Label {
            Text("Mind map", tableName: "Plan", comment: "Opens the chapter's mind map")
              .foregroundStyle(.primary)
          } icon: {
            KindMark(kind: .mindMap)
          }
        }
      }

      if !chapter.skills.isEmpty || !chapter.summaries.isEmpty {
        DisclosureGroup {
          ForEach(chapter.skills) { skill in
            LabeledContent {
              skillState(skill)
            } label: {
              Text(skill.name)
            }
          }

          ForEach(chapter.summaries) { summary in
            VStack(alignment: .leading, spacing: 4) {
              Text(summary.title)
                .font(.headline)

              ForEach(summary.ideas, id: \.self) { idea in
                Text((try? AttributedString(markdown: idea)) ?? AttributedString(idea))
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            }
          }
        } label: {
          Label {
            Text(
              "Chapter summary", tableName: "Plan",
              comment: "Folds a chapter's skills and summaries")
          } icon: {
            Image(systemName: "list.bullet.clipboard")
          }
        }
      }
    } header: {
      Text("For reference", tableName: "Plan", comment: "Section of a chapter's map and summaries")
    }
  }

  private func skillState(_ skill: GoalChapter.Skill) -> Text {
    if skill.fading {
      return Text("Fading", tableName: "Plan", comment: "A skill the learner is forgetting")
    }

    switch skill.state {
    case .new: return Text("New", tableName: "Plan", comment: "A skill not studied yet")
    case .learning: return Text("Learning", tableName: "Plan", comment: "A skill being learned")
    case .solid: return Text("Solid", tableName: "Plan", comment: "A skill learned well")
    case .mastered: return Text("Mastered", tableName: "Plan", comment: "A skill mastered")
    }
  }
}
