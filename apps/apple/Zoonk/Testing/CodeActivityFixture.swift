#if DEBUG
  import SwiftUI

  struct CodeActivityFixture: View {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("--code-activities") }
    @State private var selected = "codeTracer"
    private let contents = try! JSONDecoder().decode(
      [ActivityStepContent].self, from: Data(Self.data.utf8))
    var body: some View {
      NavigationStack {
        ScrollView {
          Picker("Template", selection: $selected) {
            ForEach(contents, id: \.template) { Text(verbatim: $0.template).tag($0.template) }
          }.pickerStyle(.menu)
          if let content = contents.first(where: { $0.template == selected }) {
            CodeActivityFixtureCanvas(content: content).id(selected)
          }
        }.padding().navigationTitle("Code activities")
      }
    }
    private static let data = #"""
      [{"check":{"kind":"interaction","explanation":"Here is why."},"fields":{"code":"let lo = 0, hi = 7;\nwhile (lo <= hi) {\n  const mid = Math.floor((lo + hi) / 2);\n  if (mid < 6) lo = mid + 1;\n  else if (mid > 6) hi = mid - 1;\n  else break;\n}","language":"javascript","pauses":[{"options":[{"id":"a","text":"5"},{"id":"b","text":"6"},{"id":"c","text":"7"}],"question":"What will mid be on pass 3?","step":3,"variable":"mid"}],"trace":[{"line":1,"values":[{"name":"lo","value":0},{"name":"hi","value":7}]},{"line":3,"values":[{"name":"lo","value":0},{"name":"mid","value":3}]},{"line":3,"values":[{"name":"lo","value":4},{"name":"mid","value":5}]},{"line":3,"values":[{"name":"lo","value":6},{"name":"mid","value":6}]}],"watch":["lo","hi","mid"]},"prompt":"Find position 6 by halving the range each pass.","template":"codeTracer"},{"check":{"kind":"interaction","explanation":"Here is why."},"fields":{"editableLines":[2],"expectedOutput":"5050","language":"python","mistakes":[{"feedback":"range stops before its end.","output":"4950"}],"solution":"total = 0\nfor n in range(1, 101):\n    total += n\nprint(total)","starterCode":"total = 0\nfor n in range(1, 100):\n    total += n\nprint(total)"},"prompt":"Fix the loop so it adds every whole number from 1 to 100.","template":"codeRunner"},{"check":{"kind":"interaction","explanation":"Here is why."},"data":{"source":{"publisher":"United Nations","title":"World Population Prospects","year":2024}},"fields":{"expected":{"columns":["name","pop_millions"],"orderMatters":true,"rows":[["India",1451],["China",1419],["Indonesia",283]]},"mistakes":[{"feedback":"OR keeps rows that pass either test.","mistake":"Used OR instead of AND"}],"solution":"SELECT name, pop_millions FROM countries WHERE continent = 'Asia' AND pop_millions > 200 ORDER BY pop_millions DESC;","tables":[{"columns":[{"name":"name","type":"text"},{"name":"continent","type":"text"},{"name":"pop_millions","type":"integer"}],"name":"countries","rows":[["India","Asia",1451],["China","Asia",1419],["Brazil","South America",212],["Indonesia","Asia",283]]}]},"prompt":"Which countries in Asia have more than 200 million people?","template":"sqlPlayground"}]
      """#
  }

  private struct CodeActivityFixtureCanvas: View {
    let content: ActivityStepContent
    @State private var answer: ActivityAnswer?
    @State private var phase: ActivityPhase = .answering
    var body: some View {
      VStack(alignment: .leading) {
        Text(verbatim: content.prompt).font(.headline)
        if let renderer = ActivityRendererRegistry(CodeActivityRenderers.all).renderer(
          for: content.template)
        {
          renderer.canvas(
            ActivityCanvasContext(
              template: content.template, payload: content.payload, check: content.check,
              phase: phase, answer: answer, setAnswer: { answer = $0 }))
          Button("Check") {
            phase = .checked(isCorrect: renderer.grade?(content, answer!) ?? false)
          }.disabled(answer == nil)
          if case .checked(let correct) = phase { Text(correct ? "Correct" : "Not quite") }
        }
      }
    }
  }
#endif
