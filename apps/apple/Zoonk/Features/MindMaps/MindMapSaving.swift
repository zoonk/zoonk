import SwiftUI

/// Main's saved mark: a bookmark in the text color, never a star or a color of its own.
struct SavedMark: View {
  var body: some View {
    Image(systemName: "bookmark.fill")
      .typeStyle(.meta)
      .foregroundStyle(Color(.foreground))
      .accessibilityLabel(
        Text("Saved", tableName: "MindMaps", comment: "A map the learner saved to study again"))
  }
}

/// The reader's and the map viewer's Save: its words and its bookmark say whether it's saved.
struct MindMapSaveButton: View {
  @Environment(MindMapsStore.self) private var store

  let target: SaveTarget
  let goalId: String
  let server: Bool

  var body: some View {
    let isSaved = store.isSaved(target.key, server: server)

    Button {
      store.setSaved(!isSaved, target: target, goalId: goalId)
    } label: {
      Label {
        if isSaved {
          Text("Saved", tableName: "MindMaps", comment: "A map the learner saved to study again")
        } else {
          Text("Save", tableName: "MindMaps", comment: "Saves a map to study again")
        }
      } icon: {
        Image(systemName: isSaved ? "bookmark.fill" : "bookmark")
      }
    }
    .accessibilityAddTraits(isSaved ? .isSelected : [])
    .sensoryFeedback(.selection, trigger: isSaved)
  }
}

extension View {
  /// A row's swipe and context-menu Save, where the row is a map that opens.
  func savesMindMap(_ target: SaveTarget, goalId: String, server: Bool, isAvailable: Bool = true)
    -> some View
  {
    modifier(
      SavesMindMap(target: target, goalId: goalId, server: server, isAvailable: isAvailable))
  }

  /// "Couldn't save this map. Try again." over the screen that tried.
  func mindMapSaveFailureAlert(goalId: String) -> some View {
    modifier(MindMapSaveFailureAlert(goalId: goalId))
  }
}

private struct SavesMindMap: ViewModifier {
  @Environment(MindMapsStore.self) private var store

  let target: SaveTarget
  let goalId: String
  let server: Bool
  let isAvailable: Bool

  func body(content: Content) -> some View {
    if isAvailable {
      content
        .swipeActions(edge: .trailing, allowsFullSwipe: true) { button }
        .contextMenu { button }
    } else {
      content
    }
  }

  private var button: some View {
    let isSaved = store.isSaved(target.key, server: server)

    return Button {
      store.setSaved(!isSaved, target: target, goalId: goalId)
    } label: {
      Label {
        if isSaved {
          Text(
            "Remove from saved", tableName: "MindMaps",
            comment: "Takes a map out of the learner's saved maps")
        } else {
          Text("Save", tableName: "MindMaps", comment: "Saves a map to study again")
        }
      } icon: {
        Image(systemName: isSaved ? "bookmark.slash" : "bookmark")
      }
    }
  }
}

private struct MindMapSaveFailureAlert: ViewModifier {
  @Environment(MindMapsStore.self) private var store

  let goalId: String

  func body(content: Content) -> some View {
    content.alert(
      Text(
        "Couldn't save this map. Try again.", tableName: "MindMaps",
        comment: "Saving or removing a saved map didn't work, so it's back as it was"),
      isPresented: Binding(
        get: { store.saveFailed(goalId: goalId) },
        set: { isPresented in
          if !isPresented {
            store.dismissSaveFailure()
          }
        })
    ) {
      Button(role: .cancel) {
      } label: {
        Text("OK", tableName: "MindMaps", comment: "Closes the message that a save didn't work")
      }
    }
  }
}
