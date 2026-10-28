let progressUITestSnapshotJSON =
  #"""
  {
    "activity": {
      "days": \#(progressUITestActivityDaysJSON),
      "summary": {
        "learningDays": 12,
        "totalLearningSeconds": 7200,
        "totalLessonCompletions": 24
      }
    },
    "energy": {
      "currentEnergy": 82,
      "days": \#(progressUITestEnergyDaysJSON),
      "insights": { "averageEnergy": 73, "fullEnergyDays": 3 }
    },
    "level": {
      "belt": "green",
      "bpPerLevel": 1000,
      "bpToNextLevel": 240,
      "isMaxLevel": false,
      "level": 4,
      "nextBelt": { "belt": "blue", "brainPowerToGo": 6240, "startBrainPower": 10000 },
      "progressInLevel": 760,
      "totalBrainPower": 3760
    },
    "score": {
      "dataPoints": [
        {
          "date": "2026-06-01",
          "performance": {
            "correctAnswers": 8,
            "incorrectAnswers": 4,
            "score": 66.7,
            "totalAnswers": 12
          }
        },
        {
          "date": "2026-07-06",
          "performance": {
            "correctAnswers": 13,
            "incorrectAnswers": 3,
            "score": 81.3,
            "totalAnswers": 16
          }
        },
        {
          "date": "2026-08-17",
          "performance": {
            "correctAnswers": 20,
            "incorrectAnswers": 2,
            "score": 90.9,
            "totalAnswers": 22
          }
        }
      ],
      "performance": {
        "correctAnswers": 41,
        "incorrectAnswers": 9,
        "score": 82,
        "totalAnswers": 50
      },
      "periodEnd": "2026-08-20",
      "periodStart": "2026-05-23"
    },
    "patterns": {
      "dayparts": [
        {
          "daypart": "night",
          "performance": {
            "correctAnswers": 0,
            "incorrectAnswers": 0,
            "score": 0,
            "totalAnswers": 0
          }
        },
        {
          "daypart": "morning",
          "performance": {
            "correctAnswers": 20,
            "incorrectAnswers": 2,
            "score": 90.9,
            "totalAnswers": 22
          }
        },
        {
          "daypart": "afternoon",
          "performance": {
            "correctAnswers": 12,
            "incorrectAnswers": 4,
            "score": 75,
            "totalAnswers": 16
          }
        },
        {
          "daypart": "evening",
          "performance": {
            "correctAnswers": 9,
            "incorrectAnswers": 3,
            "score": 75,
            "totalAnswers": 12
          }
        }
      ],
      "strongestDaypart": {
        "daypart": "morning",
        "performance": {
          "correctAnswers": 20,
          "incorrectAnswers": 2,
          "score": 90.9,
          "totalAnswers": 22
        }
      },
      "strongestWeekday": {
        "performance": {
          "correctAnswers": 14,
          "incorrectAnswers": 1,
          "score": 93.3,
          "totalAnswers": 15
        },
        "weekday": "tuesday"
      },
      "weekdays": [
        {
          "performance": { "correctAnswers": 0, "incorrectAnswers": 0, "score": 0, "totalAnswers": 0 },
          "weekday": "sunday"
        },
        {
          "performance": { "correctAnswers": 5, "incorrectAnswers": 2, "score": 71.4, "totalAnswers": 7 },
          "weekday": "monday"
        },
        {
          "performance": { "correctAnswers": 14, "incorrectAnswers": 1, "score": 93.3, "totalAnswers": 15 },
          "weekday": "tuesday"
        },
        {
          "performance": { "correctAnswers": 7, "incorrectAnswers": 2, "score": 77.8, "totalAnswers": 9 },
          "weekday": "wednesday"
        },
        {
          "performance": { "correctAnswers": 6, "incorrectAnswers": 2, "score": 75, "totalAnswers": 8 },
          "weekday": "thursday"
        },
        {
          "performance": { "correctAnswers": 5, "incorrectAnswers": 1, "score": 83.3, "totalAnswers": 6 },
          "weekday": "friday"
        },
        {
          "performance": { "correctAnswers": 4, "incorrectAnswers": 1, "score": 80, "totalAnswers": 5 },
          "weekday": "saturday"
        }
      ]
    }
  }
  """#

let progressEmptyUITestSnapshotJSON =
  #"""
  {
    "activity": {
      "days": [],
      "summary": {
        "learningDays": 0,
        "totalLearningSeconds": 0,
        "totalLessonCompletions": 0
      }
    },
    "energy": null,
    "level": null,
    "patterns": null,
    "score": null
  }
  """#

/// The past 12 months as the API sends them: Sunday first, every day up to Thursday, Aug 20, 2026,
/// a few of them studied (the newest with 9 activities).
private let progressUITestDates: [String] = {
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = .gmt
  let end = calendar.date(from: DateComponents(year: 2026, month: 8, day: 20))!
  let start = calendar.date(byAdding: .day, value: -(52 * 7 + 4), to: end)!
  var format = Date.ISO8601FormatStyle().year().month().day()
  format.timeZone = .gmt

  return (0...(52 * 7 + 4)).map {
    calendar.date(byAdding: .day, value: $0, to: start)!.formatted(format)
  }
}()

private let progressUITestActivityDaysJSON =
  "["
  + progressUITestDates.enumerated().map { index, date in
    let count = date == "2026-08-20" ? 9 : (index % 5 == 0 ? index % 7 : 0)
    return #"{ "activitiesCompleted": \#(count), "date": "\#(date)" }"#
  }.joined(separator: ", ") + "]"

private let progressUITestEnergyDaysJSON =
  "["
  + progressUITestDates.enumerated().map { index, date in
    let energy = date == "2026-08-20" ? "82" : (index < 200 ? "null" : String(40 + index % 60))
    return #"{ "date": "\#(date)", "energy": \#(energy) }"#
  }.joined(separator: ", ") + "]"
