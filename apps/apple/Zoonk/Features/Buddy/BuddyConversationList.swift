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
          HStack(spacing: 12) {
            Text(
              "New conversation", tableName: "Buddy",
              comment: "Starts a new conversation with the buddy"
            )
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, alignment: .leading)

            // Where the other rows' chevrons are, as main's row ends with its plus.
            Image(systemName: "plus")
              .font(.body.weight(.semibold))
              .imageScale(.small)
              .foregroundStyle(Color(.tertiaryLabel))
              .accessibilityHidden(true)
          }
          .contentShape(.rect)
        }
        .currentRow(isOpenNew)
        .accessibilityAddTraits(isOpenNew ? .isSelected : [])

        rows(list)
      } header: {
        if showsTitle {
          SectionTitle(title)
        }
      }

      if list.value?.nextCursor != nil {
        Section {
          VStack(alignment: .leading, spacing: 8) {
            if store.nextConversations[goalId] == .failed {
              FailureLine(
                message: LocalizedStringResource(
                  "Couldn't load more conversations. Try again.", table: "Buddy")
              )
              .typeStyle(.note)
            }

            BusyButton(isBusy: store.nextConversations[goalId] == .loading) {
              Task { await store.loadMoreConversations(goalId: goalId) }
            } label: {
              Text(
                "Show more", tableName: "Buddy", comment: "Loads the next buddy conversations")
            }
            .buttonStyle(.outline)
            .controlSize(.small)
          }
          .listRowBackground(Color.clear)
        }
      }
    }
  }

  /// The open conversation has no question yet.
  private var isOpenNew: Bool {
    open?.asked == nil
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

        Text(
          Calendar.current.isDateInToday(conversation.lastAskedAt)
            ? PlanDate.timeOfDay(conversation.lastAskedAt)
            : PlanDate.momentDay(conversation.lastAskedAt)
        )
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
      }
      .disclosureChevron()
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
  /// Its first question and when its latest was asked; nil before the first.
  let asked: Asked?
}
