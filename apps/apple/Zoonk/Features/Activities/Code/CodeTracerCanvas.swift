import SwiftUI

struct CodeTracerCanvas: View {
  let context: ActivityCanvasContext
  let fields: CodeTracerFields
  @State private var step: Int
  @State private var furthest: Int
  @State private var predictions: [String: JSONValue]

  init(context: ActivityCanvasContext, fields: CodeTracerFields) {
    self.context = context
    self.fields = fields
    _furthest = State(initialValue: fields.pauses.contains { $0.step == 0 } ? -1 : 0)
    _step = State(initialValue: fields.pauses.contains { $0.step == 0 } ? -1 : 0)
    if case .object(let pairs) = context.answer?.value["pairs"] {
      _predictions = State(initialValue: pairs)
    } else {
      _predictions = State(initialValue: [:])
    }
  }

  private var asking: Bool { context.phase == .answering }
  private var blocking: Int? {
    asking
      ? fields.pauses.indices.first {
        fields.pauses[$0].step == step + 1 && predictions[String($0)] == nil
      } : nil
  }

  var body: some View {
    VStack(alignment: .leading) {
      if step < 0 {
        Text(
          "Before the first line", tableName: "ActivitiesCode",
          comment: "Trace has not executed yet")
      } else {
        Text(
          "Step \(step + 1) of \(fields.trace.count)", tableName: "ActivitiesCode",
          comment: "Trace position")
      }
      ForEach(Array(fields.code.components(separatedBy: "\n").enumerated()), id: \.offset) {
        index, line in
        let active = step >= 0 && fields.trace[step].line == index + 1
        HStack(alignment: .firstTextBaseline) {
          Text(verbatim: "\(index + 1)").foregroundStyle(.secondary)
          Text(verbatim: line)
        }
        .font(.body.monospaced())
        .padding(.vertical, 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(active ? Color.blue.opacity(0.15) : Color.clear)
        .accessibilityAddTraits(active ? .isSelected : [])
      }
      ForEach(fields.watch, id: \.self) { name in
        let value =
          step < 0 ? nil : fields.trace.prefix(step + 1).flatMap(\.values).last { $0.name == name }
        LabeledContent(name, value: value.map { CodeActivityText.display($0.value) } ?? "—")
          .monospaced()
      }
      if asking {
        ForEach(
          fields.pauses.indices.filter {
            fields.pauses[$0].step == step + 1 && fields.pauses[$0].step > furthest
          }, id: \.self
        ) { index in
          let pause = fields.pauses[index]
          Text(verbatim: pause.question).font(.headline)
          ForEach(pause.options, id: \.id) { option in
            Button {
              predictions[String(index)] = .string(option.id)
              context.setAnswer(
                predictions.count == fields.pauses.count
                  ? ActivityAnswer(
                    value: .object(["kind": .string("assignment"), "pairs": .object(predictions)]))
                  : nil)
            } label: {
              Label {
                Text(verbatim: option.text)
              } icon: {
                Image(
                  systemName: predictions[String(index)] == .string(option.id)
                    ? "checkmark.circle.fill" : "circle")
              }
            }
            .buttonStyle(.bordered)
            .accessibilityAddTraits(
              predictions[String(index)] == .string(option.id) ? .isSelected : [])
          }
        }
      }
      HStack {
        Button {
          step -= 1
        } label: {
          Label {
            Text("Back", tableName: "ActivitiesCode", comment: "Previous trace step")
          } icon: {
            Image(systemName: "backward.step")
          }
        }.disabled(step <= (fields.pauses.contains { $0.step == 0 } ? -1 : 0))
        Button {
          step += 1
          furthest = max(furthest, step)
        } label: {
          Label {
            Text(
              "Step forward", tableName: "ActivitiesCode", comment: "Execute the next traced line")
          } icon: {
            Image(systemName: "forward.step")
          }
        }.disabled(step >= fields.trace.count - 1 || blocking != nil)
      }
      if context.phase != .explore {
        ForEach(Array(fields.pauses.enumerated()), id: \.offset) { index, pause in
          if pause.step <= furthest || !asking {
            let selected =
              pause.options.first { predictions[String(index)] == .string($0.id) }?.text ?? "—"
            let expected =
              fields.trace[pause.step].values.first { $0.name == pause.variable }.map {
                CodeActivityText.display($0.value)
              } ?? "—"
            LabeledContent(pause.question) { Text(verbatim: "\(selected) → \(expected)") }
          }
        }
      }
    }
  }
}
