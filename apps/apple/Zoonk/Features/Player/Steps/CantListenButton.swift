import SwiftUI

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
    .buttonStyle(.outline)
    .controlSize(.large)
  }
}
