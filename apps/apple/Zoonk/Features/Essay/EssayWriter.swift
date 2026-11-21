import Foundation
import Observation

/// One written task while its screen is open: the question, the answer being written, its grades.
/// The text stays on this device as it's typed and goes to the block's saved draft a moment later,
/// so "Continue" works on another device. A save that finds a newer draft keeps what was typed here
/// and saves it over that one (main's `useWritingDraft`).
@MainActor
@Observable
final class EssayWriter {
  enum Mode: Equatable {
    case question
    case write
    case result
    /// A rewrite past the day's extra grades: the task waits for tomorrow.
    case refused
  }

  enum Status: Equatable {
    case idle
    case grading
    case failed
  }

  private static let saveAfter = Duration.seconds(1.5)
  private static let slowAfter = Duration.seconds(20)
  private static let timeout = Duration.seconds(120)

  let essay: Resource<EssayView>
  var mode: Mode
  private(set) var status = Status.idle
  private(set) var failures = 0
  private(set) var slow = false
  private(set) var isRewriting = false
  /// Graded answers, latest first: the read's, then each one sent this visit.
  private(set) var answers: [WritingAnswer]
  private var typed: String?
  private var typingSince: Date?

  @ObservationIgnored private var admissionId: String?
  @ObservationIgnored private var revision: Int
  @ObservationIgnored private var savedText: String
  @ObservationIgnored private var saveTask: Task<Void, Never>?
  @ObservationIgnored private var saving: Task<Void, Never>?
  @ObservationIgnored private let store: ExamStore
  @ObservationIgnored private let blockId: String

  init(store: ExamStore, view: EssayView, admissionId: String?) {
    self.store = store
    blockId = view.blockId
    essay = store.essay(blockId: view.blockId)
    answers = view.drafts
    self.admissionId = view.draft?.admissionId ?? admissionId
    revision = view.draft?.revision ?? 0
    savedText = view.draft?.text ?? ""
    let hasDraft =
      !(view.draft?.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    mode = hasDraft || view.drafts.isEmpty ? .question : .result
  }

  var latest: WritingAnswer? { answers.first }

  /// This device's text wins only when it was typed over the draft the server still has: a newer
  /// draft saved on another device is the one to continue.
  var text: String {
    if let typed { return typed }
    return KeptWriting.choose(kept: KeptWriting.read(blockId), saved: essay.value?.draft)
  }

  var hasDraft: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

  var canSend: Bool { hasDraft && status != .grading }

  func write(_ next: String) {
    typingSince = typingSince ?? .now
    typed = next
    KeptWriting.keep(.init(base: revision, text: next), blockId: blockId)
    saveTask?.cancel()
    saveTask = Task { [weak self] in
      try? await Task.sleep(for: Self.saveAfter)
      guard !Task.isCancelled else { return }
      await self?.flush()
    }
  }

  /// Saves what's typed now, after any save still out.
  func flush() async {
    saveTask?.cancel()
    let current = text
    let previous = saving
    let next = Task { [weak self] in
      await previous?.value
      await self?.save(current)
    }
    saving = next
    await next.value
  }

  private func save(_ current: String, retried: Bool = false) async {
    guard current != savedText, let admissionId = await admission() else { return }

    let draft = WritingDraft(admissionId: admissionId, revision: revision, text: current)

    switch await store.saveWritingDraft(blockId: blockId, draft: draft) {
    case .done(.saved(let saved)):
      revision = saved.revision
      savedText = current
      // What's typed while this save was out is newer than what it sent: keep that.
      KeptWriting.keep(.init(base: saved.revision, text: text), blockId: blockId)
    // Another device saved first: what was typed here goes over it, once.
    case .done(.conflict(let newer)) where !retried:
      revision = newer.revision
      await save(current, retried: true)
    case .done, .failed, .obsolete:
      break
    }
  }

  /// The admission its start issued; a block opened without one replays its start.
  private func admission() async -> String? {
    if let admissionId { return admissionId }

    guard case .done(.ready(let id)) = await store.startWriting(blockId: blockId) else {
      return nil
    }

    admissionId = id
    return id
  }

  /// Sending the same admission again replays its grade, so a send that failed can go again.
  func send() async {
    let text = text
    let durationMs = typingSince.map { Int(Date.now.timeIntervalSince($0) * 1000) } ?? 0
    status = .grading
    slow = false

    let slowTask = Task {
      try? await Task.sleep(for: Self.slowAfter)
      if !Task.isCancelled { slow = true }
    }
    defer { slowTask.cancel() }

    guard let admissionId = await admission() else {
      fail()
      return
    }

    await flush()

    let blockId = blockId
    let result: MutationResult<EssaySubmission>? = await within(Self.timeout) { [store] in
      await store.write(invalidating: [.learnerModel, .userProgress, .userSession]) { api, token in
        try await api.submitEssay(
          token: token, blockId: blockId, admissionId: admissionId, text: text,
          durationMs: durationMs)
      }
    }

    switch result {
    case .done(.graded(let grade)):
      status = .idle
      failures = 0
      typed = nil
      typingSince = nil
      KeptWriting.clear(blockId)
      answers.insert(.init(attemptId: "", grade: grade, submittedAt: .now, text: text), at: 0)
      mode = .result
      // The grade shows at once; the block read again names the saved answer a rewrite starts from.
      await readAnswers()
    case .done(.blockNotActive):
      fail()
      // The block was finished or skipped elsewhere; a fresh read shows it closed.
      essay.invalidate()
      await essay.refresh()
    case .obsolete:
      status = .idle
    case .failed, nil:
      fail()
    }
  }

  private func fail() {
    failures += 1
    status = .failed
  }

  /// A tap on "Rewrite" is a start, admitted here; past the day's extra grades it's refused before
  /// a word is written.
  private func readAnswers() async {
    essay.invalidate()
    await essay.refresh()

    if let drafts = essay.value?.drafts, !drafts.isEmpty {
      answers = drafts
    }
  }

  func rewrite() async {
    guard !isRewriting else { return }

    isRewriting = true
    defer { isRewriting = false }

    if latest?.attemptId.isEmpty == true {
      await readAnswers()
    }

    guard let latest, !latest.attemptId.isEmpty else {
      failures += 1
      return
    }

    switch await store.startWriting(blockId: blockId, previousAttemptId: latest.attemptId) {
    case .done(.ready(let id)):
      admissionId = id
      revision = 0
      savedText = ""
      typingSince = nil
      write(latest.text)
      mode = .write
    case .done(.limitReached):
      mode = .refused
    case .done, .failed, .obsolete:
      failures += 1
    }
  }
}

/// What this device typed, with the saved draft's revision it was typed over.
enum KeptWriting {
  struct Kept: Codable, Equatable {
    var base: Int
    var text: String
  }

  private static func key(_ blockId: String) -> String { "writing.\(blockId)" }

  static func read(_ blockId: String) -> Kept? {
    UserDefaults.standard.data(forKey: key(blockId)).flatMap {
      try? JSONDecoder().decode(Kept.self, from: $0)
    }
  }

  static func keep(_ kept: Kept, blockId: String) {
    UserDefaults.standard.set(try? JSONEncoder().encode(kept), forKey: key(blockId))
  }

  static func clear(_ blockId: String) {
    UserDefaults.standard.removeObject(forKey: key(blockId))
  }

  /// This device's text wins only when it was typed over the draft the server still has.
  static func choose(kept: Kept?, saved: WritingDraft?) -> String {
    let revision = saved?.revision ?? 0

    if let kept, !kept.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
      kept.base >= revision
    {
      return kept.text
    }

    return saved?.text ?? ""
  }
}
