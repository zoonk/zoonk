import SwiftUI

extension ActivityRenderer {
  static let sqlPlayground = ActivityRenderer(
    template: "sqlPlayground", badge: .always(.queryData),
    grade: SQLPlaygroundFields.grade
  ) { context in
    if let fields = try? context.fields(as: SQLPlaygroundFields.self) {
      SQLPlaygroundCanvas(context: context, fields: fields)
    }
  }
}

struct SQLPlaygroundFields: Decodable, Sendable {
  struct Expected: Decodable, Sendable {
    let columns: [String]
    let orderMatters: Bool
    let rows: [[JSONValue]]

    /// Core's `gradeRows`: the same columns whatever their case, and the same rows, in order
    /// when order matters.
    func matches(_ result: SQLResult) -> Bool {
      guard result.columns.map({ $0.lowercased() }) == columns.map({ $0.lowercased() }) else {
        return false
      }

      if orderMatters {
        return result.rows == rows
      }

      var remaining = rows
      for row in result.rows {
        guard let index = remaining.firstIndex(of: row) else {
          return false
        }

        remaining.remove(at: index)
      }

      return remaining.isEmpty
    }
  }

  struct Table: Decodable, Sendable {
    struct Column: Decodable, Sendable {
      let name: String
      let type: String
    }

    let columns: [Column]
    let name: String
    let rows: [[JSONValue]]
  }

  struct Mistake: Decodable, Sendable {
    let feedback: String
    let mistake: String
  }

  let expected: Expected
  let mistakes: [Mistake]
  let solution: String
  let tables: [Table]

  static func grade(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool {
    guard answer.kind == "rows", let fields = try? content.fields(as: Self.self),
      let result = try? answer.decode(as: SQLResult.self)
    else {
      return false
    }

    return fields.expected.matches(result)
  }

  /// Mirrors main's `sqlSnippets`. Keywords and tables add a space after themselves.
  var snippets: [String] {
    let words =
      ["SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "DESC", "GROUP BY", "COUNT(*)"].map {
        $0 + " "
      }
      + tables.flatMap { [$0.name + " "] + $0.columns.map(\.name) }
    return words.enumerated().filter { index, word in
      words.firstIndex {
        $0.trimmingCharacters(in: .whitespaces) == word.trimmingCharacters(in: .whitespaces)
      }
        == index
    }.map(\.element)
  }
}

extension ActivityAnswer {
  static func rows(_ result: SQLResult) -> ActivityAnswer? {
    try? ActivityAnswer(encoding: result)
  }
}

/// The rows of the last run are the answer.
private struct SQLPlaygroundCanvas: View {
  let context: ActivityCanvasContext
  let fields: SQLPlaygroundFields

  @State private var query: String
  @State private var selection: TextSelection?
  @State private var queryRun: SQLRun?
  @State private var activeRun: UUID?
  @State private var revision = 0
  @State private var isStale = false
  @State private var verifiedSolution: String?

  init(context: ActivityCanvasContext, fields: SQLPlaygroundFields) {
    self.context = context
    self.fields = fields
    _query = State(initialValue: context.phase == .explore ? fields.solution : "")
    _queryRun = State(
      initialValue: (try? context.answer?.decode(as: SQLResult.self)).map(SQLRun.done))
  }

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  private var isCorrect: Bool {
    if case .checked(let isCorrect) = context.phase { isCorrect } else { false }
  }

