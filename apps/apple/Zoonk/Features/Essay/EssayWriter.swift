import Foundation
import Observation

@MainActor
@Observable
final class EssayWriter {
  enum Status: Equatable {
    case idle
    case grading
    case failed
    case limitReached
    case dailyLimitReached
  }

  private static let slowAfter = Duration.seconds(20)
  private static let timeout = Duration.seconds(90)

  let essay: Resource<EssayView>
  var writing: Bool?
  private(set) var status = Status.idle
  private(set) var slow = false
  private var typed: String?
  private var startedAt: Date?
  private var editedSinceSentAt: Date?
  private var ungraded: (attemptId: String, text: String)?

  @ObservationIgnored private let store: ExamStore
  @ObservationIgnored private let blockId: String

  init(store: ExamStore, blockId: String) {
    self.store = store
    self.blockId = blockId
    essay = store.essay(blockId: blockId)
  }

  var isWriting: Bool { writing ?? (essay.value?.drafts.isEmpty ?? true) }
  private var graded: String { essay.value?.drafts.first?.text ?? "" }

  var text: String {
    get {
      if let typed { return typed }
      if let kept = UnsentEssay.read(blockId),
        !kept.trimmingCharacters(in: .whitespaces).isEmpty,
        kept != graded
      {
        return kept
      }
      return graded
    }
    set {
      startedAt = startedAt ?? .now
      editedSinceSentAt = editedSinceSentAt ?? .now
      typed = newValue
      UnsentEssay.keep(newValue, blockId: blockId)
    }
  }

  var unsent: Bool {
    !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text != graded
  }

  /// Reuses the id when the text didn't change since a send that failed, so the server grades it
  /// once. Text changed while it was graded stays open as the rewrite.
  func send() async {
    let text = text
    let attemptId = ungraded?.text == text ? ungraded!.attemptId : UUID().uuidString.lowercased()
    let durationMs = startedAt.map { Int(Date.now.timeIntervalSince($0) * 1000) } ?? 0
    let blockId = blockId
    ungraded = (attemptId, text)
    editedSinceSentAt = nil
    status = .grading
    slow = false

    let slowTask = Task {
      try? await Task.sleep(for: Self.slowAfter)
      if !Task.isCancelled { slow = true }
    }

    let result: MutationResult<EssaySubmission>? = await within(Self.timeout) { [store] in
      await store.write(invalidating: [.learnerModel, .userProgress]) { api, token in
        try await api.submitEssay(
          token: token, blockId: blockId, attemptId: attemptId, text: text, durationMs: durationMs)
      }
    }

    slowTask.cancel()

    switch result {
    case .done(.graded(let grade)):
      let isChangedSince = self.text != text
      status = .idle
      ungraded = nil
      writing = isChangedSince
      startedAt = isChangedSince ? editedSinceSentAt : nil

      if !isChangedSince {
        typed = nil
        UnsentEssay.clear(blockId)
      }

      essay.update { essay in
        var essay = essay
        essay.drafts.insert(.init(grade: grade, submittedAt: .now, text: text), at: 0)
        essay.gradesLeft = max(0, essay.gradesLeft - 1)
        return essay
      }
    case .done(.limitReached):
      status = .limitReached
    case .done(.dailyLimitReached):
      status = .dailyLimitReached
    case .obsolete:
      status = .idle
    case .failed, nil:
      status = .failed
    }
  }
}

enum UnsentEssay {
  private static func key(_ blockId: String) -> String { "essay.unsent.\(blockId)" }

  static func read(_ blockId: String) -> String? {
    UserDefaults.standard.string(forKey: key(blockId))
  }

  static func keep(_ text: String, blockId: String) {
    UserDefaults.standard.set(text, forKey: key(blockId))
  }

  static func clear(_ blockId: String) {
    UserDefaults.standard.removeObject(forKey: key(blockId))
  }
}
