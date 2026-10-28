import SwiftUI

struct CodeSQLCanvas: View {
  let context: ActivityCanvasContext
  let fields: CodeSQLFields
  @State private var query: String
  @State private var result: CodeSQLResult?
  @State private var error: String?
  @State private var task: Task<Void, Never>?
  @State private var revision = 0
  @State private var solutionWorks = false

  init(context: ActivityCanvasContext, fields: CodeSQLFields) {
    self.context = context
    self.fields = fields
    _query = State(initialValue: context.phase == .explore ? fields.solution : "")
    _result = State(initialValue: try? context.answer?.decode(as: CodeSQLResult.self))
  }

  private var locked: Bool { if case .checked = context.phase { true } else { false } }

  var body: some View {
    VStack(alignment: .leading) {
      ForEach(fields.tables, id: \.name) { table in
        DisclosureGroup(table.name) {
          CodeResultGrid(
            result: CodeSQLResult(columns: table.columns.map(\.name), rows: table.rows))
        }
      }
      if !locked {
        Text("Your query", tableName: "ActivitiesCode", comment: "SQL editor label").font(.headline)
        CodeTextEditor(
          text: $query,
          label: String(
            localized: "Your query", table: "ActivitiesCode", comment: "SQL editor label")
        ).font(.body.monospaced())
          .autocorrectionDisabled().textInputAutocapitalization(.never)
          .accessibilityLabel(
            Text("Your query", tableName: "ActivitiesCode", comment: "SQL editor label")
          )
          .frame(maxWidth: .infinity, alignment: .leading)
        Button {
          let current = revision
          let sql = query
          task = Task {
            let outcome = await Task.detached { () -> Result<CodeSQLResult, Error> in
              Result { try CodeSQLRunner.run(query: sql, tables: fields.tables) }
            }.value
            guard !Task.isCancelled, current == revision else { return }
            switch outcome {
            case .success(let value):
              result = value
              error = nil
              context.setAnswer(try? ActivityAnswer(encoding: value))
            case .failure(let failure):
              error = failure.localizedDescription
              result = nil
              context.setAnswer(nil)
            }
            task = nil
          }
        } label: {
          Text("Run", tableName: "ActivitiesCode", comment: "Execute SQL query")
        }
        .buttonStyle(.mainAction).disabled(
          task != nil || query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
      }
      if task != nil {
        ProgressView {
          Text("Running…", tableName: "ActivitiesCode", comment: "A program or query is running")
        }
      }
      if let error { Text(verbatim: error).foregroundStyle(.red) }
      if let result { CodeResultGrid(result: result) }
      if locked {
        Text("Expected result", tableName: "ActivitiesCode", comment: "Reference query result")
          .font(.headline)
        CodeResultGrid(
          result: CodeSQLResult(columns: fields.expected.columns, rows: fields.expected.rows))
        if case .checked(isCorrect: false) = context.phase {
          ForEach(fields.mistakes, id: \.mistake) { mistake in
            Text(verbatim: mistake.mistake).font(.headline)
            Text(verbatim: mistake.feedback)
          }
        }
        if solutionWorks {
          Text(
            "A query that works", tableName: "ActivitiesCode",
            comment: "Verified reference SQL query"
          ).font(.headline)
          Text(verbatim: fields.solution).font(.body.monospaced())
        }
      }
    }
    .task(id: locked) {
      guard locked else { return }
      let verified = await Task.detached {
        (try? CodeSQLRunner.run(query: fields.solution, tables: fields.tables))?.matches(
          fields.expected) == true
      }.value
      guard !Task.isCancelled else { return }
      solutionWorks = verified
    }
    .onChange(of: query) {
      revision += 1
      task?.cancel()
      task = nil
      result = nil
      error = nil
      context.setAnswer(nil)
    }
    .onDisappear {
      revision += 1
      task?.cancel()
      task = nil
    }
  }
}

struct CodeResultGrid: View {
  let result: CodeSQLResult
  var body: some View {
    ScrollView(.horizontal) {
      Grid(alignment: .leading) {
        GridRow {
          ForEach(Array(result.columns.enumerated()), id: \.offset) { _, column in
            Text(verbatim: column).font(.headline)
          }
        }
        ForEach(Array(result.rows.enumerated()), id: \.offset) { _, row in
          GridRow {
            ForEach(Array(row.enumerated()), id: \.offset) { index, value in
              Text(verbatim: CodeActivityText.display(value))
                .accessibilityLabel(
                  "\(result.columns.indices.contains(index) ? result.columns[index] : ""): \(CodeActivityText.display(value))"
                )
            }
          }
        }
      }.font(.body.monospaced()).textSelection(.enabled)
    }
  }
}
