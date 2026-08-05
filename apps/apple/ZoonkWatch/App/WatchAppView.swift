import SwiftUI

struct WatchAppView: View {
  var body: some View {
    NavigationStack {
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
      .navigationTitle(Text(verbatim: "Zoonk"))
    }
  }
}

#Preview {
  WatchAppView()
}
