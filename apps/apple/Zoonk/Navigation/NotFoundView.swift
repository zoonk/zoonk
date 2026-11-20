import SwiftUI

struct NotFoundView: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    StateMessage {
      Label {
        Text(
          "This isn't here anymore", tableName: "Navigation",
          comment: "Title shown when a link leads to something that doesn't exist")
      } icon: {
        Image(systemName: "magnifyingglass")
      }
    } description: {
      Text(
        "It may have been removed or moved.", tableName: "Navigation",
        comment: "Explains why a link leads to something that doesn't exist")
    } actions: {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Today", tableName: "Navigation",
          comment: "Opens Today from a link that leads to something that doesn't exist")
      }
      .buttonStyle(.mainAction)
    }
    .lonePage()
  }
}
