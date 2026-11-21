import SwiftUI

/// The way around listening, under the step, where a speaking screen has "I can't talk now". The
/// choice holds for the rest of the learner's day, as on main.
struct CantListenButton: View {
  let cantListen: Bool
  let toggle: @MainActor () -> Void

  var body: some View {
    Button(action: toggle) {
      if cantListen {
        Label {
          Text("I can listen now", tableName: "Player")
        } icon: {
          Image(systemName: "ear")
        }
      } else {
        Label {
          Text("I can't listen now", tableName: "Player")
        } icon: {
          Image(systemName: "speaker.slash")
        }
      }
    }
    .buttonStyle(.borderless)
  }
}
