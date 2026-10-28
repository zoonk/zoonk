import SwiftUI

/// The goal's mind maps: one tile per chapter the learner finished, its map's picture opening full
/// screen, or the tap that makes it. Without one yet, the chapter to finish next.
struct MindMapsScreen: View {
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @Environment(LearnerSummaryStore.self) private var learner
  /// Tiles grow with the text, so large text gets fewer, wider columns.
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
        .toolbarTitleDisplayMode(.inlineLarge)
        .loads(list)
    }
  }

  /// One tile a row at accessibility text sizes, where a scaled tile is wider than a phone; as many
  /// as fit otherwise, the same number on each side of iPhone Duo's fold while it's partially
  /// folded.
  private var columns: [GridItem] {
    if dynamicTypeSize.isAccessibilitySize {
      return [GridItem(.flexible())]
    }

    guard let fold = gridSpace.columnsAroundFold(minimum: tileWidth, spacing: 16) else {
      return [GridItem(.adaptive(minimum: tileWidth), spacing: 16)]
    }

    return fold.map { GridItem(.fixed($0.width), spacing: $0.spacing) }
  }

  @ViewBuilder
  private func content(list: Resource<GoalMindMaps>, goal: LearnerGoal) -> some View {
    switch list.state {
    case .loaded(let maps):
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          // Side by side, or one over the other at accessibility text sizes.
          (dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
            : AnyLayout(HStackLayout(alignment: .firstTextBaseline))) {
              Text(
                "Chapters you finished", tableName: "MindMaps",
                comment: "Heading of the chapters with mind maps"
              )
              .font(.headline)

              if !dynamicTypeSize.isAccessibilitySize {
                Spacer()
              }

              Text(
                "\(maps.chapters.count) chapters", tableName: "MindMaps",
                comment: "How many chapters have mind maps"
              )
              .font(.subheadline)
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
    case .idle, .loading:
      ProgressView()
    }
  }
}

/// A chapter's map as a tile: its picture opening full screen once drawn, else "Create", the
/// drawing in progress, or "Try again".
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
        // Every tile keeps the picture's shape, drawn or not, so the grid's rows line up.
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
        .font(.caption.monospaced())
        .foregroundStyle(.tertiary)

      Text(map.title)
        .font(.subheadline.weight(.medium))
        .lineLimit(2)

      if drawing {
        Label {
          Text("Drawing…", tableName: "MindMaps", comment: "A map being drawn")
        } icon: {
          ProgressView()
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
      } else if map.status == .available || map.status == .failed {
        if let failure = store.failures[map.chapterId] {
          failureText(failure)
            .font(.footnote)
            .foregroundStyle(.destructive)
        } else if map.status == .failed {
          Text(
            "It couldn't be made this time.", tableName: "MindMaps", comment: "A map that failed"
          )
          .font(.footnote)
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
    // A map already being drawn when the page opened is followed (read only) until it's done.
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
        .font(.largeTitle)
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
