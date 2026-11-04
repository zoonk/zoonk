import SwiftUI

struct MindMapsScreen: View {
  @Environment(\.stacksContent) private var isStacked
  @Environment(LearnerSummaryStore.self) private var learner
  @ScaledMetric(relativeTo: .body) private var tileWidth = 160.0
  @Environment(MindMapsStore.self) private var store
  @State private var gridSpace = PaneSpace(width: 0)

  var body: some View {
    if let goal = learner.summary.value?.shownGoal {
      let list = store.list(goalId: goal.id)

      content(list: list, goal: goal)
        .navigationTitle(
          Text("Mind maps", tableName: "MindMaps", comment: "Title of the mind maps page")
        )
        .loads(list)
    }
  }

  /// At a hinge each side's columns keep at any text size, each side about a phone wide.
  private var columns: [GridItem] {
    if let hinge = gridSpace.columnsAroundHinge(minimum: tileWidth, spacing: 16) {
      return hinge.map { GridItem(.fixed($0.width), spacing: $0.spacing) }
    }

    return isStacked
      ? [GridItem(.flexible())] : [GridItem(.adaptive(minimum: tileWidth), spacing: 16)]
  }

  @ViewBuilder
  private func content(list: Resource<GoalMindMaps>, goal: LearnerGoal) -> some View {
    switch list.state {
    case .loaded(let maps):
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          AccessibilityStack(alignment: .firstTextBaseline, stackedSpacing: 4) {
            Text(
              "Chapters you finished", tableName: "MindMaps",
              comment: "Heading of the chapters with mind maps"
            )
            .typeStyle(.body.weight(.semibold))
            .frame(maxWidth: .infinity, alignment: .leading)

            Text(
              "\(maps.chapters.count) chapters", tableName: "MindMaps",
              comment: "How many chapters have mind maps"
            )
            .typeStyle(.note)
            .foregroundStyle(.secondary)
          }

          LazyVGrid(columns: columns, spacing: 16) {
            ForEach(maps.chapters) { map in
              MindMapTile(goalId: goal.id, map: map)
            }
          }
          .onGeometryChange(for: PaneSpace.self) {
            PaneSpace($0)
          } action: {
            gridSpace = $0
          }
        }
        .scenePadding()
      }
    case .empty:
      ContentUnavailableView {
        Label {
          Text(
            "No mind maps yet", tableName: "MindMaps", comment: "Title when no chapter has a map")
        } icon: {
          KindMark(kind: .mindMap)
        }
      } description: {
        Text(
          "Finish a chapter to make its mind map: its main ideas in one picture.",
          tableName: "MindMaps", comment: "Explains how a chapter gets a mind map")
      }
      .lonePage()
    case .failed:
      ContentUnavailableView {
        Label {
          Text(
            "We couldn't reach the server.", tableName: "MindMaps",
            comment: "Shown when mind maps failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await list.refresh() }
        } label: {
          Text("Try again", tableName: "MindMaps", comment: "Retries")
        }
        .buttonStyle(.bordered)
      }
      .lonePage()
    case .idle, .loading:
      ProgressView()
    }
  }
}

private struct MindMapTile: View {
  @Environment(AppRouter.self) private var router
  @Environment(MindMapsStore.self) private var store

  let goalId: String
  let map: ChapterMindMap

  var body: some View {
    let drawing = store.requesting.contains(map.chapterId) || map.status == .generating

    VStack(alignment: .leading, spacing: 8) {
      Button {
        router.open(.mindMap(chapterId: map.chapterId))
      } label: {
        Color(.secondarySystemBackground)
          .aspectRatio(4 / 3, contentMode: .fit)
          .overlay {
            picture
          }
          .clipShape(.rect(cornerRadius: 12, style: .continuous))
      }
      .buttonStyle(.plain)
      .disabled(map.status != .ready)
      .accessibilityLabel(
        Text(
          "Mind map of \(map.title)", tableName: "MindMaps",
          comment: "Spoken label of a map's picture"))

      Text("Chapter \(map.position)", tableName: "MindMaps", comment: "A chapter's number")
        .typeStyle(.data)
        .foregroundStyle(.tertiary)

      Text(map.title)
        .typeStyle(.body.weight(.medium))
        .lineLimit(2)

      if drawing {
        Label {
          Text("Drawing…", tableName: "MindMaps", comment: "A map being drawn")
        } icon: {
          ProgressView()
        }
        .typeStyle(.note)
        .foregroundStyle(.secondary)
      } else if map.status == .available || map.status == .failed {
        if let failure = store.failures[map.chapterId] {
          failureText(failure)
            .typeStyle(.note)
            .foregroundStyle(.destructive)
        } else if map.status == .failed {
          Text(
            "It couldn't be made this time.", tableName: "MindMaps", comment: "A map that failed"
          )
          .typeStyle(.note)
          .foregroundStyle(.secondary)
        }

        Button {
          Task { await store.create(goalId: goalId, chapterId: map.chapterId) }
        } label: {
          if map.status == .failed || store.failures[map.chapterId] != nil {
            Text("Try again", tableName: "MindMaps", comment: "Makes a failed map again")
          } else {
            Text("Create", tableName: "MindMaps", comment: "Makes the chapter's mind map")
          }
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
      }
    }
    // Read only: a map already being drawn when the page opened is followed until it's done.
    .task(id: map.status) {
      if map.status == .generating {
        await store.follow(goalId: goalId, chapterId: map.chapterId)
      }
    }
  }

  @ViewBuilder
  private var picture: some View {
    if let thumbnail = map.image.flatMap({ URL(string: $0.thumbnailUrl ?? $0.url) }) {
      AsyncImage(url: thumbnail) { image in
        image.resizable().scaledToFit()
      } placeholder: {
        Color.clear
      }
    } else {
      KindMark(kind: .mindMap)
        .typeStyle(.heroTitle.weight(.regular))
    }
  }

  private func failureText(_ failure: MindMapRequestFailure) -> Text {
    switch failure {
    case .limit:
      Text(
        "Your plan made all its mind maps for now.", tableName: "MindMaps",
        comment: "A map refused by the learner's plan limit")
    case .unreachable:
      Text(
        "We couldn't reach the server.", tableName: "MindMaps", comment: "A map request that failed"
      )
    }
  }
}
