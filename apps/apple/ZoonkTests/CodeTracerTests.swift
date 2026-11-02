import Foundation
import Testing

@testable import Zoonk

struct CodeTracerTests {
  @Test func asksEachPauseOnTheNextStepInTurnThenTheFirstAgain() throws {
    let fields = try JSONDecoder().decode(
      CodeTracerFields.self,
      from: Data(
        #"""
        {"code":"let x = 1;","language":"javascript","pauses":[{"options":[],"question":"x?","step":3,"variable":"x"},{"options":[],"question":"y?","step":3,"variable":"y"}],"trace":[],"watch":[]}
        """#.utf8))

    #expect(fields.upcomingPause(after: 2, predictions: [:]) == 0)
    #expect(fields.upcomingPause(after: 2, predictions: ["0": "b"]) == 1)
    #expect(fields.upcomingPause(after: 2, predictions: ["0": "b", "1": "c"]) == 0)
  }
}
