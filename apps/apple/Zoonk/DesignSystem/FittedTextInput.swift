import SwiftUI

nonisolated struct TextEdit {
  let before: Substring
  let removed: Substring
  let inserted: Substring
  let after: Substring

  init(from old: String, to new: String, insertionEnd: String.Index? = nil) {
    // Use the caret to disambiguate identical text on both sides of the edit.
    var oldEnd = old.endIndex
    var newEnd = new.endIndex

    if let insertionEnd, insertionEnd <= new.endIndex {
      let tail = new[insertionEnd...]
      let start = old.index(oldEnd, offsetBy: -tail.count, limitedBy: old.startIndex)
      if let start, old[start...] == tail {
        oldEnd = start
        newEnd = tail.startIndex
      }
    }

    var oldStart = old.startIndex
    var newStart = new.startIndex

    while oldStart < oldEnd, newStart < newEnd, old[oldStart] == new[newStart] {
      old.formIndex(after: &oldStart)
      new.formIndex(after: &newStart)
    }

    while oldEnd > oldStart, newEnd > newStart {
      let oldPrevious = old.index(before: oldEnd)
      let newPrevious = new.index(before: newEnd)
      guard old[oldPrevious] == new[newPrevious] else { break }
      oldEnd = oldPrevious
      newEnd = newPrevious
    }

    before = old[..<oldStart]
    removed = old[oldStart..<oldEnd]
    inserted = new[newStart..<newEnd]
    after = old[oldEnd...]
  }

  func fitted(to limit: Int, digitsOnly: Bool = false) -> (text: String, caret: Int) {
    let proposed = inserted.base
    var room = limit - before.utf16.count - after.utf16.count
    var kept = ""
    var start = inserted.startIndex

    while start < inserted.endIndex {
      let end = proposed.index(after: start)
      let piece = proposed[start..<end]
      start = end

      if digitsOnly, piece.first.map(Self.isDigit) != true { continue }

      let length = piece.utf16.count
      guard length <= room, piece.unicodeScalars.last != "\u{200D}" else { break }

      kept.append(contentsOf: piece)
      room -= length
    }

    if kept.isEmpty, !inserted.isEmpty {
      return (String(before) + removed + after, before.utf16.count + removed.utf16.count)
    }

    return (String(before) + kept + after, before.utf16.count + kept.utf16.count)
  }

  static func isDigit(_ character: Character) -> Bool {
    character.asciiValue.map { (48...57).contains($0) } ?? false
  }
}

struct FittedTextInput<Content: View>: View {
  @Binding var text: String
  let limit: Int
  var digitsOnly = false
  @ViewBuilder let content: (Binding<String>, Binding<TextSelection?>) -> Content

  @State private var selection: TextSelection?
  @State private var pending: String?

  var body: some View {
    content(typed, $selection)
      .onChange(of: pending) {
        if let pending {
          correct(pending)
        }
      }
  }

  private var typed: Binding<String> {
    Binding {
      pending ?? text
    } set: { next in
      if next.utf16.count <= limit, !digitsOnly || next.allSatisfy(TextEdit.isDigit) {
        pending = nil
        text = next
      } else {
        // SwiftUI must see the proposed value before a correction can redraw a refused edit.
        pending = next
      }
    }
  }

  private func correct(_ proposed: String) {
    let insertionEnd: String.Index?
    if case .selection(let range) = selection?.indices, range.isEmpty,
      range.upperBound <= proposed.endIndex
    {
      insertionEnd = range.upperBound
    } else {
      insertionEnd = nil
    }

    let edit = TextEdit(from: text, to: proposed, insertionEnd: insertionEnd)
    let fitted = edit.fitted(to: limit, digitsOnly: digitsOnly)
    if text != fitted.text {
      text = fitted.text
    }

    pending = nil
    selection = TextSelection(
      insertionPoint: String.Index(utf16Offset: fitted.caret, in: fitted.text))
  }
}

extension View {
  func fitsAlertText(_ text: Binding<String>, limit: Int) -> some View {
    onChange(of: text.wrappedValue) { old, proposed in
      if proposed.utf16.count > limit {
        text.wrappedValue = TextEdit(from: old, to: proposed).fitted(to: limit).text
      }
    }
  }
}
