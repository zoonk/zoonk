import SwiftUI

/// The goal's Buddy conversations, the latest asked in first: beside the open one where the page
/// has room, in a sheet otherwise. "New conversation" is the open one until its first question,
/// which then takes its row's place.
struct BuddyConversationList: View {
  @Environment(BuddyStore.self) private var store

  let goalId: String
  let open: BuddyOpenRow?
  var showsTitle = true
  let startNew: () -> Void
  let select: (String) -> Void

  var body: some View {
    let list = store.conversations(goalId: goalId)

    ZoonkList {
      Section {
        Button(action: startNew) {
          Label {
            Text(
              "New conversation", tableName: "Buddy",
              comment: "Starts a new conversation with the buddy")
          } icon: {
            Image(systemName: "square.and.pencil")
          }
          .foregroundStyle(.primary)
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        .currentRow(open?.isNew == true)
        .accessibilityAddTraits(open?.isNew == true ? .isSelected : [])

        rows(list)
      } header: {
        if showsTitle {
          SectionTitle(title)
        }
      }
    }
  }

  var title: Text {
    Text("Conversations", tableName: "Buddy", comment: "Title of the list of buddy conversations")
  }

  @ViewBuilder
  private func rows(_ list: Resource<BuddyConversations>) -> some View {
    switch list.state {
    case .loaded, .empty:
      ForEach(shown(list.value?.conversations ?? []), id: \.id) { conversation in
        row(conversation)
      }

      if list.value?.nextCursor != nil {
        if store.nextConversations[goalId] == .failed {
          FailureLine(
            message: LocalizedStringResource(
              "Something went wrong. Try again.", table: "Buddy",
              comment: "More buddy conversations couldn't be read")
          )
          .typeStyle(.note)
        }

        BusyButton(isBusy: store.nextConversations[goalId] == .loading, isRow: true) {
          Task { await store.loadMoreConversations(goalId: goalId) }
        } label: {
          Text(
            "Show more", tableName: "Buddy",
            comment: "Loads the next buddy conversations")
        }
      }
    case .failed:
      VStack(alignment: .leading, spacing: 12) {
        Text(
          "Something went wrong. Try again.", tableName: "Buddy",
          comment: "The buddy conversations couldn't be read"
        )
        .foregroundStyle(.mutedForeground)

        Button {
          Task { await list.refresh() }
        } label: {
          Label {
            Text("Try again", tableName: "Buddy", comment: "Reads the buddy conversations again")
          } icon: {
            Image(systemName: "arrow.clockwise")
          }
        }
        .buttonStyle(.outline)
      }
      .listRowBackground(Color.clear)
    case .idle, .loading:
      ProgressView()
        .frame(maxWidth: .infinity)
        .listRowBackground(Color.clear)
    }
  }

  /// The open conversation shows from its first question on, before the list is read again.
  private func shown(_ conversations: [BuddyConversation]) -> [BuddyConversation] {
    guard let open, let asked = open.asked, !conversations.contains(where: { $0.id == open.id })
    else {
      return conversations
    }

    return [BuddyConversation(id: open.id, lastAskedAt: asked.lastAskedAt, title: asked.title)]
      + conversations
  }

  private func row(_ conversation: BuddyConversation) -> some View {
    let isOpen = conversation.id == open?.id

    return Button {
      select(conversation.id)
    } label: {
      HStack(alignment: .firstTextBaseline, spacing: 12) {
        Text(conversation.title)
          .foregroundStyle(.primary)
          .lineLimit(1)
          .frame(maxWidth: .infinity, alignment: .leading)

        Text(buddyConversationDay(conversation.lastAskedAt))
          .typeStyle(.data)
          .foregroundStyle(.mutedForeground)
      }
    }
    .currentRow(isOpen)
    .accessibilityAddTraits(isOpen ? .isSelected : [])
  }
}

/// The conversation the page shows, as its list row needs it.
struct BuddyOpenRow: Equatable {
  struct Asked: Equatable {
    let title: String
    let lastAskedAt: Date
  }

  let id: String
  /// Named by the app and nothing asked yet.
  let isNew: Bool
  /// Its first question and when its latest was asked; nil before the first.
  let asked: Asked?
}

/// Its time when it's today's, its day otherwise (main's `useFormatMomentDay`).
func buddyConversationDay(_ date: Date, now: Date = .now) -> String {
  Calendar.current.isDate(date, inSameDayAs: now)
    ? PlanDate.timeOfDay(date)
    : PlanDate.momentDay(date, now: now)
}
