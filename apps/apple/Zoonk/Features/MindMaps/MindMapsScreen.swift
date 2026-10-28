import SwiftUI

/// The goal's mind maps: one tile per chapter the learner finished, its map's picture opening full
/// screen, or the tap that makes it. Without one yet, the chapter to finish next.
struct MindMapsScreen: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store

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

  @ViewBuilder
  private func content(list: Resource<GoalMindMaps>, goal: LearnerGoal) -> some View {
    switch list.state {
    case .loaded(let maps):
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          HStack(alignment: .firstTextBaseline) {
            Text(
              "Chapters you finished", tableName: "MindMaps",
              comment: "Heading of the chapters with mind maps"
            )
            .font(.headline)

            Spacer()

            Text(
              "\(maps.chapters.count) chapters", tableName: "MindMaps",
              comment: "How many chapters have mind maps"
            )
            .font(.subheadline)
            .foregroundStyle(.secondary)
          }

          LazyVGrid(columns: [GridItem(.adaptive(minimum: 160), spacing: 16)], spacing: 16) {
            ForEach(maps.chapters) { map in
              MindMapTile(goalId: goal.id, map: map)
            }
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
        picture
          .aspectRatio(4 / 3, contentMode: .fit)
          .frame(maxWidth: .infinity)
          .background(
            Color(.secondarySystemBackground), in: .rect(cornerRadius: 12, style: .continuous)
          )
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
