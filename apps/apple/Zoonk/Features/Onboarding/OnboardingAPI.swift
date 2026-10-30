import Foundation
import OpenAPIRuntime

typealias OnboardingDraft = Components.Schemas.OnboardingDraft
typealias GoalOnboarding = Components.Schemas.Onboarding
typealias OnboardingAnswer = Components.Schemas.OnboardingAnswerInput
typealias GoalPlacement = Components.Schemas.Placement

/// Only product refusals; transport and session failures are `APIError`s.
enum OnboardingError: Error, Equatable, Sendable {
  /// Reading words hit a cap: small AI calls, or a guest's one goal (`USAGE_LIMIT_REACHED`).
  case limit(OnboardingLimit)
  /// Creating a goal hit the plan's goal limit (`GOAL_LIMIT_REACHED`).
  case goalLimit(OnboardingLimit)
  /// A guest once the day's AI budget all guests share is spent (`SIGN_UP_REQUIRED`).
  case signUpRequired
  /// Too many new goals at once (`SLOW_DOWN`).
  case slowDown
  case unsupported
  case failed(APIError)
}

struct AttachedSource: Decodable, Equatable, Identifiable, Sendable {
  let id: String
  let title: String?
}

struct MaterialInput: Encodable, Sendable {
  let kind: String
  var goalId: String?
  var language = OnboardingAPI.language
  var text: String?
  var url: String?
  var pathname: String?

  static func text(_ text: String, goal: (id: String, language: String)? = nil) -> MaterialInput {
    MaterialInput(kind: "text", text: text).attached(to: goal)
  }

  static func link(_ url: String, goal: (id: String, language: String)? = nil) -> MaterialInput {
    MaterialInput(kind: "link", url: url).attached(to: goal)
  }

  static func file(_ pathname: String, goal: (id: String, language: String)? = nil)
    -> MaterialInput
  {
    MaterialInput(kind: "file", pathname: pathname).attached(to: goal)
  }

  private func attached(to goal: (id: String, language: String)?) -> MaterialInput {
    guard let goal else {
      return self
    }

    var input = self
    input.goalId = goal.id
    input.language = goal.language
    return input
  }
}

/// A goal the learner typed but hasn't confirmed, kept to continue after leaving.
struct OnboardingResume: Equatable, Sendable {
  struct Draft: Decodable, Equatable, Sendable {
    let draftId: String
    let prompt: String
  }

  let draft: Draft?
}

private struct ResumeBody: Decodable {
  struct Resume: Decodable {
    let kind: String
    let draftId: String?
    let prompt: String?
  }

  let resume: Resume?
}

struct MaterialAnswer: Decodable, Equatable, Sendable {
  struct Citation: Decodable, Equatable, Hashable, Sendable {
    let page: Int?
    let title: String
    /// `slide` for a deck's slide; a page or a section otherwise.
    let unit: String
  }

  let answer: String
  let citations: [Citation]
}

private struct BlobPresignRequest: Encodable {
  struct Payload: Encodable {
    let pathname: String
    let clientPayload: String? = nil
    let multipart = false

    private enum CodingKeys: String, CodingKey {
      case pathname, clientPayload, multipart
    }

    func encode(to encoder: any Encoder) throws {
      var container = encoder.container(keyedBy: CodingKeys.self)
      try container.encode(pathname, forKey: .pathname)
      try container.encodeNil(forKey: .clientPayload)
      try container.encode(multipart, forKey: .multipart)
    }
  }

  let type = "blob.generate-presigned-url"
  let payload: Payload
}

/// Study days Sunday first.
struct ScheduleWeek: Hashable, Sendable {
  var studyDays: [Int]
  var weekendMinutes: Int?
  var fullCourse = false
}

private struct ScheduleWeekInput: Encodable {
  let studyDays: [Int]
  let weekendMinutes: Int?
  let dailyMinutes: Int?
  let fullCourse: Bool?

  init(week: ScheduleWeek, dailyMinutes: Int?) {
    studyDays = week.studyDays
    weekendMinutes = week.weekendMinutes
    self.dailyMinutes = dailyMinutes
    fullCourse = week.fullCourse ? true : nil
  }
}

