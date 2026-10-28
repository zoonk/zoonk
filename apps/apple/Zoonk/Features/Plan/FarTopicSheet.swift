import SwiftUI

/// A topic of the plan whose lessons aren't written yet (the plan writes them two weeks ahead):
/// "See the lessons" writes its lesson plan now, from the learner's tap, and shows its chapters
/// once they're in, each opening its page. The plan is read again when they land.
struct FarTopicSheet: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.planSheetOpen) private var sheetOpen
  @Environment(PlanStore.self) private var store
  @State private var request: Request = .idle

  let goal: LearnerGoal
  let skillId: String
  let title: String

  private enum Request: Equatable {
    case idle
    case limit
    case unreachable
    case writing
  }

  var body: some View {
    let outline = store.outline(goalId: goal.id, skillId: skillId)

    NavigationStack {
      List {
        content(outline)
      }
      .navigationTitle(Text(title))
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          PlanSheetDoneButton()
        }
      }
      .loads(outline, refreshable: false)
    }
    .presentationDetents([.medium, .large])
  }

  @ViewBuilder
  private func content(_ outline: Resource<SkillOutline>) -> some View {
    switch outline.state {
    case .loaded(let value) where value.status == "ready" && !value.chapters.isEmpty:
      ForEach(value.chapters) { chapter in
        Button {
          sheetOpen?.open(chapterRoute(chapter.chapterId))
        } label: {
          Text(chapter.title)
            .foregroundStyle(.primary)
        }
      }
    case .loaded(let value) where value.status == "writing" || request == .writing:
      writing
        .task(id: request) {
          await follow(outline)
        }
    case .loaded, .empty:
      Section {
        if request == .unreachable {
          Text(
            "We couldn't reach the server. Check your connection.", tableName: "Plan",
            comment: "A far topic's lessons couldn't be asked for"
          )
          .foregroundStyle(.secondary)
        } else {
          Text(
            "A topic's lessons are planned two weeks before you get to it. You can see this one's now.",
            tableName: "Plan", comment: "Explains a far topic's lessons"
          )
          .foregroundStyle(.secondary)
        }

        if request == .limit {
          PlusNotice(
            description: Text(
              "Your plan prepared all it can for now.", tableName: "Plan",
              comment: "Says the learner's plan reached its outlines"),
            isInset: true)
        } else {
          Button {
            Task { await ask(outline) }
          } label: {
            if request == .unreachable {
              Text("Try again", tableName: "Plan", comment: "Asks for a far topic's lessons again")
            } else {
              Text(
                "See the lessons", tableName: "Plan", comment: "Writes a far topic's lessons now")
            }
          }
        }
      }
    case .failed:
      Text(
        "There's nothing left to prepare for this topic.", tableName: "Plan",
        comment: "A far topic with nothing to outline"
      )
      .foregroundStyle(.secondary)
    case .idle, .loading:
      ProgressView()
    }
  }

  private var writing: some View {
    Label {
      Text(
        "Preparing the lessons… It takes about half a minute.", tableName: "Plan",
        comment: "A far topic's lessons being written")
    } icon: {
      ProgressView()
    }
    .foregroundStyle(.secondary)
  }

  private func ask(_ outline: Resource<SkillOutline>) async {
    let goalId = goal.id
    let skillId = skillId
    let answer = await store.write { api, token in
      try await api.createOutline(token: token, goalId: goalId, skillId: skillId)
    } changed: { _ in
      false
    }

    switch answer {
    case .done(.started): request = .writing
    case .done(.limit): request = .limit
    case .failed: request = .unreachable
    case .obsolete: break
    }
  }

  /// Reads the outline again every few seconds while it's written; once it's in, the plan follows.
  private func follow(_ outline: Resource<SkillOutline>) async {
    while !Task.isCancelled {
      try? await Task.sleep(for: .seconds(4))
      await outline.refresh()

      if outline.value?.status == "ready" {
        request = .idle
        store.cache.invalidate([.goals])
        return
      }
    }
  }

  private func chapterRoute(_ chapterId: String) -> AppRoute {
    goal.kind == .language ? .languageUnit(chapterId: chapterId) : .chapter(chapterId: chapterId)
  }
}