  private var result: SQLResult? {
    if case .done(let result) = queryRun { result } else { nil }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ForEach(fields.tables, id: \.name) { table in
        SQLTableViewer(table: table)
      }

      if !isChecked {
        editor
      }

      if let queryRun, !isStale, let message = errorMessage(queryRun) {
        message
          .font(.subheadline.monospaced())
          .foregroundStyle(.destructive)
      }

      if let result {
        resultView(result)
      }

      if isChecked {
        review
      }
    }
    .task(id: isChecked) {
      guard isChecked else {
        return
      }

      // Shown only once code has run it and it passes the learner's check, so a solution the
      // writer got wrong is never shown as one that works.
      let solution = fields.solution
      let tables = fields.tables
      let run = await Task.detached { CodeSQLRunner.run(query: solution, tables: tables) }.value
      if case .done(let result) = run, fields.expected.matches(result) {
        verifiedSolution = solution
      }
    }
    .onChange(of: query) {
      revision += 1
      isStale = true
      context.setAnswer(nil)
    }
    .onDisappear {
      activeRun = nil
    }
  }

  private var editor: some View {
    VStack(alignment: .leading, spacing: 8) {
      Group {
        if context.phase == .explore {
          Text("Query", tableName: "ActivitiesCode", comment: "Label of an explored SQL editor")
        } else {
          Text(
            "Your query", tableName: "ActivitiesCode", comment: "Label of the learner's SQL editor")
        }
      }
      .font(.subheadline.weight(.medium))
      .accessibilityHidden(true)

      TextField(
        context.phase == .explore
          ? LocalizedStringResource(
            "Query", table: "ActivitiesCode", comment: "Label of an explored SQL editor")
          : LocalizedStringResource(
            "Your query", table: "ActivitiesCode", comment: "Label of the learner's SQL editor"),
        text: $query, selection: $selection, prompt: Text(verbatim: "SELECT"), axis: .vertical
      )
      .lineLimit(3...)
      .font(.body.monospaced())
      .textFieldStyle(.roundedBorder)
      .textInputAutocapitalization(.never)
      .autocorrectionDisabled()
      .keyboardType(.asciiCapable)
      .toolbar {
        // Above the keyboard, where they're needed: a phone keyboard then only types values.
        ToolbarItem(placement: .keyboard) {
          snippets
        }
      }

      CodeRunBar(
        runtimeName: "SQLite", status: .ready, hasRun: queryRun != nil, isRunning: activeRun != nil,
        canRun: !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, run: runQuery,
        retry: {})
    }
  }