/// An answer about the plan, which isn't `ready` while the plan is still being built.
protocol PlanAnswer: Equatable, Sendable {
  var ready: Bool { get }
}

struct TimeAdvice: PlanAnswer, Decodable {
  /// Nil for a plan with nothing to cover by.
  let coveredShare: Double?
  /// When a goal without a date finishes at this time; nil when the time can't hold it all.
  let endDate: String?
  /// For an exam studying everything: when everything ends at this time, once the plan holds it.
  let fullCourseEndDate: String?
  let ready: Bool
}

struct TimeToCover: PlanAnswer, Decodable {
  struct Suggested: Equatable, Sendable, Decodable {
    enum Kind: String, Sendable, Decodable {
      case everything
      case everyTopic
    }

    let kind: Kind
    let minutes: Int
  }

  let pastDate: Bool
  let ready: Bool
  let recommendedMinutes: Int?
  /// The time the question starts on: what covers everything, else what reaches every topic.
  let suggested: Suggested?
  let targetDate: String?
  let targetDateNamedMonth: Bool
}

struct LevelTest: Decodable, Equatable, Sendable {
  enum Status: String, Decodable, Sendable {
    case preparing
    case ready
  }

  enum Skill: String, Decodable, Sendable {
    case reading
    case listening
    case speaking
    case writing
  }

  struct Level: Decodable, Equatable, Identifiable, Sendable {
    let label: String
    /// From 0 to 5, A1 to C2.
    let score: Double
    let skill: Skill

    var id: Skill { skill }
  }

  struct Question: Decodable, Equatable, Sendable {
    let id: String
    let options: [String]
    /// The text a reading question shows, or the message a listening one plays.
    let passage: String
    let question: String
    let skill: Skill
  }

  struct Sentence: Decodable, Equatable, Sendable {
    let sentence: String
    let translation: String
  }

  struct Next: Decodable, Equatable, Sendable {
    let kind: String
    let question: Question?
    let speaking: Sentence?
  }

  let status: Status
  /// Set while a run writes the pair's questions.
  let startedAt: String?
  let answered: Int?
  let total: Int?
  let levels: [Level]?
  let next: Next?
}

enum GenerationStatus: Sendable {
  case working
  case completed
  /// Failed or cancelled: its content won't come without starting it again.
  case stopped
}

struct OnboardingLimit: Decodable, Equatable, Sendable {
  let period: String
  let resource: String
  let tier: String

  /// A guest's one goal and the free plan's active goals are lifted by an account or Plus, not by waiting.
  var isGoalLimit: Bool { ["activeGoals", "goal"].contains(resource) }
}

enum WaitlistOutcome: Equatable {
  case joined
  /// A visitor or guest: an account is how they're told when lessons are ready.
  case signInRequired
}

struct OnboardingAPI: Sendable {
  let clients: APIClientFactory

  func understand(goal: String, token: String) async throws -> OnboardingDraft {
    let output = try await clients.perform(token: token) { client in
      try await client.createGoalUnderstanding(
        body: .json(
          .init(
            goal: goal,
            language: Self.language,
            timeZone: TimeZone.current.identifier)))
    }

    switch output {
    case .created(let response):
      return try response.body.json
    case .accepted(let response):
      return try response.body.json
    case .code402(let response):
      throw Self.error(try response.body.json)
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .badRequest, .internalServerError, .undocumented:
      throw APIError.unavailable
    }
  }

