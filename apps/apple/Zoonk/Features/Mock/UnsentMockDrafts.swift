import Foundation

/// A mock's answers not stored on the server yet, kept on the device so closing the mock or the app
/// offline never loses them. Each write reads storage again, so two windows on the same mock keep
/// each other's answers.
struct UnsentMockDrafts {
  private let key: String
  private let defaults: UserDefaults

  init(blockId: String, defaults: UserDefaults = .standard) {
    key = "mock.unsent.\(blockId)"
    self.defaults = defaults
  }

  func read() -> [MockDraft] {
    defaults.data(forKey: key).flatMap { try? JSONDecoder().decode([MockDraft].self, from: $0) }
      ?? []
  }

  func keep(_ draft: MockDraft) {
    var current = read()

    if let index = current.firstIndex(where: { $0.itemId == draft.itemId }) {
      current[index] = draft
    } else {
      current.append(draft)
    }

    write(current)
  }

  /// Only while storage still holds this exact version, so a newer edit stays.
  func drop(_ draft: MockDraft) {
    let current = read()
    let next = current.filter { $0 != draft }

    if next.count != current.count {
      write(next)
    }
  }

  /// The section's kept answers the server doesn't hold yet, in the order they were kept. Copies it
  /// already holds go; other sections' answers stay for the window still on them.
  func restore(for itemIds: Set<String>, matching stored: [String: MockDraft]) -> [MockDraft] {
    let current = read()
    let remaining = current.filter { !itemIds.contains($0.itemId) || stored[$0.itemId] != $0 }

    if remaining.count != current.count {
      write(remaining)
    }

    return remaining.filter { itemIds.contains($0.itemId) }
  }

  func clear() {
    defaults.removeObject(forKey: key)
  }

  private func write(_ drafts: [MockDraft]) {
    if drafts.isEmpty {
      defaults.removeObject(forKey: key)
    } else if let data = try? JSONEncoder().encode(drafts) {
      defaults.set(data, forKey: key)
    }
  }
}
