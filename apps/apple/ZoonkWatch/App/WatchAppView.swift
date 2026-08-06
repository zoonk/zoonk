import SwiftUI

struct WatchAppView: View {
  @State private var session: WatchCredentialStore

  /// Owns the paired-device session for the lifetime of the Watch app scene so authentication updates do not disappear during view refreshes.
  init(session: WatchCredentialStore = WatchCredentialStore()) {
    _session = State(initialValue: session)
  }

  var body: some View {
    NavigationStack {
      Group {
        switch session.state {
        case .restoring:
          ProgressView {
            Text(
              "Checking your account…",
              tableName: "Navigation",
              comment: "Loading message while Apple Watch receives account state from iPhone")
          }
        case .signedIn:
          List(WatchSection.allCases) { section in
            NavigationLink {
              Color.clear
                .navigationTitle(section.title)
            } label: {
              Label {
                Text(section.title)
              } icon: {
                Image(systemName: section.systemImage)
              }
            }
          }
        case .signedOut:
          ContentUnavailableView {
            Label {
              Text(
                "Sign in on iPhone",
                tableName: "Navigation",
                comment: "Title asking an Apple Watch user to authenticate in the companion app")
            } icon: {
              Image(systemName: "iphone")
            }
          } description: {
            Text(
              "Open Zoonk on your iPhone and sign in. This Apple Watch will update automatically.",
              tableName: "Navigation",
              comment: "Explains the phone-first authentication handoff on Apple Watch")
          }
        }
      }
      .navigationTitle(Text(verbatim: "Zoonk"))
    }
  }
}

#Preview {
  WatchAppView(session: WatchCredentialStore(previewState: .signedOut))
}