  private var snippets: some View {
    ScrollView(.horizontal) {
      HStack(spacing: 6) {
        ForEach(fields.snippets, id: \.self) { snippet in
          Button {
            insert(snippet)
          } label: {
            Text(verbatim: snippet.trimmingCharacters(in: .whitespaces))
              .font(.footnote.monospaced())
          }
          .buttonStyle(.bordered)
        }
      }
    }
    .scrollIndicators(.hidden)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "SQL words, tables and columns", tableName: "ActivitiesCode",
        comment: "VoiceOver: buttons that type SQL"))
  }

  @ViewBuilder
  private func resultView(_ result: SQLResult) -> some View {
    let marks: [SQLRowsTable.Mark]? =
      isChecked
      ? compare(result.rows, with: fields.expected.rows).map { $0 ? .plain : .extra } : nil

    VStack(alignment: .leading, spacing: 6) {
      Group {
        if result.columns.isEmpty {
          Text(
            "The query ran but didn't return a table. Use SELECT to get rows.",
            tableName: "ActivitiesCode",
            comment: "A SQL statement that returned no table")
        } else if result.rows.isEmpty {
          Text(
            "Your result has no rows", tableName: "ActivitiesCode",
            comment: "A query returned no rows")
        } else {
          Text(
            "Your result: \(result.rows.count) rows", tableName: "ActivitiesCode",
            comment: "How many rows a query returned")
        }
      }
      .font(.subheadline.weight(.medium))

      if !result.columns.isEmpty {
        SQLRowsTable(
          caption: Text(
            "Your result", tableName: "ActivitiesCode",
            comment: "VoiceOver: the rows a query returned"),
          columns: result.columns, rows: result.rows, marks: marks)
      }
    }
    .opacity(isStale ? 0.6 : 1)

    if isStale {
      ActivityCaption(
        Text(
          "You changed the query. Run it again to see the new result.", tableName: "ActivitiesCode",
          comment: "Under the result of a query the learner edited since running it"))
    }
  }

  @ViewBuilder
  private var review: some View {
    if !isCorrect {
      let expected = fields.expected

      VStack(alignment: .leading, spacing: 6) {
        Group {
          if expected.orderMatters {
            Text(
              "Expected result, in this order", tableName: "ActivitiesCode",
              comment: "Rows a query should return, in order")
          } else {
            Text(
              "Expected result", tableName: "ActivitiesCode", comment: "Rows a query should return")
          }
        }
        .font(.subheadline.weight(.medium))

        SQLRowsTable(
          caption: Text(
            "Expected result", tableName: "ActivitiesCode", comment: "Rows a query should return"),
          columns: expected.columns, rows: expected.rows,
          marks: compare(expected.rows, with: result?.rows ?? []).map { $0 ? .plain : .missing })
      }

      if !fields.mistakes.isEmpty {
        ActivityReasonList(
          reasons: fields.mistakes.map {
            .init(id: $0.mistake, text: "**\($0.mistake)**", why: $0.feedback)
          })
      }
    }

    if let verifiedSolution {
      VStack(alignment: .leading, spacing: 6) {
        Text(
          "A query that works", tableName: "ActivitiesCode",
          comment: "The lesson's own query, after the check"
        )
        .font(.subheadline.weight(.medium))

        GroupBox {
          Text(CodeHighlight.text(of: verifiedSolution, language: .sql))
            .font(.subheadline.monospaced())
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
  }

  /// Mirrors main's `compareRows`: row by row in order when order matters, as a set otherwise.
  private func compare(_ rows: [[JSONValue]], with other: [[JSONValue]]) -> [Bool] {
    rows.enumerated().map { index, row in
      fields.expected.orderMatters
        ? other.indices.contains(index) && other[index] == row : other.contains(row)
    }
  }

  private func errorMessage(_ run: SQLRun) -> Text? {
    switch run {
    case .done: nil
    case .error(let message): Text(verbatim: message)
    case .timeout:
      Text(
        "The query took more than \(CodeSQLRunner.timeLimitSeconds) seconds and was stopped.",
        tableName: "ActivitiesCode", comment: "A SQL query ran out of time")
    case .tooManyRows:
      Text(
        "The query returned too many rows. Add a filter or LIMIT and try again.",
        tableName: "ActivitiesCode",
        comment: "A SQL query returned more rows than the app shows; LIMIT is a SQL keyword")
    }
  }

  private func insert(_ snippet: String) {
    var range = query.endIndex..<query.endIndex
    if case .selection(let selected) = selection?.indices, selected.upperBound <= query.endIndex {
      range = selected
    }

    let start = query.distance(from: query.startIndex, to: range.lowerBound)
    let selected = query[range]
    query.replaceSubrange(range, with: snippet + selected)
    selection = TextSelection(
      insertionPoint: query.index(
        query.startIndex, offsetBy: start + snippet.count + selected.count))
  }

  private func runQuery() {
    guard !isChecked, activeRun == nil,
      !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    else {
      return
    }

    let id = UUID()
    let started = revision
    let sql = query
    let tables = fields.tables
    activeRun = id

    Task {
      let run = await Task.detached { CodeSQLRunner.run(query: sql, tables: tables) }.value

      guard activeRun == id else {
        return
      }

      activeRun = nil
      queryRun = run
      isStale = revision != started
      context.setAnswer(
        isStale ? nil : { if case .done(let result) = run { .rows(result) } else { nil } }())
    }
  }
}

private struct SQLTableViewer: View {
  let table: SQLPlaygroundFields.Table

  @State private var isExpanded: Bool

  init(table: SQLPlaygroundFields.Table) {
    self.table = table
    _isExpanded = State(initialValue: table.rows.count <= 6)
  }

  var body: some View {
    GroupBox {
      DisclosureGroup(isExpanded: $isExpanded) {
        SQLRowsTable(
          caption: Text(
            "Table \(table.name)", tableName: "ActivitiesCode",
            comment: "VoiceOver: one of a lesson's SQL tables"),
          columns: table.columns.map(\.name), rows: table.rows
        )
        .padding(.top, 8)
      } label: {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
          Image(systemName: "tablecells")
            .foregroundStyle(.secondary)

          Text(verbatim: table.name)
            .font(.subheadline.monospaced().weight(.semibold))

          Text(verbatim: table.columns.map(\.name).joined(separator: ", "))
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)

          Text(
            "\(table.rows.count) rows", tableName: "ActivitiesCode",
            comment: "How many rows a SQL table has"
          )
          .font(.caption)
          .foregroundStyle(.secondary)
        }
      }
    }
  }
}

