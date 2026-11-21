import Foundation
import Observation

/// One written task while its screen is open: the question, the answer being written, its grades.
/// The text stays on this device as it's typed and goes to the block's saved draft a moment later,
/// so "Continue" works on another device. Nothing the learner wrote is ever overwritten without
/// their say: a draft saved on another device meanwhile stops the saving until they pick one.
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

  /// The longest answer the server saves or grades, in UTF-16 code units (core's
  /// `MAX_ESSAY_CHARACTERS`).
  nonisolated static let maxLength = 48_000
  /// The longest writing time the server takes (core's `MAX_WRITING_MS`).
  static let maxWritingTime = Duration.seconds(24 * 60 * 60)

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
  private(set) var text: String
  /// A draft saved on another device over the one `text` was typed on: nothing saves until the
  /// learner keeps theirs or takes this one.
  private(set) var conflict: WritingDraft?
  /// The last save didn't get through; the text is kept on this device and goes again.
  private(set) var saveFailed = false
  /// What was typed after this answer went for grading the first time: a lost answer's grade comes
  /// back for that first text, so these edits wait for the rewrite.
  private(set) var editsAfterGrading: String?

  @ObservationIgnored private var admissionId: String?
  @ObservationIgnored private var revision: Int
  @ObservationIgnored private var savedText: String
  /// A save sent over `revision` without an answer yet: it may have landed.
  @ObservationIgnored private var sending: String?
  /// Text sent for grading under this admission whose answer was lost: it may have been graded.
  @ObservationIgnored private var sentForGrading: String?
  @ObservationIgnored private var saveRetries = 0
  @ObservationIgnored private var writingTime = Duration.zero
  @ObservationIgnored private var writingSince: ContinuousClock.Instant?
  @ObservationIgnored private var saveTask: Task<Void, Never>?
  @ObservationIgnored private var saving: Task<Bool, Never>?
  @ObservationIgnored private let store: ExamStore
  @ObservationIgnored private let blockId: String

  init(store: ExamStore, view: EssayView, admissionId: String?) {
    self.store = store
    blockId = view.blockId
    essay = store.essay(blockId: view.blockId)
    answers = view.drafts
    let admissionId = view.draft?.admissionId ?? admissionId
    self.admissionId = admissionId
    revision = view.draft?.revision ?? 0
    savedText = view.draft?.text ?? ""
    var text = view.draft?.text ?? ""

    switch KeptWriting.recover(
      KeptWriting.read(view.blockId), saved: view.draft, admissionId: admissionId,
      graded: view.drafts.first?.text)
    {
    case .saved:
      break
    case .kept(let kept):
      text = kept
    case .conflict(let kept):
      text = kept
      conflict = view.draft
    case .afterGrading(let kept):
      editsAfterGrading = kept
    }

    self.text = text
    let hasDraft = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    mode = hasDraft || view.drafts.isEmpty ? .question : .result
  }

  var latest: WritingAnswer? { answers.first }

  var hasDraft: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

  var canSend: Bool { hasDraft && status != .grading && conflict == nil }

  /// What this device typed and the server doesn't have yet goes as soon as the screen opens,
  /// without another keystroke.
  func resumeSaving() {
    if mode != .result, text != savedText { scheduleSave(after: .zero) }
  }

  func write(_ next: String) {
    // What's being graded is what was sent: nothing typed meanwhile would be read.
    guard status != .grading else { return }

    // The field stops at the longest answer the server saves.
    text = Self.fitted(next)
    keep()
    scheduleSave(after: Self.saveAfter)
  }

  /// The longest start of `text` the server takes, cut between characters.
  nonisolated static func fitted(_ text: String) -> String {
    guard text.utf16.count > maxLength else { return text }

    var length = 0
    var end = text.startIndex

    for index in text.indices {
      length += text[index].utf16.count
      if length > maxLength { break }
      end = text.index(after: index)
    }

    return String(text[..<end])
  }

  /// Writing time is the time the editor is in use: a day away, the app in the background or a
  /// changed clock adds nothing to it.
  func startTiming() {
    writingSince = writingSince ?? .now
  }

  func stopTiming() {
    guard let writingSince else { return }
    writingTime += writingSince.duration(to: .now)
    self.writingSince = nil
  }

  private var writingMs: Int {
    let time = min(
      writingTime + (writingSince.map { $0.duration(to: .now) } ?? .zero), Self.maxWritingTime)
    return Int(time / .milliseconds(1))
  }

  /// Saves what's typed now, after any save still out. False when the server doesn't have it yet.
  @discardableResult
  func flush() async -> Bool {
    saveTask?.cancel()
    let previous = saving
    let next = Task { [weak self] () -> Bool in
      _ = await previous?.value
      return await self?.save() ?? false
    }
    saving = next
    return await next.value
  }

  /// "Keep this one": what's typed here goes over the other device's draft.
  func keepThisOne() async {
    guard let other = conflict else { return }
    acknowledge(other)
    conflict = nil
    keep()
    await flush()
  }

  /// "Use the other": the other device's draft replaces what's typed here.
  func useTheOther() {
    guard let other = conflict else { return }
    conflict = nil
    text = other.text
    acknowledge(other)
  }

  private func scheduleSave(after delay: Duration) {
    saveTask?.cancel()
    saveTask = Task { [weak self] in
      try? await Task.sleep(for: delay)
      guard !Task.isCancelled else { return }
      await self?.flush()
    }
  }

  private func save() async -> Bool {
    guard conflict == nil else { return false }

    let current = text
    guard current != savedText else {
      saveFailed = false
      return true
    }

    guard let admissionId = await admission() else {
      failSave()
      return false
    }

    let earlier = sending
    sending = current
    keep()

    let draft = WritingDraft(admissionId: admissionId, revision: revision, text: current)

    switch await store.saveWritingDraft(blockId: blockId, draft: draft) {
    case .done(.saved(let saved)):
      acknowledge(saved)
      return true
    // This device's own earlier save landed though its answer was lost: build on it.
    case .done(.conflict(let newer))
    where newer.revision == revision + 1 && [earlier, current].contains(newer.text):
      acknowledge(newer)
      return await save()
    case .done(.conflict(let newer)):
      sending = nil
      conflict = newer
      keep()
      return false
    case .done(.closed):
      // The answer was sent already, from another device or by a grading whose answer was lost.
      essay.invalidate()
      await essay.refresh()
      return false
    case .failed:
      failSave()
      return false
    case .obsolete:
      return false
    }
  }

  /// The server holds `saved`: what's typed since stays on this device and goes next.
  private func acknowledge(_ saved: WritingDraft) {
    revision = saved.revision
    savedText = saved.text
    sending = nil
    saveFailed = false
    saveRetries = 0

    if text == saved.text {
      KeptWriting.clear(blockId)
    } else {
      keep()
    }
  }

  /// Offline, the text goes again a little later, without another keystroke.
  private func failSave() {
    saveFailed = true
    saveRetries += 1
    scheduleSave(after: .seconds(min(1 << min(saveRetries, 4), 15)))
  }

  private func keep() {
    KeptWriting.keep(
      .init(admissionId: admissionId, base: revision, text: text, sending: sending),
      blockId: blockId)
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
    guard status != .grading, conflict == nil else { return }

    let text = text
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

    // Another device's draft turned up: the learner picks before anything is graded.
    guard conflict == nil else {
      status = .idle
      return
    }

    let blockId = blockId
    let durationMs = writingMs
    let earlier = sentForGrading
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
      sentForGrading = nil
      writingTime = .zero
      writingSince = nil
      answers.insert(.init(attemptId: "", grade: grade, submittedAt: .now, text: text), at: 0)
      mode = .result
      // The grade shows at once; the block read again names the saved answer a rewrite starts from.
      let read = await readAnswers()

      // A grade whose answer was lost comes back for the text sent then: what's typed since waits
      // for the rewrite, never dropped.
      if let earlier, earlier != text, !read || latest?.text != text {
        editsAfterGrading = text
        KeptWriting.keep(
          .init(admissionId: admissionId, base: revision, text: text, afterGrading: true),
          blockId: blockId)
      } else {
        KeptWriting.clear(blockId)
      }
    case .done(.blockNotActive):
      fail()
      // The block was finished or skipped elsewhere; a fresh read shows it closed.
      essay.invalidate()
      await essay.refresh()
    case .obsolete:
      status = .idle
    case .failed, nil:
      // It may have been graded with its answer lost on the way: sending again replays that grade.
      sentForGrading = sentForGrading ?? text
      fail()
    }
  }

  private func fail() {
    failures += 1
    status = .failed
  }

  /// True when the server's answers came back.
  @discardableResult
  private func readAnswers() async -> Bool {
    essay.invalidate()
    await essay.refresh()

    guard let drafts = essay.value?.drafts, !drafts.isEmpty else { return false }
    answers = drafts
    return true
  }

  /// A tap on "Rewrite" is a start, admitted here; past the day's extra grades it's refused before
  /// a word is written. It starts from what was typed after grading, when there is any.
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
      sending = nil
      sentForGrading = nil
      conflict = nil
      writingTime = .zero
      writingSince = nil
      let start = editsAfterGrading ?? latest.text
      editsAfterGrading = nil
      write(start)
      mode = .write
    case .done(.limitReached):
      mode = .refused
    case .done, .failed, .obsolete:
      failures += 1
    }
  }
}

