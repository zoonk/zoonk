import SwiftUI
import UIKit

/// A chapter's map full screen, on the goal that opened it whatever goal is shown meanwhile.
struct MindMapScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(MindMapsStore.self) private var store
  @State private var showsOutline = false

  let goalId: String
  let chapterId: String

  var body: some View {
    let map = store.map(goalId: goalId, chapterId: chapterId)

    NavigationStack {
      content(map)
        .navigationTitle(
          map.value.map { Text($0.title) }
            ?? Text(
              "Mind map", tableName: "MindMaps",
              comment: "Names a chapter's mind map screen until the map loads")
        )
        .loads(map, refreshable: false)
        .toolbarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button(role: .close) {
              dismiss()
            } label: {
              Label {
                Text("Close", tableName: "MindMaps", comment: "Closes the full-screen mind map")
              } icon: {
                Image(systemName: "xmark")
              }
            }
          }
        }
    }
  }

  @ViewBuilder
  private func content(_ map: Resource<ChapterMindMap>) -> some View {
    switch map.state {
    case .loaded(let value):
      let url = value.image.flatMap { URL(string: $0.url) }

      Group {
        if let url, !showsOutline {
          ZoomableRemoteImage(url: url, title: value.title)
            .ignoresSafeArea(edges: .bottom)
        } else if let outline = value.outline {
          ScrollView {
            MindMapOutlineView(outline: outline)
              .taskColumn(alignment: .leading)
          }
        } else {
          ContentUnavailableView {
            Label {
              Text(
                "The mind map couldn't be made this time.", tableName: "MindMaps",
                comment: "Shown when a chapter has no map to show")
            } icon: {
              KindMark(kind: .mindMap)
            }
          }
          .lonePage()
        }
      }
      .mindMapSaveFailureAlert(goalId: goalId)
      .toolbar {
        if value.status == .ready {
          ToolbarItem(placement: .primaryAction) {
            MindMapSaveButton(
              target: SaveTarget(
                key: MindMapKey(kind: .chapter, targetId: value.chapterId), title: value.title,
                chapterId: value.chapterId), goalId: goalId, server: value.saved)
          }
        }

        if url != nil, value.outline != nil {
          ToolbarItem(placement: .primaryAction) {
            Toggle(isOn: $showsOutline) {
              Label {
                Text(
                  "As text", tableName: "MindMaps", comment: "Shows the map's outline in words")
              } icon: {
                Image(systemName: "text.alignleft")
              }
            }
            .toggleStyle(.button)
          }
        }
      }
    case .failed, .empty:
      MindMapUnreachable {
        Task { await map.refresh() }
      }
    case .idle, .loading:
      ProgressView()
    }
  }
}

/// A read of maps that didn't reach the server, as main says it, with an outlined Try again so a
/// screen's own main button stays the only filled one.
struct MindMapUnreachable: View {
  let retry: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "We couldn't reach the server.", tableName: "MindMaps",
          comment: "A map that failed to load")
      } icon: {
        Image(systemName: "wifi.exclamationmark")
      }
    } description: {
      Text(
        "Check your connection.", tableName: "MindMaps",
        comment: "Under a map that failed to load: what the learner can check")
    } actions: {
      Button(action: retry) {
        Text("Try again", tableName: "MindMaps", comment: "Retries")
      }
      .buttonStyle(.outline)
    }
    .lonePage()
  }
}

/// Main's `MindMapOutline`: the map in words, under whatever names it. Its central idea, its
/// numbered branches, the comparison, and the gist last.
struct MindMapOutlineView: View {
  @Environment(\.legibilityWeight) private var legibility

  let outline: ChapterMindMap.Outline

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      Text(outline.centralIdea)
        .foregroundStyle(.mutedForeground)

      VStack(alignment: .leading, spacing: 16) {
        ForEach(Array(outline.branches.enumerated()), id: \.offset) { index, branch in
          HStack(alignment: .top, spacing: 12) {
            Text(verbatim: (index + 1).formatted())
              .typeStyle(.data.weight(.medium))
              .foregroundStyle(.mutedForeground)
              .frame(width: 24, height: 24)
              .background(.muted, in: .rect(cornerRadius: Radius.sm, style: .continuous))
              .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
              Text(branch.title)
                .typeStyle(.rowTitle)
              Text(branch.explanation)
              OutlinePoints(points: branch.points)
            }
          }
        }
      }

      if let comparison = outline.comparison {
        VStack(alignment: .leading, spacing: 8) {
          Text(comparison.title)
            .typeStyle(.note.weight(.medium))
            .foregroundStyle(.mutedForeground)

          LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .topLeading)],
            alignment: .leading, spacing: 12
          ) {
            ForEach(comparison.columns, id: \.self) { column in
              VStack(alignment: .leading, spacing: 4) {
                Text(column.name)
                  .typeStyle(.rowTitle)
                OutlinePoints(points: column.points)
              }
            }
          }
        }
      }

      Text(
        AttributedString(
          localized: "**In short:** \(outline.summary)", table: "MindMaps",
          comment: "The map's summary, after its label in bold"),
        strong: .medium, legibility: legibility)
    }
    .typeStyle(.body)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// A branch's or a column's bullets, muted under its words.
private struct OutlinePoints: View {
  let points: [String]

  var body: some View {
    ForEach(points, id: \.self) { point in
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Image(systemName: "circle.fill")
          .typeStyle(.small)
          .imageScale(.small)
          .accessibilityHidden(true)
        Text(point)
      }
      .foregroundStyle(.mutedForeground)
    }
  }
}

struct ZoomableRemoteImage: View {
  @State private var image: UIImage?
  @State private var failed = false

  let url: URL
  let title: String

  var body: some View {
    Group {
      if let image {
        ZoomableImage(image: image)
          .accessibilityElement()
          .accessibilityLabel(
            Text(
              "Mind map of \(title)", tableName: "MindMaps",
              comment: "Spoken label of a map's picture")
          )
          .accessibilityAddTraits(.isImage)
          .toolbar {
            ToolbarItem(placement: .primaryAction) {
              ShareLink(
                item: Image(uiImage: image),
                preview: SharePreview(title, image: Image(uiImage: image)))
            }
          }
      } else if failed {
        ContentUnavailableView {
          Label {
            Text(
              "We couldn't reach the server.", tableName: "MindMaps",
              comment: "A map that failed to load")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        }
        .lonePage()
      } else {
        ProgressView()
      }
    }
    .task(id: url) {
      do {
        let (data, _) = try await URLSession.shared.data(from: url)
        image = UIImage(data: data)
        failed = image == nil
      } catch {
        failed = !(error is CancellationError)
      }
    }
  }
}
