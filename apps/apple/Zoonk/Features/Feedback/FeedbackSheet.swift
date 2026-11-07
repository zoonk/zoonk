import SwiftUI

extension View {
  /// The feedback form, its store kept with the screen that opens it: unfolding iPhone Duo makes
  /// the sheet's content again, which would lose a half-written message or a send in flight.
  func feedbackSheet(
    isPresented: Binding<Bool>, context: FeedbackContext, isReport: Bool = false
  ) -> some View {
    modifier(FeedbackSheetPresenter(isPresented: isPresented, context: context, isReport: isReport))
  }
}

private struct FeedbackSheetPresenter: ViewModifier {
  @Environment(SessionStore.self) private var session
  @Environment(LearnerSummaryStore.self) private var learner
  @Binding var isPresented: Bool
  let context: FeedbackContext
  let isReport: Bool

  @State private var store: FeedbackFormStore?

  func body(content: Content) -> some View {
    content
      .onChange(of: isPresented, initial: true) { _, isShown in
        store =
          isShown
          ? FeedbackFormStore(
            api: FeedbackAPI.live(), context: context, session: session, learner: learner)
          : nil
      }
      .sheet(item: $store, onDismiss: dismissed, content: form)
  }

  private func dismissed() {
    isPresented = false
  }

  private func form(_ store: FeedbackFormStore) -> some View {
    FeedbackForm(store: store, isReport: isReport)
      .zoonkStyles()
  }
}

struct FeedbackSheet: View {
  @Environment(SessionStore.self) private var session
  @Environment(LearnerSummaryStore.self) private var learner

  let api: any FeedbackAPIClient
  var context: FeedbackContext?
  var isReport = false

  var body: some View {
    OwnedFeedbackForm(
      store: FeedbackFormStore(api: api, context: context, session: session, learner: learner),
      isReport: isReport)
  }
}

private struct OwnedFeedbackForm: View {
  @State var store: FeedbackFormStore
  let isReport: Bool

  var body: some View {
    FeedbackForm(store: store, isReport: isReport)
  }
}

extension FeedbackFormStore: Identifiable {
  /// Only a visitor or a guest, whose account has no real email, types an email to be answered at.
  convenience init(
    api: any FeedbackAPIClient, context: FeedbackContext?, session: SessionStore,
    learner: LearnerSummaryStore
  ) {
    self.init(
      api: api, context: context,
      defaultEmail: learner.summary.value?.identity.isAnonymous == true
        ? nil : session.account?.user.email,
      token: session.authenticatedSession?.bearerToken)
  }

  var asksForEmail: Bool {
    defaultEmail.isEmpty
  }
}

private struct FeedbackForm: View {
  @Environment(\.dismiss) private var dismiss
  @FocusState private var focusedField: FeedbackField?
  @Bindable var store: FeedbackFormStore
  let isReport: Bool

  var body: some View {
    NavigationStack {
      Group {
        if store.state == .sent {
          confirmation
        } else {
          form
        }
      }
      .navigationTitle(
        isReport
          ? Text(
            "Report a problem", tableName: "Feedback",
            comment: "Navigation title for the form reporting a problem with a page")
          : Text(
            "Send feedback",
            tableName: "Feedback",
            comment: "Navigation title for the feedback form.")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        if store.state == .sent {
          ToolbarItem(placement: .confirmationAction) {
            Button(action: dismiss.callAsFunction) {
              Text(
                "Done",
                tableName: "Feedback",
                comment: "Dismisses the feedback success confirmation.")
            }
          }
        } else {
          ToolbarItem(placement: .cancellationAction) {
            Button(action: dismiss.callAsFunction) {
              Text(
                "Cancel",
                tableName: "Feedback",
                comment: "Dismisses the feedback form without sending it.")
            }
            .disabled(store.state == .submitting)
          }

          ToolbarItem(placement: .confirmationAction) {
            Button(action: submit) {
              if store.state == .submitting {
                ProgressView()
                  .controlSize(.small)
                  .accessibilityLabel(
                    Text(
                      "Sending feedback",
                      tableName: "Feedback",
                      comment: "Accessibility status while feedback is being sent."))
              } else {
                Text(
                  "Send",
                  tableName: "Feedback",
                  comment: "Submits the feedback form.")
              }
            }
            .disabled(!store.canSubmit)
          }
        }
      }
    }
    .announcesStatus(store.state == .sent ? thanks : nil)
    .interactiveDismissDisabled(store.state == .submitting)
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
  }

