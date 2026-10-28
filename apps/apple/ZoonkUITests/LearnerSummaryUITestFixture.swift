/// The goal every signed-in UI-test learner follows, which the goal switcher shows.
let uiTestGoalTitle = "Learn how plants grow"

/// A learner summary as `GET /v1/me/summary` returns it: one goal with every Study place, so the
/// shell's toolbar and sidebar have everything to show.
let learnerSummaryUITestJSON = """
  {
    "account": { "email": "ui-test@zoonk.test", "image": null, "name": "UI Test User" },
    "activeGoalId": "0b6c4c1e-7a39-4c6e-9f43-2f8f1f0c5a11",
    "analytics": { "disabled": true, "goal": null, "plan": "free", "username": "ui_test_user" },
    "buddy": {
      "beltColor": "yellow", "energy": 64, "glasses": "round", "kind": "zu", "name": "Zu",
      "studiedToday": false
    },
    "day": null,
    "goals": [
      {
        "dailyMinutes": 30,
        "id": "0b6c4c1e-7a39-4c6e-9f43-2f8f1f0c5a11",
        "isActive": true,
        "kind": "learn",
        "status": "active",
        "targetDate": null,
        "targetLanguage": null,
        "title": "\(uiTestGoalTitle)"
      }
    ],
    "identity": {
      "expiresAt": 4102444800000,
      "isAnonymous": false,
      "signedInAt": 1767225600000,
      "userId": "7846d3f5-b9c4-4ded-b283-35f70a48af86"
    },
    "level": { "color": "yellow", "level": 12 },
    "missions": null,
    "nextChangeAt": 4102444800000,
    "places": { "exam": true, "mindMaps": true, "readyMistakes": 2, "speaking": true },
    "readAt": 1767225600000,
    "tier": "free",
    "timeZone": "America/New_York",
    "today": { "blocksLeft": 3, "next": null }
  }
  """
