/// The buddy's day as `GET /v1/me/buddy` returns it: the default Zu, awake, before today's
/// session, so the Buddy tab shows its conversation without the network.
let buddyStatusUITestJSON = """
  {
    "belt": {
      "bpPerLevel": 100, "bpToNextLevel": 40, "color": "yellow", "isMaxLevel": false,
      "level": 12, "progressInLevel": 60, "totalBrainPower": 1260
    },
    "buddy": { "glasses": "round", "kind": "zu", "name": null, "picked": false },
    "energy": { "current": 64, "state": "awake", "studiedToday": false },
    "firstSteps": null,
    "glasses": [
      { "current": 1, "earned": true, "glasses": "round", "target": 1 },
      { "current": 0, "earned": false, "glasses": "star", "target": 1 }
    ],
    "nextStage": { "belt": "orange", "brainPowerToGo": 340, "stage": "young" },
    "stage": "baby",
    "thisWeek": { "fixes": 0, "newIdeas": 0, "reviews": 0 },
    "today": null
  }
  """