  private var form: some View {
    ZoonkList {
      if !isReport {
        Section {
          Text(
            "Found a problem or have an idea? Tell us below or email hello@zoonk.com.",
            tableName: "Feedback",
            comment: "Introduction shown above the feedback fields."
          )
          .foregroundStyle(.mutedForeground)
          .listRowBackground(Color.clear)
        }
      }

      if store.asksForEmail {
        Section {
          FormField(
            title: Text(
              "Email address",
              tableName: "Feedback",
              comment: "Email field label in the feedback form."),
            isFocused: focusedField == .email
          ) {
            emailField
          }
        } footer: {
          SectionFooter {
            Text(
              "We'll use this email to contact you.",
              tableName: "Feedback",
              comment: "Explains why the feedback form asks for an email address.")
          }
        }
      }

      Section {
        FormField(
          title: Text(
            "Message",
            tableName: "Feedback",
            comment: "Message field label in the feedback form."),
          isFocused: focusedField == .message
        ) {
          MultilineTextField(
            text: $store.message,
            prompt: Text(
              "How can we help you?",
              tableName: "Feedback",
              comment: "Placeholder in the feedback message field."),
            label: Text(
              "Message",
              tableName: "Feedback",
              comment: "Message field label in the feedback form.")
          )
          .focused($focusedField, equals: .message)
          .lineLimit(5...10)
        }
      } footer: {
        SectionFooter {
          if store.attachesScreen {
            Label {
              Text(
                "This screen is attached",
                tableName: "Feedback",
                comment: "Says the message is sent with the page it was written on")
            } icon: {
              Image(systemName: "paperclip")
            }
          }
        }
      }

      if case .failed(let failure) = store.state {
        Section {
          FailureLine(
            message: failureMessage(failure), systemImage: "exclamationmark.triangle"
          )
          .accessibilityAddTraits(.isStaticText)
        }
      }
    }
    .disabled(store.state == .submitting)
    .onChange(of: store.email) { _, _ in
      store.clearFailure()
    }
    .onChange(of: store.message) { _, _ in
      store.clearFailure()
    }
  }

  private var emailField: some View {
    TextField(
      text: $store.email,
      prompt: Text(
        "you@example.com",
        tableName: "Feedback",
        comment: "Example email address in the feedback form.")
    ) {
      Text(
        "Email address",
        tableName: "Feedback",
        comment: "Email field label in the feedback form.")
    }
    .focused($focusedField, equals: .email)
    .textInputAutocapitalization(.never)
    .keyboardType(.emailAddress)
    .autocorrectionDisabled()
    .textContentType(.emailAddress)
    .submitLabel(.next)
    .onSubmit {
      focusedField = .message
    }
    .accessibilityLabel(
      Text(
        "Email address",
        tableName: "Feedback",
        comment: "Email field label in the feedback form."))
  }

  private var confirmation: some View {
    ContentUnavailableView {
      Label {
        Text(thanks)
      } icon: {
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(.success)
          .accessibilityHidden(true)
      }
    }
  }

  private var thanks: String {
    String(
      localized: "Thanks! We got your message.", table: "Feedback",
      comment: "Confirmation after feedback is sent.")
  }

  private func submit() {
    focusedField = nil

    Task {
      await store.submit()
    }
  }

  private func failureMessage(_ failure: FeedbackFailure) -> LocalizedStringResource {
    switch failure {
    case .network:
      LocalizedStringResource(
        "You're offline. Check your connection and try again.",
        table: "Feedback",
        comment: "Feedback form error when the network is unavailable.")
    case .unavailable:
      LocalizedStringResource(
        "Feedback couldn't be sent. Try again later.",
        table: "Feedback",
        comment: "Feedback form error when the service is temporarily unavailable.")
    case .validation:
      LocalizedStringResource(
        "Check your email and message, then try again.",
        table: "Feedback",
        comment: "Feedback form error when the submitted fields are invalid.")
    }
  }
}

private enum FeedbackField: Hashable {
  case email
  case message
}
