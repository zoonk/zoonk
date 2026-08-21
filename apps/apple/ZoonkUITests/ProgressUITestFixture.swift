let progressUITestSnapshotJSON =
  #"""
  {
    "overview": {
      "activity": {
        "learningDays": 12,
        "totalLearningSeconds": 7200,
        "totalLessonCompletions": 24
      },
      "energy": 82,
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
      }
    },
    "activity": {
      "days": [
        { "date": "2026-05-31", "lessonCompletions": 2 },
        { "date": "2026-06-30", "lessonCompletions": 5 },
        { "date": "2026-07-31", "lessonCompletions": 8 },
        { "date": "2026-08-20", "lessonCompletions": 9 }
      ],
      "summary": {
        "learningDays": 12,
        "totalLearningSeconds": 7200,
        "totalLessonCompletions": 24
      }
    },
    "energy": {
      "currentEnergy": 82,
      "days": [
        { "date": "2026-05-31", "energy": null },
        { "date": "2026-06-30", "energy": 64 },
        { "date": "2026-07-31", "energy": 73 },
        { "date": "2026-08-20", "energy": 82 }
      ],
      "insights": { "averageEnergy": 73, "fullEnergyDays": 3 }
    },
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

let progressDaypartOnlyUITestSnapshotJSON =
  #"""
  {
    "overview": {
      "activity": {
        "learningDays": 0,
        "totalLearningSeconds": 0,
        "totalLessonCompletions": 0
      },
      "energy": null,
      "level": null,
      "score": null,
      "strongestDaypart": {
        "daypart": "morning",
        "performance": {
          "correctAnswers": 9,
          "incorrectAnswers": 1,
          "score": 90,
          "totalAnswers": 10
        }
      },
      "strongestWeekday": null
    },
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

let progressEmptyUITestSnapshotJSON =
  #"""
  {
    "overview": {
      "activity": {
        "learningDays": 0,
        "totalLearningSeconds": 0,
        "totalLessonCompletions": 0
      },
      "energy": null,
      "level": null,
      "score": null,
      "strongestDaypart": null,
      "strongestWeekday": null
    },
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
