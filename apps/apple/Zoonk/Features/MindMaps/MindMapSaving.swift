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
  @Environment(SaveVisit<SaveTarget>.self) private var visit

  let target: SaveTarget
  let goalId: String
  let server: Bool

  var body: some View {
    let isSaved = store.saves.isSaved(target.key, server: server)

    SaveToggle(isSaved: isSaved, save: MindMapSaveWords.save, saved: MindMapSaveWords.saved) {
      visit.set(!isSaved, target, goalId: goalId, in: store.saves)
    }
  }
}

/// A saved map's words, the map's own: other saved things agree differently in some languages.
enum MindMapSaveWords {
  static var save: Text {
    Text("Save", tableName: "MindMaps", comment: "Saves a map to study again")
  }

  static var saved: Text {
    Text("Saved", tableName: "MindMaps", comment: "A map the learner saved to study again")
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

  /// The screen's visit for map saves: "Couldn't save this map." or "Couldn't remove this map."
  /// over it when one of its saves didn't work.
  func mindMapSaveVisit() -> some View {
    saveVisit(of: SaveTarget.self) { failure in
      failure.saved
        ? Text(
          "Couldn't save this map. Try again.", tableName: "MindMaps")
        : Text(
          "Couldn't remove this map. Try again.", tableName: "MindMaps")
    }
  }
}

private struct SavesMindMap: ViewModifier {
  @Environment(MindMapsStore.self) private var store
  @Environment(SaveVisit<SaveTarget>.self) private var visit

  let target: SaveTarget
  let goalId: String
  let server: Bool
  let isAvailable: Bool

  func body(content: Content) -> some View {
    if isAvailable {
      let isSaved = store.saves.isSaved(target.key, server: server)

      content.savesFromRow(
        isSaved: isSaved, save: MindMapSaveWords.save,
        remove: Text(
          "Remove from saved", tableName: "MindMaps",
          comment: "Takes a map out of the learner's saved maps")
      ) {
        visit.set(!isSaved, target, goalId: goalId, in: store.saves)
      }
    } else {
      content
    }
  }
}
