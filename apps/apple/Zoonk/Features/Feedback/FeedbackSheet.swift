import SwiftUI

struct FeedbackSheet: View {
  @Environment(\.dismiss) private var dismiss
  @FocusState private var focusedField: FeedbackField?
  @State private var store: FeedbackFormStore

  init(api: any FeedbackAPIClient, defaultEmail: String? = nil) {
    _store = State(
      initialValue: FeedbackFormStore(
        api: api,
        defaultEmail: defaultEmail))
  }

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
        Text(
          "Feedback",
          tableName: "Feedback",
          comment: "Navigation title for the feedback form.")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(action: dismiss.callAsFunction) {
            if store.state == .sent {
              Text(
                "Done",
                tableName: "Feedback",
                comment: "Dismisses the feedback success confirmation.")
            } else {
              Text(
                "Cancel",
                tableName: "Feedback",
                comment: "Dismisses the feedback form without sending it.")
            }
          }
          .disabled(store.state == .submitting)
        }

        if store.state != .sent {
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
    .interactiveDismissDisabled(store.state == .submitting)
    .presentationDetents([.medium, .large])
    .presentationDragIndicator(.visible)
  }

  private var form: some View {
    Form {
      Section {
        Text(
          "Share feedback, ask a question, or tell us what we could improve.",
          tableName: "Feedback",
          comment: "Introduction shown above the feedback fields."
        )
        .foregroundStyle(.secondary)
      }

      Section {
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
      } footer: {
        Text(
          "We'll use this email to contact you.",
          tableName: "Feedback",
          comment: "Explains why the feedback form asks for an email address.")
      }

      Section {
        TextField(
          text: $store.message,
          prompt: Text(
            "How can we help?",
            tableName: "Feedback",
            comment: "Placeholder in the feedback message field."),
          axis: .vertical
        ) {
          Text(
            "Message",
            tableName: "Feedback",
            comment: "Message field label in the feedback form.")
        }
        .focused($focusedField, equals: .message)
        .lineLimit(5...10)
        .accessibilityLabel(
          Text(
            "Message",
            tableName: "Feedback",
            comment: "Message field label in the feedback form."))
      } footer: {
        Text(
          "Please provide as much detail as possible.",
          tableName: "Feedback",
          comment: "Guidance below the feedback message field.")
      }

      if case .failed(let failure) = store.state {
        Section {
          Label {
            Text(failureMessage(failure))
          } icon: {
            Image(systemName: "exclamationmark.triangle")
          }
          .foregroundStyle(.red)
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

  private var confirmation: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Thanks for your feedback",
          tableName: "Feedback",
          comment: "Confirmation title after feedback is sent.")
      } icon: {
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(.green)
      }
    } description: {
      Text(
        "Your message was sent.",
        tableName: "Feedback",
        comment: "Confirmation message after feedback is sent.")
    }
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
