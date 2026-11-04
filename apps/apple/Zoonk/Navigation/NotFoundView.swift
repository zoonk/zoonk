import SwiftUI

struct NotFoundView: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "We couldn't find this page", tableName: "Navigation",
          comment: "Title shown when a link leads to something that doesn't exist")
      } icon: {
        Image(systemName: "magnifyingglass")
      }
    } description: {
      Text(
        "The link may be old or mistyped.", tableName: "Navigation",
        comment: "Explains why a link leads to something that doesn't exist")
    } actions: {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text(
          "Go to the home page", tableName: "Navigation",
          comment: "Opens Today from a link that leads to something that doesn't exist")
      }
      .buttonStyle(.mainAction)
    }
    .lonePage()
  }
}
