#if DEBUG
  import SwiftUI

  struct DebugChallenge: View {
    private let step: LessonStep
    @State private var state: LessonPlayerState

    init() {
      let step = try! JSONDecoder().decode(LessonStep.self, from: Data(Self.fixture.utf8))
      self.step = step
      _state = State(initialValue: LessonPlayerState(lessonId: "debug", steps: [step]))
    }

    private var decisionVisual: String? {
      guard case .challenge(let content) = step.content else { return nil }

      return ChallengeProgress(
        content: content, picks: state.challengePicks(step.id), shown: state.revealed[step.id] ?? 0
      ).decisionVisual
    }

    var body: some View {
      if case .challenge(let content) = step.content {
        ScrollViewReader { scroll in
          ScrollView {
            VStack(alignment: .leading, spacing: 20) {
              ForEach([LessonStepPart.screen, .turn], id: \.self) { part in
                ChallengeStepView(
                  step: step, content: content, state: state,
                  select: { state.select($0, for: step.id) }, team: ["Marta", "Rui"], part: part)
              }
            }
            .padding(16)
          }
          .onChange(of: decisionVisual) { _, visual in
            if visual != nil {
              withAnimation { scroll.scrollTo(ChallengeStepView.decisionVisualId) }
            }
          }
        }
        .bottomBar {
          Button {
            state.continueLesson()
          } label: {
            Text(verbatim: "Continue")
          }
          .buttonStyle(.mainAction)
        }
      }
    }

    private static let fixture = #"""
      {"id": "challenge", "position": 0, "skillId": null, "citation": null, "image": null,
       "imagePending": false, "kind": "challenge", "content": {
        "title": "The drifting filler", "variant": "work", "setting": "Bottling plant",
        "mission": "Keep Line 3's bottles on target without stopping the plant for nothing.",
        "deadline": null,
        "team": [
         {"id": "lead", "role": "Shift lead", "expertise": "Runs the line", "ai": false},
         {"id": "qa", "role": "Quality analyst", "expertise": "Reads control charts", "ai": false}],
        "meters": [
         {"id": "quality", "label": "Quality", "start": 60, "goodWhen": "high"},
         {"id": "output", "label": "Output", "start": 70, "goodWhen": "high"}],
        "panels": [],
        "skills": [{"id": "s1", "name": "Reading a control chart", "practice": "Spot a trend"}],
        "startNodeId": "n1",
        "nodes": [
         {"id": "n1", "prompt": "What do you do about Line 3?",
          "messages": [
           {"from": "lead", "text": "Line 3's hourly averages are in. Every one is inside the limits."},
           {"from": "qa", "text": "Before you decide, look at how the weights moved over the shift."}],
          "visual": {"kind": "plot", "title": "Line 3 fill weight, last 8 hours",
           "xLabel": "Hour of shift", "xUnit": null, "yLabel": "Fill weight", "yUnit": "g",
           "series": [{"name": "Line 3", "mark": "lineWithPoints", "points": [
            {"x": 1, "y": 500.4, "label": null}, {"x": 2, "y": 499.1, "label": null},
            {"x": 3, "y": 501.2, "label": null}, {"x": 4, "y": 500.8, "label": null},
            {"x": 5, "y": 502.9, "label": null}, {"x": 6, "y": 503.6, "label": null},
            {"x": 7, "y": 504.8, "label": null}, {"x": 8, "y": 506.3, "label": "Hour 8"}]}],
           "references": [{"label": "Upper limit", "y": 506}, {"label": "Target", "y": 500},
            {"label": "Lower limit", "y": 494}],
           "source": null},
          "choices": [
           {"id": "stop", "text": "Stop Line 3 and check the filler before the next batch.",
            "next": "n2", "quality": "strong",
            "effects": [{"meter": "quality", "change": 20}, {"meter": "output", "change": -10}],
            "replies": [{"from": "lead", "text": "Fair. The weights climbed six hours in a row."}],
            "notes": []},
           {"id": "keep", "text": "Keep it running. Nothing is out of limits.", "next": "n2",
            "quality": "weak", "effects": [{"meter": "quality", "change": -25}],
            "replies": [{"from": "qa", "text": "Hour 8 just crossed the upper limit."}],
            "notes": []}]},
         {"id": "n2", "prompt": "What do you tell the night shift?",
          "messages": [{"from": "lead", "text": "Night shift starts in ten minutes."}],
          "choices": [
           {"id": "brief", "text": "Brief them on the drift and what to watch.", "next": "end",
            "quality": "strong", "effects": [], "replies": [], "notes": []},
           {"id": "nothing", "text": "Nothing. It's handled.", "next": "end", "quality": "weak",
            "effects": [], "replies": [], "notes": []}]}],
        "endings": [{"id": "end", "outcome": "The shift ends."}]}}
      """#
  }
#endif
