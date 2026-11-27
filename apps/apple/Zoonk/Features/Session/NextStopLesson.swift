import Foundation

struct LessonRead: Equatable {
  let lessonID: String
  let status: LessonStatus
  let setAside: Bool
}

/// What the learner's tap was told is newer than a snapshot that says the lesson isn't written,
/// and a failed tap stays failed until readiness says a run writes it.
struct NextStopLesson: Equatable {
  let status: LessonStatus?
  let isSetAside: Bool
  let isRefused: Bool
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

  var isUnavailable: Bool { isSetAside || isRefused }

  var isFailed: Bool { status == .failed && !isUnavailable }

  /// A lesson still unread offers nothing until readiness answers.
  var canStart: Bool {
    guard hasLesson else {
      return true
    }

    return (status == .ready || status == .notStarted) && !isUnavailable
  }
}
