import SwiftUI
import UIKit

struct MindMapScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(MindMapsStore.self) private var store
  @State private var showsOutline = false

  let chapterId: String

  var body: some View {
    NavigationStack {
      Group {
        if let goal = learner.summary.value?.shownGoal {
          let map = store.map(goalId: goal.id, chapterId: chapterId)

          content(map)
            .navigationTitle(
              map.value.map { Text($0.title) }
                ?? Text(
                  "Mind map", tableName: "MindMaps",
                  comment: "Names a chapter's mind map screen until the map loads")
            )
            .loads(map, refreshable: false)
        }
      }
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
          MindMapOutlineView(outline: outline)
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
      .toolbar {
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
      ContentUnavailableView {
        Label {
          Text(
            "We couldn't reach the server.", tableName: "MindMaps",
            comment: "A map that failed to load")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } actions: {
        Button {
          Task { await map.refresh() }
        } label: {
          Text("Try again", tableName: "MindMaps", comment: "Retries")
        }
        .buttonStyle(.outline)
      }
      .lonePage()
    case .idle, .loading:
      ProgressView()
    }
  }
}

private struct MindMapOutlineView: View {
  let outline: ChapterMindMap.Outline

  var body: some View {
    ZoonkList {
      Section {
        Text(outline.centralIdea)
          .typeStyle(.body.weight(.semibold))

        if let summary = outline.summary, !summary.isEmpty {
          Text("In short: \(summary)", tableName: "MindMaps", comment: "The map's summary")
            .foregroundStyle(.mutedForeground)
        }
      }

      ForEach(outline.branches, id: \.self) { branch in
        Section {
          Text(branch.explanation)

          ForEach(branch.points, id: \.self) { point in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Image(systemName: "circle.fill")
                .typeStyle(.small)
                .imageScale(.small)
                .foregroundStyle(.faint)
                .accessibilityHidden(true)
              Text(point)
            }
            .typeStyle(.body)
          }
        } header: {
          SectionTitle(Text(branch.title))
        }
      }
    }
  }
}

private struct ZoomableRemoteImage: View {
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
