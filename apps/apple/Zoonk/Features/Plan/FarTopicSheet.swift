import SwiftUI

/// "Get them ready" writes the topic's lesson plan now, from the learner's tap.
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
    case limit(HelpLimit)
    case unavailable
    case unreachable
    case writing
  }

  var body: some View {
    let outline = store.outline(goalId: goal.id, skillId: skillId)

    NavigationStack {
      ZoonkList {
        content(outline)
      }
      .announcesStatus(announcement(outline))
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
        message
          .foregroundStyle(.mutedForeground)

        if request != .unavailable {
          Button {
            Task { await ask(outline) }
          } label: {
            if request == .unreachable {
              Text("Try again", tableName: "Plan", comment: "Asks for a far topic's lessons again")
            } else {
              Text(
                "Get them ready", tableName: "Plan",
                comment: "Writes the lessons of a topic that aren't ready yet")
            }
          }
          .disabled(isCapped)
        }

        if case .limit(let limit) = request {
          LimitNotice(limit: limit, words: limit.previewWords)
        }
      }
    case .failed:
      Text(
        "These lessons aren't ready yet. Try again later.", tableName: "Plan",
        comment: "A topic whose lessons can't be made ready now"
      )
      .foregroundStyle(.mutedForeground)
    case .idle, .loading:
      ProgressView()
    }
  }

  private var message: Text {
    switch request {
    case .unreachable:
      Text(
        "We couldn't reach the server. Check your connection.", tableName: "Plan",
        comment: "A far topic's lessons couldn't be asked for")
    case .unavailable:
      Text(
        "This topic has no more lessons to get ready.", tableName: "Plan",
        comment: "A far topic the plan has nothing left to write for")
    case .idle, .limit, .writing:
      Text(
        "Getting these lessons ready takes about half a minute.", tableName: "Plan",
        comment: "Explains a topic whose lessons aren't ready yet")
    }
  }

  /// A short break lets the learner ask again; a used-up cap doesn't.
  private var isCapped: Bool {
    guard case .limit(let limit) = request else {
      return false
    }

    if case .slowDown = limit {
      return false
    }

    return true
  }

  private var writing: some View {
    Label {
      Text(Self.writingLine)
    } icon: {
      ProgressView()
    }
    .foregroundStyle(.mutedForeground)
  }

  private func announcement(_ outline: Resource<SkillOutline>) -> String? {
    switch outline.state {
    case .loaded(let value) where value.status == "ready" && !value.chapters.isEmpty:
      nil
    case .loaded(let value) where value.status == "writing" || request == .writing:
      Self.writingLine
    case .loaded, .empty:
      if case .limit(let limit) = request { limit.previewWords.said } else { nil }
    case .failed, .idle, .loading:
      nil
    }
  }

  private static var writingLine: String {
    String(
      localized: "Getting your lessons ready…", table: "Plan",
      comment: "A topic's lessons being made ready")
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
    case .done(.limit(let limit)): request = .limit(limit)
    case .done(.unavailable): request = .unavailable
    case .failed: request = .unreachable
    case .obsolete: break
    }
  }

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
