import SwiftUI

/// The learner's conversation with their buddy about one scope: earlier messages, each question
/// with its answer (streamed in place, with the plan change or app tool it brought), a few
/// suggestions to start, and a composer that stays at the bottom. Signed-in learners talk;
/// guests and visitors are asked to create an account. Reading the thread is the only request it
/// makes on its own: an answer (paid AI) comes only after the learner sends something.
///
/// ```swift
/// TutorThreadView(scope: .chapter(chapterId: id))
/// ```
///
/// The Buddy tab passes a `header` (the buddy's hello), its own `suggestions` and `placeholder`,
/// and a `draft` brought from search, which waits in the composer for the learner's own send.
struct TutorThreadView<Header: View>: View {
  @Environment(TutorStore.self) private var tutor
  @Environment(LearnerSummaryStore.self) private var summary
  @Environment(SessionStore.self) private var session

  let scope: TutorScope
  var suggestions: [TutorSuggestion]?
  var placeholder: Text?
  var draft: String?
  /// The page's own conversation (the Buddy tab): no "About…" above each question.
  var isPage = false
  @ViewBuilder var header: Header

  var body: some View {
    let learner = summary.summary.value

    TutorConversationView(
      conversation: tutor.conversation(scope),
      canTalk: session.authenticatedSession != nil && learner?.identity.isAnonymous != true,
      buddyName: summary.buddyDisplayName,
      suggestions: suggestions ?? scope.suggestions,
      placeholder: placeholder ?? scope.placeholder,
      draft: draft,
      isPage: isPage,
      header: header)
  }
}

extension TutorThreadView where Header == EmptyView {
  init(scope: TutorScope) {
    self.init(scope: scope, header: { EmptyView() })
  }
}

private struct TutorConversationView<Header: View>: View {
  @Bindable var conversation: TutorConversation
  let canTalk: Bool
  let buddyName: String
  let suggestions: [TutorSuggestion]
  let placeholder: Text
  let draft: String?
  let isPage: Bool
  let header: Header

  @State private var position = ScrollPosition(idType: String.self)

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 20) {
        header

        if canTalk {
          thread
        }

        if let moment = conversation.missionMoment {
          TutorMissionMoment(moment: moment)
        }
      }
      .frame(maxWidth: 720, alignment: .leading)
      .frame(maxWidth: .infinity, alignment: .leading)
      .scenePadding()
      .scrollTargetLayout()
    }
    .scrollPosition($position)
    .defaultScrollAnchor(.bottom, for: .initialOffset)
    .scrollDismissesKeyboard(.interactively)
    .safeAreaBar(edge: .bottom) {
      TutorComposerBar(
        conversation: conversation, canTalk: canTalk, buddyName: buddyName,
        suggestions: suggestions, placeholder: placeholder)
    }
    .modifier(LoadsThread(thread: conversation.thread, isActive: canTalk))
    .onChange(of: draft, initial: true) { _, draft in
      if let draft, !draft.isEmpty {
        conversation.draft = draft
      }
    }
    .onChange(of: conversation.turns.last?.id) { previous, latest in
      // A question just sent moves to the top, so its answer has the room to come in under it.
      guard previous != nil || conversation.turns.count == 1, let latest else {
        return
      }

      withAnimation(.snappy) {
        position.scrollTo(id: latest, anchor: .top)
      }
    }
  }

  @ViewBuilder
  private var thread: some View {
    switch conversation.thread.state {
    case .idle, .loading:
      ProgressView()
        .frame(maxWidth: .infinity)
        .accessibilityLabel(
          Text(
            "Loading the conversation…", tableName: "Tutor",
            comment: "The buddy's conversation is loading"))
    case .failed:
      VStack(alignment: .leading, spacing: 12) {
        Text(
          "Something went wrong. Try again.", tableName: "Tutor",
          comment: "The buddy's conversation couldn't be read"
        )
        .foregroundStyle(.secondary)
        Button {
          Task { await conversation.thread.refresh() }
        } label: {
          Label {
            Text("Try again", tableName: "Tutor", comment: "Reads the buddy's conversation again")
          } icon: {
            Image(systemName: "arrow.clockwise")
          }
        }
        .buttonStyle(.bordered)
      }
    case .loaded, .empty:
      earlierMessages

      ForEach(Array(conversation.turns.enumerated()), id: \.element.id) { index, turn in
        VStack(alignment: .leading, spacing: 20) {
          if index > 0,
            !Calendar.current.isDate(
              turn.createdAt, inSameDayAs: conversation.turns[index - 1].createdAt)
          {
            TutorDayLabel(date: turn.createdAt)
          } else if index == 0, !Calendar.current.isDateInToday(turn.createdAt) {
            TutorDayLabel(date: turn.createdAt)
          }

          TutorTurnView(
            turn: turn, conversation: conversation, buddyName: buddyName, showsAbout: !isPage)
        }
        .id(turn.id)
      }
    }
  }

  @ViewBuilder
  private var earlierMessages: some View {
    if conversation.thread.value?.hasMore == true {
      VStack(spacing: 8) {
        if conversation.earlierFailed {
          Text(
            "Couldn't load earlier messages. Try again.", tableName: "Tutor",
            comment: "Earlier messages of the conversation couldn't be read"
          )
          .font(.footnote)
          .foregroundStyle(.destructive)
        }

        Button {
          Task { await conversation.loadEarlier() }
        } label: {
          if conversation.isLoadingEarlier {
            ProgressView()
          } else {
            Text(
              "Load earlier messages", tableName: "Tutor",
              comment: "Shows the conversation's earlier messages")
          }
        }
        .buttonStyle(.bordered)
        .disabled(conversation.isLoadingEarlier)
      }
      .frame(maxWidth: .infinity)
    }
  }
}

/// Reads the thread only for someone who can talk to the buddy: a guest's or a visitor's has
/// nothing to read.
private struct LoadsThread: ViewModifier {
  let thread: Resource<TutorThreadPage>
  let isActive: Bool

  func body(content: Content) -> some View {
    if isActive {
      content.loads(thread, refreshable: false)
    } else {
      content
    }
  }
}

/// A day's name between stretches of the conversation.
private struct TutorDayLabel: View {
  let date: Date

  var body: some View {
    tutorDayLabel(date)
      .font(.caption.weight(.medium))
      .foregroundStyle(.secondary)
      .textCase(.uppercase)
      .frame(maxWidth: .infinity)
      .accessibilityAddTraits(.isHeader)
  }
}