private struct SQLRowsTable: View {
  enum Mark {
    case plain, extra, missing
  }

  let caption: Text
  let columns: [String]
  let rows: [[JSONValue]]
  var marks: [Mark]?

  var body: some View {
    ScrollView(.horizontal) {
      grid
        .overlay {
          RoundedRectangle(cornerRadius: 10).strokeBorder(.separator)
        }
        .clipShape(.rect(cornerRadius: 10))
    }
    .scrollBounceBehavior(.basedOnSize)
    .accessibilityElement(children: .contain)
    .accessibilityLabel(caption)
  }

  private var grid: some View {
    Grid(alignment: .leading, horizontalSpacing: 0, verticalSpacing: 0) {
      GridRow {
        ForEach(Array(columns.enumerated()), id: \.offset) { _, column in
          Text(verbatim: column)
            .fixedSize()
            .font(.caption.monospaced())
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
      .background(Color(.tertiarySystemFill))
      .accessibilityHidden(true)

      ForEach(Array(rows.enumerated()), id: \.offset) { index, row in
        let mark = marks.flatMap { $0.indices.contains(index) ? $0[index] : nil } ?? .plain

        Divider()

        GridRow {
          ForEach(Array(row.enumerated()), id: \.offset) { _, value in
            SQLCell(value: value)
              .fixedSize()
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .frame(maxWidth: .infinity, alignment: value.isNumber ? .trailing : .leading)
          }
        }
        .background(markColor(mark))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(rowLabel(row, mark: mark))
      }
    }
    .font(.subheadline)
  }

  private func markColor(_ mark: Mark) -> Color {
    switch mark {
    case .plain: .clear
    case .extra: Color.destructive.opacity(0.2)
    case .missing: Color.success.opacity(0.2)
    }
  }

  private func rowLabel(_ row: [JSONValue], mark: Mark) -> Text {
    let cells = zip(columns, row).map { "\($0): \(SQLCell.text($1))" }.joined(separator: ", ")

    switch mark {
    case .plain:
      return Text(verbatim: cells)
    case .extra:
      return Text(
        "\(cells), not expected", tableName: "ActivitiesCode",
        comment: "VoiceOver: a result row the answer shouldn't have")
    case .missing:
      return Text(
        "\(cells), missing from your result", tableName: "ActivitiesCode",
        comment: "VoiceOver: an expected row the learner's result doesn't have")
    }
  }
}

/// A cell as a query result prints it: numbers without grouping, NULL in SQL's own word.
private struct SQLCell: View {
  let value: JSONValue

  static func text(_ value: JSONValue) -> String {
    switch value {
    case .number(let number): ActivityNumberFormat.format(number, grouping: false)
    case .string(let text): text
    default: "NULL"
    }
  }

  var body: some View {
    if value == .null {
      Text(verbatim: "NULL")
        .italic()
        .foregroundStyle(.secondary)
    } else {
      Text(verbatim: Self.text(value))
        .monospacedDigit()
    }
  }
}

extension JSONValue {
  fileprivate var isNumber: Bool {
    if case .number = self { true } else { false }
  }
}
