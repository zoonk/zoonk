import SwiftUI

/// A lesson row's bookmark at its end, with the row's swipe and context-menu Save: it saves the
/// lesson without opening it. `keep` runs first on Saved lessons, which keeps the row in place.
struct LessonRowSave: ViewModifier {
  @Environment(SavedLessonsStore.self) private var store
  @Environment(SaveVisit<LessonSaveTarget>.self) private var visit

  let target: LessonSaveTarget
  let goalId: String
  /// What the last read says.
  let server: Bool
  var keep: () -> Void = {}

  func body(content: Content) -> some View {
    let isSaved = store.saves.isSaved(target.lessonId, server: server)

    HStack(spacing: RowSaveToggle.gap) {
      content

      RowSaveToggle(
        isSaved: isSaved,
        save: Text(
          "Save \(target.title)", tableName: "SavedLessons"),
        saved: Text(
          "Saved \(target.title)", tableName: "SavedLessons",
          comment:
            "Read aloud for the bookmark on a saved lesson's row, which removes it: says the lesson {title} is saved."
        )
      ) {
        toggle(isSaved)
      }
    }
    .savesFromRow(
      isSaved: isSaved,
      save: Text("Save", tableName: "SavedLessons"),
      remove: Text(
        "Remove from saved", tableName: "SavedLessons",
        comment: "Takes a lesson out of the saved lessons, from its row's menu or swipe")
    ) {
      toggle(isSaved)
    }
  }

  private func toggle(_ isSaved: Bool) {
    keep()
    visit.set(!isSaved, target, goalId: goalId, in: store.saves)
  }
}

/// The lesson player's bookmark, from the first screen to the end: "Save" until it's "Saved".
struct LessonSaveButton: View {
  @Environment(SavedLessonsStore.self) private var store
  @Environment(SaveVisit<LessonSaveTarget>.self) private var visit

  let target: LessonSaveTarget
  let goalId: String
  /// Nil until the lesson's run says, while it can't be tapped yet.
  let server: Bool?

  var body: some View {
    let isSaved = store.saves.isSaved(target.lessonId, server: server ?? false)

    SaveToggle(
      isSaved: isSaved,
      save: Text("Save", tableName: "SavedLessons"),
      saved: Text(
        "Saved", tableName: "SavedLessons",
        comment: "Says the lesson is saved to do again later: the bookmark's state.")
    ) {
      visit.set(!isSaved, target, goalId: goalId, in: store.saves)
    }
    .labelStyle(.iconOnly)
    .disabled(server == nil)
  }
}

extension View {
  func savesLesson(
    _ target: LessonSaveTarget, goalId: String, server: Bool, keep: @escaping () -> Void = {}
  ) -> some View {
    modifier(LessonRowSave(target: target, goalId: goalId, server: server, keep: keep))
  }

  /// The screen's visit for lesson saves: "Couldn't save this lesson. Try again." over it when one
  /// of its saves didn't work.
  func lessonSaveVisit() -> some View {
    saveVisit(of: LessonSaveTarget.self) { failure in
      failure.saved
        ? Text(
          "Couldn't save this lesson. Try again.", tableName: "SavedLessons")
        : Text(
          "Couldn't remove this lesson. Try again.", tableName: "SavedLessons",
          comment: "Taking the lesson out of the saved lessons didn't work, so it's still saved.")
    }
  }
}