/// What this device typed and the server may not have, with the admission it was typed under and
/// the saved draft's revision it was typed over. A record is an edit: an empty text is a cleared
/// answer, and no record is no edit.
enum KeptWriting {
  struct Kept: Codable, Equatable {
    var admissionId: String?
    var base: Int
    var text: String
    /// A save sent over `base` without an answer: it may have landed.
    var sending: String?
    /// Typed after the admission's answer was graded: for the rewrite, never its draft.
    var afterGrading: Bool?
  }

  enum Recovery: Equatable {
    /// No edit of this device's to keep: the saved draft.
    case saved
    /// This device's edit, typed over the draft the server has (or over its own save that landed).
    case kept(String)
    /// This device's edit and a different draft saved elsewhere since: the learner picks.
    case conflict(String)
    /// Edits typed after the answer was graded: the rewrite starts from them.
    case afterGrading(String)
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

  /// An edit belongs to the admission it was typed under: one from another (a rewrite since, or
  /// another device's start) is never offered. Within it, the edit wins over the revision it was
  /// typed on; a newer one saved elsewhere is the learner's call. `graded` is the latest graded
  /// answer's text, for a block with no draft left.
  static func recover(_ kept: Kept?, saved: WritingDraft?, admissionId: String?, graded: String?)
    -> Recovery
  {
    guard let kept else { return .saved }

    // The answer was graded since: what differs from it waits for the rewrite.
    if saved == nil, let graded {
      return kept.text != graded && (kept.admissionId == admissionId || admissionId == nil)
        ? .afterGrading(kept.text) : .saved
    }

    guard kept.afterGrading != true, kept.admissionId == admissionId || admissionId == nil else {
      return .saved
    }

    guard let saved, saved.revision > kept.base else { return .kept(kept.text) }

    if saved.text == kept.text { return .saved }

    // Its own save landed and the answer was lost: what's typed since builds on it.
    if saved.revision == kept.base + 1, saved.text == kept.sending { return .kept(kept.text) }

    return .conflict(kept.text)
  }
}
