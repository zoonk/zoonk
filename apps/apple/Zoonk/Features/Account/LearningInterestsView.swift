import SwiftUI

struct LearningInterestsView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var store: LearningProfileStore

  init(api: any LearningProfileAPIClient = LearningProfileAPI.live()) {
    _store = State(initialValue: LearningProfileStore(api: api))
  }

  var body: some View {
    Form {
      if store.isLoaded {
        Section {
          ForEach(LearningInterestSuggestion.allCases) { interest in
            Toggle(
              isOn: Binding(
                get: { store.includes(interest) },
                set: { store.set(interest, selected: $0) })
            ) {
              Label {
                Text(interest.title)
              } icon: {
                Image(systemName: interest.systemImage)
              }
            }
            .disabled(store.isWorking)
          }
        } header: {
          Text(
            "What do you enjoy?", tableName: "Account",
            comment: "Label for optional learning interests")
        } footer: {
          Text(
            "Choose any that interest you. These help us choose familiar examples in your personal courses. You can skip this or change it anytime.",
            tableName: "Account",
            comment: "Explains the purpose and optional nature of suggested learning interests")
        }
        Section {
          TextField(text: $store.customInterestsText, axis: .vertical) {
            Text(
              "Football\nGardening\nBoard games", tableName: "Account",
              comment: "Examples of custom interests, one per line")
          }
          .lineLimit(4...12)
          .accessibilityLabel(
            Text(
              "Other interests", tableName: "Account",
              comment: "Label for optional custom learning interests")
          )
          .disabled(store.isWorking)
        } header: {
          Text(
            "Other interests", tableName: "Account",
            comment: "Label for optional custom learning interests")
        } footer: {
          Text(
            "Add one interest per line, or leave this blank.",
            tableName: "Account",
            comment: "Guidance for entering custom learning interests")
        }
      } else if store.isWorking {
        Section {
          ProgressView {
            Text(
              "Loading interests…", tableName: "Account",
              comment: "Loading state for learning interests")
          }
        }
      }

      if let failure = store.failure {
        Section {
          Text(
            failure == .invalid
              ? LocalizedStringResource(
                "Use up to 50 interests, with 120 characters or fewer each.", table: "Account",
                comment: "Explains the limits for learning interest entries")
              : LocalizedStringResource(
                "We couldn't save or load your interests. Your changes are still here. Please try again.",
                table: "Account", comment: "Recoverable learning interests network failure")
          )
          .foregroundStyle(.red)
          if !store.isLoaded {
            Button {
              Task { await store.load(session: session, force: true) }
            } label: {
              Text("Try again", tableName: "Account", comment: "Retries loading learning interests")
            }
          }
        }
      }
    }
    .navigationTitle(
      Text("Interests", tableName: "Account", comment: "Learning interests screen title")
    )
    .navigationBarTitleDisplayMode(.inline)
    .toolbar {
      ToolbarItem(placement: .confirmationAction) {
        Button {
          Task {
            if await store.save(session: session) { dismiss() }
          }
        } label: {
          if store.isWorking && store.isLoaded {
            ProgressView()
          } else {
            Text("Save", tableName: "Account", comment: "Saves learning interests")
          }
        }
        .disabled(!store.isLoaded || store.isWorking)
      }
    }
    .task(id: session.authenticatedSession) {
      await store.load(session: session)
    }
  }
}