  /// Only a goal typed and not confirmed: a goal or the day continues on its own screens.
  func resume(token: String) async throws -> OnboardingResume {
    let output = try await clients.perform(token: token) { client in
      try await client.getOnboardingResume()
    }

    switch output {
    case .ok(let response):
      let body: ResumeBody = try PracticeJSON.recode(try response.body.json)

      guard let resume = body.resume, resume.kind == "draft", let draftId = resume.draftId,
        let prompt = resume.prompt
      else {
        return OnboardingResume(draft: nil)
      }

      return OnboardingResume(draft: .init(draftId: draftId, prompt: prompt))
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func understanding(id: String, token: String) async throws -> OnboardingDraft {
    let output = try await clients.perform(token: token) { client in
      try await client.getGoalUnderstanding(path: .init(understandingId: id))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .notFound:
      throw APIError.notFound
    case .unauthorized:
      throw APIError.unauthorized
    case .badRequest, .internalServerError, .undocumented:
      throw APIError.unavailable
    }
  }

  func readAgain(id: String, token: String) async throws -> OnboardingDraft {
    let output = try await clients.perform(token: token) { client in
      try await client.createGoalUnderstandingGeneration(path: .init(understandingId: id))
    }

    switch output {
    case .accepted(let response):
      return try response.body.json
    case .ok(let response):
      return try response.body.json
    case .code402(let response):
      throw Self.error(try response.body.json)
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// Saves one fix on "Here's what I understood"; the server recomputes what depends on it.
  func revise(
    id: String,
    edit: Components.Schemas.OnboardingDraftEdit,
    token: String
  ) async throws -> OnboardingDraft {
    let output = try await clients.perform(token: token) { client in
      try await client.reviseGoalUnderstanding(
        path: .init(understandingId: id), body: .json(edit))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func createGoals(
    _ input: Components.Schemas.GoalCreateInput,
    token: String
  ) async throws -> Components.Schemas.GoalCreateResponse {
    let output = try await clients.perform(token: token) { client in
      try await client.createGoals(body: .json(input))
    }

    switch output {
    case .created(let response):
      return try response.body.json
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func onboarding(goalID: String, token: String) async throws -> GoalOnboarding {
    let output = try await clients.perform(token: token) { client in
      try await client.getOnboarding(path: .init(goalId: goalID))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .notFound:
      throw APIError.notFound
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func answer(
    _ answer: OnboardingAnswer,
    goalID: String,
    token: String
  ) async throws -> GoalOnboarding {
    let output = try await clients.perform(token: token) { client in
      try await client.answerOnboardingQuestion(path: .init(goalId: goalID), body: .json(answer))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func generationStatus(id: String, token: String) async throws -> GenerationStatus {
    let output = try await clients.perform(token: token) { client in
      try await client.getGeneration(path: .init(generationId: id))
    }

    switch output {
    case .ok(let response):
      switch try response.body.json.status {
      case .pending, .running: return .working
      case .completed: return .completed
      case .failed, .cancelled: return .stopped
      }
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func writeGoal(goalID: String, token: String) async throws -> String {
    let output = try await clients.perform(token: token) { client in
      try await client.createGoalGeneration(path: .init(goalId: goalID))
    }

    switch output {
    case .accepted(let response):
      return try response.body.json.generationId
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func archive(goalID: String, token: String) async throws {
    let output = try await clients.perform(token: token) { client in
      try await client.updateGoal(
        path: .init(goalId: goalID), body: .json(.init(status: .archived)))
    }

    switch output {
    case .ok:
      return
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func joinInstrumentWaitlist(instrument: String, token: String?) async throws -> WaitlistOutcome {
    let output = try await clients.perform(token: token) { client in
      try await client.joinInstrumentWaitlist(
        body: .json(.init(instrument: instrument, language: Self.language)))
    }

    switch output {
    case .ok:
      return .joined
    case .unauthorized, .forbidden:
      return .signInRequired
    default:
      throw APIError.unavailable
    }
  }

  func placement(goalID: String, token: String) async throws -> GoalPlacement {
    let output = try await clients.perform(token: token) { client in
      try await client.getGoalPlacement(
        path: .init(goalId: goalID), query: .init(timeZone: TimeZone.current.identifier))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func answerPlacement(
    _ input: Components.Schemas.PlacementAnswerInput,
    goalID: String,
    token: String
  ) async throws -> Components.Schemas.PlacementAnswerResult {
    let output = try await clients.perform(token: token) { client in
      try await client.createPlacementAnswer(path: .init(goalId: goalID), body: .json(input))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// Ends placement: what was answered sets where each phase starts, or every phase starts at its beginning.
  func completePlacement(goalID: String, fromScratch: Bool, token: String) async throws {
    let output = try await clients.perform(token: token) { client in
      try await client.completeGoalPlacement(
        path: .init(goalId: goalID),
        body: .json(.init(fromScratch: fromScratch, timeZone: TimeZone.current.identifier)))
    }

    switch output {
    case .ok:
      return
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func timeAdvice(goalID: String, week: ScheduleWeek, dailyMinutes: Int, token: String)
    async throws -> TimeAdvice
  {
    let input = try PracticeJSON.recode(
      ScheduleWeekInput(week: week, dailyMinutes: dailyMinutes),
      as: Components.Schemas.PlanTimeAdviceInput.self)
    let output = try await clients.perform(token: token) { client in
      try await client.getPlanTimeAdvice(path: .init(goalId: goalID), body: .json(input))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func timeToCover(goalID: String, week: ScheduleWeek, token: String) async throws -> TimeToCover {
    let input = try PracticeJSON.recode(
      ScheduleWeekInput(week: week, dailyMinutes: nil),
      as: Components.Schemas.PlanTimeToCoverInput.self)
    let output = try await clients.perform(token: token) { client in
      try await client.findPlanTimeToCover(path: .init(goalId: goalID), body: .json(input))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func attach(_ material: MaterialInput, token: String) async throws -> AttachedSource {
    let input = try PracticeJSON.recode(material, as: Components.Schemas.CreateUploadRequest.self)
    let output = try await clients.perform(token: token) { client in
      try await client.createUpload(body: .json(input))
    }

    switch output {
    case .created(let response):
      return try PracticeJSON.recode(try response.body.json.source)
    case .code402(let response):
      throw Self.error(try response.body.json)
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unprocessableContent:
      throw OnboardingError.unsupported
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// A file goes straight to Blob storage, which the API signs (once the plan's uploads allow
  /// it), since requests to the API are capped at 4.5 MB; then it's saved like pasted text. The
  /// storage request is Vercel Blob's presigned upload, as its browser client sends it.
  func upload(file: URL, pathname: String, token: String) async throws {
    let request = try PracticeJSON.recode(
      BlobPresignRequest(payload: .init(pathname: pathname)),
      as: Components.Schemas.UploadTokenRequest.self)
    let output = try await clients.perform(token: token) { client in
      try await client.createUploadToken(body: .json(request))
    }

    let presigned: Components.Schemas.UploadToken.PresignedUrlPayloadPayload
    switch output {
    case .ok(let response):
      presigned = try response.body.json.presignedUrlPayload
    case .code402(let response):
      throw Self.error(try response.body.json)
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }

    try await BlobUpload.put(
      file: file, pathname: pathname, delegationToken: presigned.delegationToken,
      signature: presigned.signature, params: presigned.params.additionalProperties)
  }

  func askMaterial(question: String, sourceIDs: [String], token: String) async throws
    -> MaterialAnswer
  {
    let output = try await clients.perform(token: token) { client in
      try await client.askMaterialQuestion(
        body: .json(.init(language: Self.language, question: question, sourceIds: sourceIDs)))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .code402(let response):
      throw Self.error(try response.body.json)
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// Read-only: it never starts writing questions.
  func levelTest(goalID: String, token: String) async throws -> LevelTest {
    let output = try await clients.perform(token: token) { client in
      try await client.getLanguageLevelTest(path: .init(goalId: goalID))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  /// Joins the run already writing the questions; nil when they're written.
  func prepareLevelTest(goalID: String, token: String) async throws -> String? {
    let output = try await clients.perform(token: token) { client in
      try await client.createLanguageLevelTestGeneration(path: .init(goalId: goalID))
    }

    switch output {
    case .ok(let response):
      return try response.body.json.generationId
    case .accepted(let response):
      return try response.body.json.generationId
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func answerLevelTest(
    _ input: Components.Schemas.LanguageLevelTestAnswerInput,
    goalID: String,
    token: String
  ) async throws -> LevelTest {
    let output = try await clients.perform(token: token) { client in
      try await client.answerLanguageLevelTest(path: .init(goalId: goalID), body: .json(input))
    }

    switch output {
    case .ok(let response):
      return try PracticeJSON.recode(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func finishLevelTest(goalID: String, token: String) async throws {
    let output = try await clients.perform(token: token) { client in
      try await client.finishLanguageLevelTest(path: .init(goalId: goalID))
    }

    switch output {
    case .ok:
      return
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  func prepareLessons(goalID: String, token: String) async throws {
    let output = try await clients.perform(token: token) { client in
      try await client.createGoalLessonPreparation(path: .init(goalId: goalID))
    }

    switch output {
    case .accepted:
      return
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  /// A nil level asks for a quick test. The learner's goal already on the course starts nothing new.
  func startCourse(
    courseID: String,
    chapterID: String?,
    level: String?,
    token: String
  ) async throws -> String {
    var body: [String: Any] = ["timeZone": TimeZone.current.identifier]

    // A chapter's start doesn't ask the level: the plan starts at that chapter.
    if let chapterID {
      body["chapterId"] = chapterID
    } else {
      body["level"] = level ?? NSNull()
    }
    let input = try JSONDecoder().decode(
      Components.Schemas.CourseGoalStartInput.self,
      from: JSONSerialization.data(withJSONObject: body))
    let output = try await clients.perform(token: token) { client in
      try await client.startCourseGoal(path: .init(courseId: courseID), body: .json(input))
    }

    switch output {
    case .created(let response):
      return try response.body.json.id
    case .ok(let response):
      return try response.body.json.id
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  /// Never its owner's progress.
  func planLink(id: String, token: String?) async throws -> Components.Schemas.PlanLink {
    let output = try await clients.perform(token: token) { client in
      try await client.getPlanLink(path: .init(planId: id))
    }

    switch output {
    case .ok(let response):
      return try response.body.json
    case .notFound:
      throw APIError.notFound
    default:
      throw APIError.unavailable
    }
  }

  func startFromPlanLink(
    id: String,
    dailyMinutes: Int,
    token: String
  ) async throws -> (goalID: String, isNew: Bool) {
    let output = try await clients.perform(token: token) { client in
      try await client.createGoalFromPlanLink(
        path: .init(planId: id),
        body: .json(.init(dailyMinutes: dailyMinutes, timeZone: TimeZone.current.identifier)))
    }

    switch output {
    case .created(let response):
      return (try response.body.json.id, true)
    case .ok(let response):
      return (try response.body.json.id, false)
    case .forbidden(let response):
      throw Self.error(try response.body.json)
    case .tooManyRequests(let response):
      throw Self.error(try response.body.json)
    case .unauthorized:
      throw APIError.unauthorized
    default:
      throw APIError.unavailable
    }
  }

  static var language: String {
    Bundle.main.preferredLocalizations.first.map { String($0.prefix(2)) } ?? "en"
  }

  /// A refusal without a product code is a plain failure.
  static func error(_ payload: Components.Schemas._Error) -> OnboardingError {
    switch payload.error.code {
    case "SIGN_UP_REQUIRED":
      return .signUpRequired
    case "SLOW_DOWN":
      return .slowDown
    case "USAGE_LIMIT_REACHED":
      return limit(from: payload.error.details, nested: true).map(OnboardingError.limit)
        ?? .failed(.unavailable)
    case "GOAL_LIMIT_REACHED":
      return limit(from: payload.error.details, nested: false).map(OnboardingError.goalLimit)
        ?? .failed(.unavailable)
    default:
      return .failed(.unavailable)
    }
  }

  /// Under `details.limit` for usage, as `details` itself for goals.
  private static func limit(from details: OpenAPIValueContainer?, nested: Bool) -> OnboardingLimit?
  {
    struct Details: Decodable {
      let limit: OnboardingLimit
    }

    guard let details, let data = try? JSONEncoder().encode(details) else {
      return nil
    }

    return nested
      ? try? JSONDecoder().decode(Details.self, from: data).limit
      : try? JSONDecoder().decode(OnboardingLimit.self, from: data)
  }
}
