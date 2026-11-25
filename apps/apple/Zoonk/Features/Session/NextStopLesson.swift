import Foundation

/// A readiness answer for one lesson, newer than the day's snapshot of it.
struct LessonRead: Equatable {
  let lessonID: String
  let status: LessonStatus
  let setAside: Bool
}

/// How the next stop's lesson stands, from its first frame: the day's snapshot until readiness
/// answers. What the learner's tap was told is newer than a snapshot that says the lesson isn't
/// written, and a failed tap stays failed until a read says a run writes it. Nil `status` for a
/// block with no lesson to read, or one a server that doesn't send its snapshot hasn't answered for.
struct NextStopLesson: Equatable {
  let status: LessonStatus?
  let isSetAside: Bool
  let isRefused: Bool
  /// A learn block with a lesson to read.
  let hasLesson: Bool

  init(block: StudyBlock?, read: LessonRead?, writing: LessonWriting?) {
    guard let block, block.kind == .learn else {
      status = nil
      isSetAside = false
      isRefused = false
      hasLesson = false
      return
    }

    let read = read?.lessonID == block.lessonId ? read : nil
    let known = read?.status ?? block.lesson?.status

    status =
      if known == .ready || known == .generating {
        known
      } else if writing == .failed {
        .failed
      } else if read == nil, writing?.isRunning == true {
        .generating
      } else {
        known
      }

    isSetAside = writing == .setAside || (read?.setAside ?? block.lesson?.setAside) == true

    if case .refused = writing { isRefused = true } else { isRefused = false }

    hasLesson = block.lessonId != nil
  }

  var isWriting: Bool { status == .generating }

  /// Never written again (set aside), or not now (refused).
  var isUnavailable: Bool { isSetAside || isRefused }

  /// Its failure notice asks for it again.
  var isFailed: Bool { status == .failed && !isUnavailable }

  /// A lesson nobody asked for yet keeps Start, whose tap asks for it; one still unread offers
  /// nothing until readiness answers.
  var canStart: Bool {
    guard hasLesson else {
      return true
    }

    return (status == .ready || status == .notStarted) && !isUnavailable
  }
}
