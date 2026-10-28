import SwiftUI

/// The bottom of a conversation: the suggestions before the first question, then the composer.
/// A limit takes the composer's place with its one way forward, and guests and visitors see
/// the way to an account instead.
struct TutorComposerBar: View {
  @Bindable var conversation: TutorConversation
  let canTalk: Bool
  let buddyName: String
  let suggestions: [TutorSuggestion]
  let placeholder: Text

  @FocusState private var isFocused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if !canTalk {
        signUpPrompt
      } else if let limit = conversation.limit {
        TutorLimitNotice(failure: limit)
      } else {
        if conversation.thread.value?.turns.isEmpty == true, !suggestions.isEmpty {
          suggestionChips
        }

        if let failure = conversation.askFailure {
          (failure == .failed
            ? Text(
              "We couldn't send your last question. Try again.", tableName: "Tutor",
              comment: "Sending a question to the buddy failed")
            : failure.message)
            .font(.footnote)
            .foregroundStyle(.destructive)
        }

        composer
      }
    }
    .scenePadding(.horizontal)
    .padding(.vertical, 8)
  }

  private var composer: some View {
    HStack(alignment: .bottom, spacing: 8) {
      TextField(text: $conversation.draft, prompt: placeholder, axis: .vertical) {
        Text(
          "Message \(buddyName)", tableName: "Tutor",
          comment: "The buddy's composer for VoiceOver; the argument is the buddy's name")
      }
      .lineLimit(1...6)
      .focused($isFocused)
      .onKeyPress(.return, phases: .down) { press in
        guard TutorComposerKeys.returnSends(modifiers: press.modifiers) else {
          return .ignored
        }

        send()
        return .handled
      }
      .padding(.leading, 16)
      .padding(.vertical, 12)

      Button(action: send) {
        Label {
          Text("Send", tableName: "Tutor", comment: "Sends the question to the buddy")
        } icon: {
          Image(systemName: "arrow.up")
            .fontWeight(.semibold)
        }
        .labelStyle(.iconOnly)
      }
      .buttonStyle(.mainAction)
      .buttonBorderShape(.circle)
      .keyboardShortcut(.return, modifiers: .command)
      .disabled(!conversation.canSendDraft)
      .padding(6)
    }
    .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 24, style: .continuous))
  }

  private var suggestionChips: some View {
    ScrollView(.horizontal) {
      HStack(spacing: 8) {
        ForEach(suggestions) { suggestion in
          Button {
            Task { await conversation.send(suggestion) }
          } label: {
            Text(suggestion.label)
          }
          .buttonStyle(.suggestionChip)
          .disabled(!conversation.canAsk)
        }
      }
    }
    .scrollIndicators(.hidden)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text("Suggestions", tableName: "Tutor", comment: "Questions to the buddy sent with one tap"))
  }

  private var signUpPrompt: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(
        "Create a free account to start the conversation.", tableName: "Tutor",
        comment: "Guests and visitors can't talk to the buddy"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)

      TutorRemedyButton(failure: .signUpRequired, retry: {})
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func send() {
    guard conversation.canSendDraft else {
      return
    }

    Task { await conversation.send() }
  }
}

/// What a hardware keyboard's keys do in the composer.
enum TutorComposerKeys {
  /// Return sends, as on main, and so does Command-Return; Shift-Return starts a new line.
  static func returnSends(modifiers: EventModifiers) -> Bool {
    !modifiers.contains(.shift)
  }
}

/// A limit the learner reached, as every limit in the app says it: the reason in one line and
/// the one thing to do (create a free account, see Plus), or nothing but to wait.
struct TutorLimitNotice: View {
  let failure: TutorFailure

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      failure.message
        .font(.subheadline)
        .foregroundStyle(.secondary)

      TutorRemedyButton(failure: failure, retry: {})
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The one thing to do about a failure: create a free account, see Plus, sign in, or try again.
struct TutorRemedyButton: View {
  @Environment(\.tutorPlaces) private var places

  let failure: TutorFailure
  let retry: () -> Void

  var body: some View {
    switch failure.remedy {
    case .createAccount:
      Button {
        places.open(.account)
      } label: {
        Text("Create a free account", tableName: "Tutor", comment: "Opens sign-up from the buddy")
      }
      .buttonStyle(.bordered)
    case .seePlus:
      SeePlusButton()
        .buttonStyle(.bordered)
    case .signIn:
      Button {
        places.open(.account)
      } label: {
        Text("Sign in", tableName: "Tutor", comment: "Opens sign-in after the session expired")
      }
      .buttonStyle(.bordered)
    case .tryAgain:
      Button(action: retry) {
        Label {
          Text("Try again", tableName: "Tutor", comment: "Asks the buddy again after a failure")
        } icon: {
          Image(systemName: "arrow.clockwise")
        }
      }
      .buttonStyle(.bordered)
    case .none:
      EmptyView()
    }
  }
}
