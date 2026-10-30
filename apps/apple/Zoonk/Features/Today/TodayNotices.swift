import SwiftUI

/// Main's `TodayChangeNotice`: a correction to the source material the goal follows.
struct TodaySourceChangeSection: View {
  let message: String

  var body: some View {
    Section {
      Text(message)
    } header: {
      Label {
        Text("What changed", tableName: "Today", comment: "A change to the goal's sources")
      } icon: {
        Image(systemName: "doc.badge.clock")
      }
    }
  }
}
