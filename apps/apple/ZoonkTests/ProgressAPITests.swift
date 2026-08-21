import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class ProgressAPITests: XCTestCase {
  func testOverviewMapsGeneratedProgressPayload() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserProgress",
        status: .ok,
        responseBody:
          #"""
          {
            "activity": {
              "learningDays": 12,
              "totalLearningSeconds": 7200,
              "totalLessonCompletions": 24
            },
            "energy": { "currentEnergy": 82.5 },
            "level": {
              "belt": "green",
              "bpPerLevel": 1000,
              "bpToNextLevel": 240,
              "isMaxLevel": false,
              "level": 4,
              "progressInLevel": 760,
              "totalBrainPower": 3760
            },
            "score": {
              "correctAnswers": 41,
              "incorrectAnswers": 9,
              "score": 82,
              "totalAnswers": 50
            },
            "scorePatterns": {
              "strongestTime": {
                "correctAnswers": 20,
                "incorrectAnswers": 2,
                "score": 90.9,
                "totalAnswers": 22,
                "period": "morning"
              },
              "strongestWeekday": {
                "correctAnswers": 14,
                "incorrectAnswers": 1,
                "score": 93.3,
                "totalAnswers": 15,
                "dayOfWeek": "tuesday"
              }
            }
          }
          """#))

    let overview = try await api.getOverview(token: "test-session")

    XCTAssertEqual(overview.activity.learningDays, 12)
    XCTAssertEqual(overview.energy, 82.5)
    XCTAssertEqual(overview.level?.belt, .green)
    XCTAssertEqual(overview.level?.totalBrainPower, 3_760)
    XCTAssertEqual(overview.score?.correctAnswers, 41)
    XCTAssertEqual(overview.strongestDaypart?.daypart, .morning)
    XCTAssertEqual(overview.strongestWeekday?.weekday, .tuesday)
  }

  func testActivityMapsLogicalCalendarDates() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserActivity",
        status: .ok,
        responseBody:
          #"""
          {
            "activity": {
              "learningDays": 2,
              "totalLearningSeconds": 600,
              "totalLessonCompletions": 3,
              "days": [
                { "date": "2026-08-19", "lessonCompletions": 1 },
                { "date": "2026-08-20", "lessonCompletions": 2 }
              ]
            }
          }
          """#))

    let activity = try await api.getActivity(token: "test-session")
    let expectedDate = try XCTUnwrap(ProgressDate("2026-08-19"))

    XCTAssertEqual(activity.days.first?.date, expectedDate)
    XCTAssertEqual(activity.days.last?.lessonCompletions, 2)
    XCTAssertEqual(activity.summary.totalLessonCompletions, 3)
  }

  func testEnergyPreservesDaysWithoutMeasurements() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserEnergy",
        status: .ok,
        responseBody:
          #"""
          {
            "energy": {
              "currentEnergy": 88,
              "days": [
                { "date": "2026-08-19", "energy": null },
                { "date": "2026-08-20", "energy": 88 }
              ],
              "insights": { "averageEnergy": 88, "fullEnergyDays": 1 }
            }
          }
          """#))

    let response = try await api.getEnergy(token: "test-session")
    let energy = try XCTUnwrap(response)
    let expectedDate = try XCTUnwrap(ProgressDate("2026-08-19"))

    XCTAssertEqual(energy.days.first?.date, expectedDate)
    XCTAssertNil(energy.days.first?.energy)
    XCTAssertEqual(energy.insights?.fullEnergyDays, 1)
  }

  func testEnergyMapsMissingProgressToNil() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserEnergy",
        status: .ok,
        responseBody: #"{"energy":null}"#))

    let energy = try await api.getEnergy(token: "test-session")

    XCTAssertNil(energy)
  }

  func testLevelMapsGeneratedProgressPayload() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserLevel",
        status: .ok,
        responseBody:
          #"""
          {
            "level": {
              "belt": "black",
              "bpPerLevel": 1000,
              "bpToNextLevel": 0,
              "isMaxLevel": true,
              "level": 10,
              "progressInLevel": 1000,
              "totalBrainPower": 2167500
            }
          }
          """#))

    let response = try await api.getLevel(token: "test-session")
    let level = try XCTUnwrap(response)

    XCTAssertEqual(level.belt, .black)
    XCTAssertEqual(level.level, 10)
    XCTAssertTrue(level.isMaxLevel)
    XCTAssertEqual(level.totalBrainPower, 2_167_500)
  }

  func testScoreMapsGeneratedProgressPayload() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserScore",
        status: .ok,
        responseBody:
          #"""
          {
            "score": {
              "correctAnswers": 21,
              "incorrectAnswers": 4,
              "score": 84,
              "totalAnswers": 25,
              "periodStart": "2026-05-23",
              "periodEnd": "2026-08-20",
              "dataPoints": [
                {
                  "date": "2026-08-10",
                  "correctAnswers": 8,
                  "incorrectAnswers": 2,
                  "score": 80,
                  "totalAnswers": 10
                },
                {
                  "date": "2026-08-17",
                  "correctAnswers": 13,
                  "incorrectAnswers": 2,
                  "score": 86.7,
                  "totalAnswers": 15
                }
              ]
            }
          }
          """#))

    let response = try await api.getScore(token: "test-session")
    let score = try XCTUnwrap(response)

    XCTAssertEqual(score.performance.totalAnswers, 25)
    XCTAssertEqual(score.dataPoints.count, 2)
    XCTAssertEqual(score.dataPoints.last?.performance.score, 86.7)
    XCTAssertEqual(score.periodStart, ProgressDate("2026-05-23"))
    XCTAssertEqual(score.periodEnd, ProgressDate("2026-08-20"))
  }

  func testPatternsMapEverySemanticCategory() async throws {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserScorePatterns",
        status: .ok,
        responseBody:
          #"""
          {
            "patterns": {
              "strongestTime": {
                "correctAnswers": 9,
                "incorrectAnswers": 1,
                "score": 90,
                "totalAnswers": 10,
                "period": "morning"
              },
              "strongestWeekday": {
                "correctAnswers": 9,
                "incorrectAnswers": 1,
                "score": 90,
                "totalAnswers": 10,
                "dayOfWeek": "tuesday"
              },
              "times": [
                { "correctAnswers": 0, "incorrectAnswers": 0, "score": 0, "totalAnswers": 0, "period": "night" },
                { "correctAnswers": 9, "incorrectAnswers": 1, "score": 90, "totalAnswers": 10, "period": "morning" },
                { "correctAnswers": 3, "incorrectAnswers": 1, "score": 75, "totalAnswers": 4, "period": "afternoon" },
                { "correctAnswers": 2, "incorrectAnswers": 1, "score": 66.7, "totalAnswers": 3, "period": "evening" }
              ],
              "weekdays": [
                { "correctAnswers": 0, "incorrectAnswers": 0, "score": 0, "totalAnswers": 0, "dayOfWeek": "sunday" },
                { "correctAnswers": 3, "incorrectAnswers": 1, "score": 75, "totalAnswers": 4, "dayOfWeek": "monday" },
                { "correctAnswers": 9, "incorrectAnswers": 1, "score": 90, "totalAnswers": 10, "dayOfWeek": "tuesday" },
                { "correctAnswers": 2, "incorrectAnswers": 1, "score": 66.7, "totalAnswers": 3, "dayOfWeek": "wednesday" },
                { "correctAnswers": 1, "incorrectAnswers": 1, "score": 50, "totalAnswers": 2, "dayOfWeek": "thursday" },
                { "correctAnswers": 4, "incorrectAnswers": 1, "score": 80, "totalAnswers": 5, "dayOfWeek": "friday" },
                { "correctAnswers": 3, "incorrectAnswers": 2, "score": 60, "totalAnswers": 5, "dayOfWeek": "saturday" }
              ]
            }
          }
          """#))

    let response = try await api.getScorePatterns(token: "test-session")
    let patterns = try XCTUnwrap(response)

    XCTAssertEqual(patterns.dayparts.map(\.daypart), ProgressDaypart.allCases)
    XCTAssertEqual(patterns.weekdays.map(\.weekday), ProgressWeekday.allCases)
    XCTAssertEqual(patterns.strongestDaypart?.daypart, .morning)
    XCTAssertEqual(patterns.strongestWeekday?.weekday, .tuesday)
    XCTAssertFalse(patterns.weekdays.first?.performance.hasAnswers ?? true)
  }

  func testUnauthorizedResponseMapsToUnauthorized() async {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserProgress",
        status: .unauthorized,
        responseBody:
          #"{"error":{"code":"UNAUTHORIZED","message":"Sign in to continue"}}"#))

    do {
      _ = try await api.getOverview(token: "test-session")
      XCTFail("Expected an unauthorized error")
    } catch let error as ProgressAPIError {
      XCTAssertEqual(error, .unauthorized)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testURLFailureMapsToNetwork() async {
    let api = makeProgressAPI(
      transport: ProgressFailureTransport(failure: .network))

    do {
      _ = try await api.getOverview(token: "test-session")
      XCTFail("Expected a network error")
    } catch let error as ProgressAPIError {
      XCTAssertEqual(error, .network)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancellationErrorIsPreserved() async {
    let api = makeProgressAPI(
      transport: ProgressFailureTransport(failure: .cancellation))

    do {
      _ = try await api.getOverview(token: "test-session")
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancelledURLRequestIsPreservedAsCancellation() async {
    let api = makeProgressAPI(
      transport: ProgressFailureTransport(failure: .cancelledURL))

    do {
      _ = try await api.getOverview(token: "test-session")
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testInvalidLogicalDateMapsToInvalidResponse() async {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserActivity",
        status: .ok,
        responseBody:
          #"""
          {
            "activity": {
              "learningDays": 1,
              "totalLearningSeconds": 300,
              "totalLessonCompletions": 1,
              "days": [{ "date": "2026-02-30", "lessonCompletions": 1 }]
            }
          }
          """#))

    do {
      _ = try await api.getActivity(token: "test-session")
      XCTFail("Expected an invalid response error")
    } catch let error as ProgressAPIError {
      XCTAssertEqual(error, .invalidResponse)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testServerErrorMapsToInvalidResponse() async {
    let api = makeProgressAPI(
      transport: ProgressResponseTransport(
        expectedOperationID: "getCurrentUserProgress",
        status: .internalServerError,
        responseBody:
          #"{"error":{"code":"INTERNAL_SERVER_ERROR","message":"Try again later"}}"#))

    do {
      _ = try await api.getOverview(token: "test-session")
      XCTFail("Expected an invalid response error")
    } catch let error as ProgressAPIError {
      XCTAssertEqual(error, .invalidResponse)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

private func makeProgressAPI(transport: any ClientTransport) -> ProgressAPI {
  ProgressAPI(
    clients: APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: transport))
}

/// Exercises generated operation selection and shared native authentication without an external server.
private struct ProgressResponseTransport: ClientTransport {
  let expectedOperationID: String
  let status: HTTPResponse.Status
  let responseBody: String

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    XCTAssertEqual(baseURL, URL(string: "https://api.zoonk.test/v1"))
    XCTAssertEqual(operationID, expectedOperationID)
    XCTAssertEqual(request.method, .get)
    XCTAssertEqual(request.headerFields[.authorization], "Bearer test-session")
    XCTAssertNotNil(request.headerFields[.acceptLanguage])

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: status, headerFields: headerFields),
      HTTPBody(responseBody)
    )
  }
}

private enum ProgressTransportFailure: Sendable {
  case cancellation
  case cancelledURL
  case network
}

private struct ProgressFailureTransport: ClientTransport {
  let failure: ProgressTransportFailure

  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    switch failure {
    case .cancellation:
      throw CancellationError()
    case .cancelledURL:
      throw URLError(.cancelled)
    case .network:
      throw URLError(.notConnectedToInternet)
    }
  }
}
