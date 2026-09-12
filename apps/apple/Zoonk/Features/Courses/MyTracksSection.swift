import SwiftUI

struct MyTracksSection: View {
  @Environment(MyCoursesStore.self) private var myCourses
  let query: String

  var body: some View {
    let store = myCourses.tracks
    let visible = store.items.filter { query.isEmpty || $0.title.localizedStandardContains(query) }
    if !visible.isEmpty || store.failure != nil || store.isWorking || store.nextCursor != nil {
      VStack(alignment: .leading, spacing: 12) {
        Text("Tracks", tableName: "Courses", comment: "Groups of courses in My Courses")
          .font(.headline).accessibilityAddTraits(.isHeader)
        ForEach(visible) { track in
          Link(
            destination: URL(string: "https://www.zoonk.com")!.appending(component: "tracks")
              .appending(component: track.id)
          ) {
            HStack(spacing: 12) {
              Image(systemName: "square.stack").foregroundStyle(Color(uiColor: .secondaryLabel))
              VStack(alignment: .leading, spacing: 4) {
                Text(track.title).foregroundStyle(.primary)
                Text(
                  "\(track.totalCourses) courses", tableName: "Courses",
                  comment: "Number of courses grouped in a learning track"
                )
                .font(.subheadline).foregroundStyle(Color(uiColor: .secondaryLabel))
              }
              Spacer(minLength: 8)
              Image(systemName: "arrow.up.right").font(.subheadline)
            }
            .frame(minHeight: 44)
            .multilineTextAlignment(.leading)
            .padding(.vertical, 4)
          }
          .accessibilityHint(
            Text(
              "Opens this track on the website", tableName: "Courses",
              comment: "Explains a native track link's destination"))
          Divider()
        }
        if store.isWorking { ProgressView() }
        if store.failure != nil {
          Text(
            "We couldn't load your tracks. Try again.", tableName: "Courses",
            comment: "Recoverable error when loading learning tracks"
          )
          .font(.subheadline).foregroundStyle(.secondary)
          Button {
            Task { await store.load(force: true, more: store.nextCursor != nil) }
          } label: {
            Text("Try again", tableName: "Courses", comment: "Retries loading learning tracks")
          }.frame(minHeight: 44).disabled(store.isWorking)
        } else if store.nextCursor != nil {
          Button {
            Task { await store.load(more: true) }
          } label: {
            Text(
              "Load more tracks", tableName: "Courses",
              comment: "Loads the next page of learning tracks")
          }.frame(minHeight: 44).disabled(store.isWorking)
        }
      }
      .padding(.bottom, 24)
    }
  }
}
