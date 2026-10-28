import Foundation

/// The exam screen for an exam goal (`GET /goals/{goalId}/exam`), re-read into the fields it draws.
struct ExamView: Hashable, Decodable, Sendable {
  enum Stage: String, Decodable, Sendable {
    case preparing
    case finalStretch
    case dayBefore
    case examDay
    case afterExam
  }

  enum ChecklistItem: String, Decodable, Sendable {
    case documents
    case blackPen
    case route
    case examTime
    case sleep
    case materials
  }

  enum DayBefore: String, Decodable, Sendable {
    case learn
    case learnAndMock
    case light
    case mock
    case review
  }

  struct Day: Hashable, Decodable, Sendable {
    var date: String
    var label: String?
    var startTime: String?
  }

  struct FormatDay: Hashable, Decodable, Sendable {
    struct Part: Hashable, Decodable, Sendable {
      var name: String
      var questions: Int?
      var written: Bool
    }

    var date: String?
    var day: Int
    var minutes: Int?
    var parts: [Part]
  }

  struct Map: Hashable, Decodable, Sendable {
    struct Subject: Hashable, Decodable, Sendable, Identifiable {
      struct Topic: Hashable, Decodable, Sendable {
        var appearances: Int?
        var name: String
      }

      var name: String
      var questions: Int?
      var share: Double?
      var topics: [Topic]

      var id: String { name }
    }

    var hasFrequency: Bool
    var subjects: [Subject]
  }

  struct NextMock: Hashable, Decodable, Sendable {
    var date: String?
    var fullLength: Bool
    var planItemId: String
    var questions: Int
  }

  struct NoticeDay: Hashable, Decodable, Sendable {
    var date: String
    var estimated: Bool
  }

  /// An exam held several times a year with no sitting in the learner's month: the closest ones.
  struct NoSitting: Hashable, Decodable, Sendable {
    var closest: [String]
    var month: String
  }

  /// IELTS and TOEFL iBT: the exam whose speaking test runs as a live call.
  enum SpeakingMock: String, Decodable, Sendable {
    case ielts
    case toefl
  }

  struct Progress: Hashable, Decodable, Sendable {
    struct Point: Hashable, Decodable, Sendable, Identifiable {
      var finishedAt: Date
      var number: Int
      var percent: Int
      var shape: MockShape?

      var id: Int { number }
    }

    struct Subject: Hashable, Decodable, Sendable, Identifiable {
      var change: Int?
      var name: String
      var percents: [Int]

      var id: String { name }
    }

    var improved: [String]
    var mocks: [Point]
    var needsWork: [String]
    var subjects: [Subject]
  }

  struct Result: Hashable, Decodable, Sendable {
    var maxScore: Double?
    var passed: Bool?
    var scale: String
    var score: Double?
  }

  struct RunningMock: Hashable, Decodable, Sendable, Identifiable {
    var answered: Int
    var deadline: Date?
    var id: String
    var number: Int
    var purpose: MockPurpose
    var questions: Int
    var shape: MockShape?
  }

  struct Scoring: Hashable, Decodable, Sendable {
    struct NoticeScale: Hashable, Decodable, Sendable {
      var max: Double
      var min: Double
      var name: String?
      var passScore: Double?
    }

    enum Scale: String, Decodable, Sendable {
      case ap
      case sat
      case toefl
    }

    var method: MockView.Scoring
    var note: String?
    var noticeScale: NoticeScale?
    var rule: MockView.Scoring?
    var scale: Scale?
    var stated: Bool
    var wrongPenalty: Double
  }

  var calibration: NetCalibration?
  var checklist: [ChecklistItem]
  var dayBefore: DayBefore
  var days: [Day]
  var daysEstimated: Bool
  var daysLeft: Int?
  var examDocument: ExamDocument
  var examName: String
  var format: [FormatDay]
  var goalId: String
  var map: Map?
  var mocks: [ExamMockSummary]
  var mocksRequirePlus: Bool
  var namedMonth: Bool
  var nextMock: NextMock?
  var noSitting: NoSitting?
  var noticeDay: NoticeDay?
  var passMarks: PassMarks?
  var prepared: Bool
  var progress: Progress?
  var result: Result?
  var runningMocks: [RunningMock]
  var scoring: Scoring
  var sessionsDone: Int
  var speakingMock: SpeakingMock?
  var speakingMockPaused: Bool
  var stage: Stage
  var tools: [String]

  /// Whether "How did it go?" is open: from the first exam day on.
  var takesResult: Bool { stage == .examDay || stage == .afterExam }
}
