package com.zoonk.android.feature.activities.code

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import com.zoonk.api.models.ActivityExpectedRowsRowsInnerInner as ExpectedCell
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf12RowsInnerInner as AnswerCell
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18FieldsExpectedRowsInnerInner as TableCell

typealias SqlRows = List<List<JsonPrimitive>>

internal fun TableCell?.primitive(): JsonPrimitive =
    when (this) {
        null -> JsonNull
        is TableCell.StringValue -> JsonPrimitive(value)
        is TableCell.DoubleValue -> JsonPrimitive(value)
    }

internal fun ExpectedCell?.primitive(): JsonPrimitive =
    when (this) {
        null -> JsonNull
        is ExpectedCell.StringValue -> JsonPrimitive(value)
        is ExpectedCell.DoubleValue -> JsonPrimitive(value)
    }

internal fun AnswerCell?.primitive(): JsonPrimitive =
    when (this) {
        null -> JsonNull
        is AnswerCell.StringValue -> JsonPrimitive(value)
        is AnswerCell.DoubleValue -> JsonPrimitive(value)
    }

internal fun JsonPrimitive.answerCell(): AnswerCell? =
    when {
        this is JsonNull -> null
        isString -> AnswerCell.StringValue(content)
        else -> doubleOrNull?.let(AnswerCell::DoubleValue) ?: AnswerCell.StringValue(content)
    }

/** A cell as `JSON.stringify` tells cells apart: 203 and 203.0 are the same number. */
private fun JsonPrimitive.key(): Any? =
    when {
        this is JsonNull -> null
        isString -> content
        else -> doubleOrNull?.let { if (it == 0.0) 0.0 else it } ?: content
    }

private fun SqlRows.keys() = map { row -> row.map { it.key() } }

data class RowMatch(
    val actualMatched: List<Boolean>,
    val expectedFound: List<Boolean>,
)

/** Main's `compareRows`: which rows of each side the other has, by position when order matters. */
internal fun compareRows(
    actual: SqlRows,
    expected: SqlRows,
    orderMatters: Boolean,
): RowMatch {
    val (actualKeys, expectedKeys) = actual.keys() to expected.keys()
    if (orderMatters) {
        return RowMatch(
            actualMatched = actualKeys.mapIndexed { index, row -> row == expectedKeys.getOrNull(index) },
            expectedFound = expectedKeys.mapIndexed { index, row -> row == actualKeys.getOrNull(index) },
        )
    }
    return RowMatch(actualMatched = actualKeys.map { it in expectedKeys }, expectedFound = expectedKeys.map { it in actualKeys })
}

/** Core's `gradeRows`, to show the reference query only once it returns the expected rows here too. */
internal fun returnsRows(
    result: QueryResult,
    columns: List<String>,
    rows: SqlRows,
    orderMatters: Boolean,
): Boolean {
    val sameColumns = result.columns.map(String::lowercase) == columns.map(String::lowercase)
    val (actualKeys, expectedKeys) = result.rows.keys() to rows.keys()
    val sameRows =
        if (orderMatters) {
            actualKeys == expectedKeys
        } else {
            actualKeys.groupingBy { it }.eachCount() == expectedKeys.groupingBy { it }.eachCount()
        }
    return sameColumns && sameRows
}

private val SQL_KEYWORDS = listOf("SELECT", "FROM", "WHERE", "AND", "OR", "ORDER BY", "DESC", "GROUP BY", "COUNT(*)")

/** Main's `sqlSnippets`: SQL words, then each table and its columns, each label once. */
internal fun sqlSnippets(tables: List<SqlTable>): List<CodeSnippet> =
    (
        SQL_KEYWORDS.map { CodeSnippet(it, it, "$it ") } +
            tables.flatMap { table ->
                listOf(CodeSnippet(table.name, table.name, "${table.name} ")) + table.columns.map { CodeSnippet(it.name, it.name, it.name) }
            }
    ).distinctBy(CodeSnippet::label)
