package com.zoonk.android.feature.activities.code

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityCanvasLabel
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityReason
import com.zoonk.android.feature.activities.ActivityReasons
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.interaction
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.fractionDigitsFor
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.ActivityExpectedRows
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf18Value as SqlPlaygroundContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf18Fields as SqlFields

val sqlPlaygroundRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_code_badge_query_data, R.drawable.ic_database) },
        canvas = { SqlPlaygroundActivity(it) },
        showsData = { true },
    )

private const val SQLITE = "SQLite"

/** SQL's own word, never translated. */
private const val NULL_TEXT = "NULL"

private const val OPEN_ROW_LIMIT = 6

private enum class RowState { Plain, Extra, Missing }

@Composable
private fun SqlPlaygroundActivity(props: ActivityProps) {
    val fields = (props.content as SqlPlaygroundContent).value.fields
    val sandbox = LocalCodeSandbox.current
    val runtime = rememberSandboxRuntime(sandbox, CodeLanguage.Sql)
    val editorRun = rememberEditorRun()
    val scope = rememberCoroutineScope()
    val onAnswerChange by rememberUpdatedState(props.onAnswerChange)
    val focus = remember { FocusRequester() }
    var query by rememberSaveable(stateSaver = TextFieldValue.Saver) { mutableStateOf(TextFieldValue()) }
    var run by remember { mutableStateOf<QueryRun?>(props.answer.rows?.let(QueryRun::Done)) }
    val expected = (props.expected.interaction as? ActivityExpectedAnswer.RowsWrapper)?.value
    val result = (run as? QueryRun.Done)?.result

    fun runQuery() {
        if (props.isLocked || query.text.jsTrim().isEmpty()) return
        val revision = editorRun.start() ?: return
        val text = query.text
        scope.launch {
            val next = sandbox.runQuery(text, fields.tables)
            val current = editorRun.finish(revision)
            run = next
            onAnswerChange(if (next is QueryRun.Done && current) rowsAnswer(next.result) else null)
        }
    }

    fun change(next: TextFieldValue) {
        val edited = next.text != query.text
        query = next
        if (edited) {
            editorRun.edit()
            onAnswerChange(null)
        }
    }

    ActivityCanvas {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { fields.tables.forEach { SqlTableViewer(it) } }

        if (!props.isChecked) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                val label = stringResource(R.string.activities_code_your_query)
                Text(label, style = MaterialTheme.typography.titleSmall)
                CodeEditor(
                    value = query,
                    onValueChange = ::change,
                    language = CodeLanguage.Sql,
                    label = label,
                    placeholder = "SELECT",
                    focusRequester = focus,
                    onSubmit = ::runQuery,
                    readOnly = props.isLocked,
                )
                SnippetBar(
                    snippets = sqlSnippets(fields.tables),
                    label = stringResource(R.string.activities_code_sql_words),
                    enabled = !props.isLocked,
                ) { snippet ->
                    change(query.inserting(snippet))
                    focus.requestFocus()
                }
                SandboxRunBar(SQLITE, runtime, hasRun = run != null, isRunning = editorRun.isRunning, onRun = ::runQuery)
            }
        }

        val failure = run.takeUnless { it is QueryRun.Done || editorRun.isStale }
        if (failure != null) {
            Text(
                when (failure) {
                    is QueryRun.Error -> {
                        failure.message
                    }

                    QueryRun.Timeout -> {
                        val seconds = CodeLanguage.Sql.timeLimitSeconds
                        pluralStringResource(R.plurals.activities_code_query_timeout, seconds, seconds)
                    }

                    else -> {
                        stringResource(R.string.activities_code_runtime_failed, SQLITE)
                    }
                },
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium.copy(fontFamily = FontFamily.Monospace),
            )
        }

        if (result != null) SqlResult(result, expected.takeIf { props.isChecked }, editorRun.isStale)
        if (props.isChecked && expected != null) SqlReview(fields, expected, props.isCorrect == true, result)
    }
}

/** Main's `SqlTableViewer`: a table to query, open at first when it's short. */
@Composable
private fun SqlTableViewer(table: SqlTable) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    var open by rememberSaveable(table.name) { mutableStateOf(table.rows.size <= OPEN_ROW_LIMIT) }
    val state = stringResource(if (open) R.string.activities_code_table_expanded else R.string.activities_code_table_collapsed)
    val mono = FontFamily.Monospace

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outlineVariant, shape),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button) { open = !open }
                .semantics { stateDescription = state }
                .padding(horizontal = 14.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(painterResource(R.drawable.ic_table), null, Modifier.size(16.dp), tint = colors.onSurfaceVariant)
            Text(table.name, style = MaterialTheme.typography.bodyMedium.copy(fontFamily = mono, fontWeight = FontWeight.SemiBold))
            Text(
                table.columns.joinToString(", ") { it.name },
                Modifier.weight(1f),
                color = colors.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.labelSmall.copy(fontFamily = mono),
            )
            Text(
                pluralStringResource(R.plurals.activities_code_table_rows, table.rows.size, table.rows.size),
                color = colors.onSurfaceVariant,
                style = MaterialTheme.typography.labelSmall,
            )
            Icon(
                painterResource(if (open) R.drawable.ic_expand_less else R.drawable.ic_expand_more),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = colors.onSurfaceVariant,
            )
        }
        if (open) {
            SqlRowsTable(
                caption = stringResource(R.string.activities_code_table_named, table.name),
                columns = table.columns.map { it.name },
                rows = table.rows.map { row -> row.map { it.primitive() } },
                modifier = Modifier.padding(start = 8.dp, end = 8.dp, bottom = 8.dp),
            )
        }
    }
}

@Composable
private fun cellText(cell: JsonPrimitive): String =
    when {
        cell is JsonNull -> NULL_TEXT
        cell.isString -> cell.content
        else -> cell.doubleOrNull?.let { formatNumber(it, currentLocale(), fractionDigitsFor(it), grouping = false) } ?: cell.content
    }

/** Main's `SqlRowsTable`: columns as wide as their widest cell, scrolling sideways when the table is wider than the screen. */
@Composable
private fun SqlRowsTable(
    caption: String,
    columns: List<String>,
    rows: SqlRows,
    modifier: Modifier = Modifier,
    rowStates: List<RowState>? = null,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(12.dp)
    val body = MaterialTheme.typography.bodyMedium
    val header = MaterialTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace)
    val texts = rows.map { row -> row.map { cellText(it) } }
    val measurer = rememberTextMeasurer()
    val density = LocalDensity.current
    val widths =
        columns.indices.map { column ->
            val widest =
                texts
                    .maxOfOrNull { measurer.measure(it.getOrElse(column) { "" }, body).size.width }
                    ?.coerceAtLeast(measurer.measure(columns[column], header).size.width)
                    ?: measurer.measure(columns[column], header).size.width
            with(density) { widest.toDp() } + CELL_PADDING * 2
        }
    val extra = stringResource(R.string.activities_code_row_extra)
    val missing = stringResource(R.string.activities_code_row_missing)

    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.surface)
            .border(1.dp, colors.outlineVariant, shape)
            .semantics { contentDescription = caption }
            .horizontalScroll(rememberScrollState()),
    ) {
        Row(Modifier.background(colors.surfaceContainer)) {
            columns.forEachIndexed { index, name ->
                Text(
                    name,
                    Modifier.width(widths[index]).padding(horizontal = CELL_PADDING, vertical = 6.dp),
                    color = colors.onSurfaceVariant,
                    style = header,
                )
            }
        }
        rows.forEachIndexed { index, row ->
            val state = rowStates?.getOrNull(index) ?: RowState.Plain
            HorizontalDivider(Modifier.width(widths.fold(0.dp) { sum, width -> sum + width }), color = colors.outlineVariant)
            Row(
                Modifier
                    .background(
                        when (state) {
                            RowState.Extra -> colors.error.copy(alpha = SOFT_ALPHA)
                            RowState.Missing -> colors.tertiary.copy(alpha = SOFT_ALPHA)
                            RowState.Plain -> colors.surface
                        },
                    ).semantics(mergeDescendants = true) {
                        when (state) {
                            RowState.Extra -> stateDescription = extra
                            RowState.Missing -> stateDescription = missing
                            RowState.Plain -> Unit
                        }
                    },
            ) {
                row.forEachIndexed { column, cell ->
                    val isNumber = cell !is JsonNull && !cell.isString
                    Text(
                        texts[index].getOrElse(column) { "" },
                        Modifier.width(widths.getOrElse(column) { CELL_PADDING * 2 }).padding(horizontal = CELL_PADDING, vertical = 8.dp),
                        color = if (cell is JsonNull) colors.onSurfaceVariant else colors.onSurface,
                        textAlign = if (isNumber) TextAlign.End else TextAlign.Start,
                        softWrap = false,
                        style = body.copy(fontStyle = if (cell is JsonNull) FontStyle.Italic else FontStyle.Normal),
                    )
                }
            }
        }
    }
}

/** Main's `SqlResult`: the learner's rows, marked against the expected ones once checked. */
@Composable
private fun SqlResult(
    result: QueryResult,
    expected: ActivityExpectedRows?,
    isStale: Boolean,
) {
    val states =
        expected?.let {
            compareRows(result.rows, it.rows.map { row -> row.map { cell -> cell.primitive() } }, it.orderMatters)
                .actualMatched
                .map { matched -> if (matched) RowState.Plain else RowState.Extra }
        }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Column(Modifier.alpha(if (isStale) STALE_ALPHA else 1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            ActivityCanvasLabel(
                if (result.columns.isEmpty()) {
                    stringResource(R.string.activities_code_no_table)
                } else if (result.rows.isEmpty()) {
                    stringResource(R.string.activities_code_result_no_rows)
                } else {
                    pluralStringResource(R.plurals.activities_code_your_result_rows, result.rows.size, result.rows.size)
                },
                Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            )
            if (result.columns.isNotEmpty()) {
                SqlRowsTable(stringResource(R.string.activities_code_your_result), result.columns, result.rows, rowStates = states)
            }
        }
        if (isStale) {
            Text(
                stringResource(R.string.activities_code_changed_query),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

/** Main's `SqlReview`: the expected rows and likely mistakes after a miss, and a query that works. */
@Composable
private fun SqlReview(
    fields: SqlFields,
    expected: ActivityExpectedRows,
    isCorrect: Boolean,
    result: QueryResult?,
) {
    val sandbox = LocalCodeSandbox.current
    val expectedRows = expected.rows.map { row -> row.map { it.primitive() } }
    var solution by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(fields.solution) {
        val run = sandbox.runQuery(fields.solution, fields.tables)
        val works = run is QueryRun.Done && returnsRows(run.result, expected.columns, expectedRows, expected.orderMatters)
        if (works) solution = fields.solution
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (!isCorrect) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val inOrder = stringResource(R.string.activities_code_expected_result_in_order)
                ActivityCanvasLabel(if (expected.orderMatters) inOrder else stringResource(R.string.activities_code_expected_result))
                val found = compareRows(result?.rows.orEmpty(), expectedRows, expected.orderMatters).expectedFound
                SqlRowsTable(
                    stringResource(R.string.activities_code_expected_result),
                    expected.columns,
                    expectedRows,
                    rowStates = found.map { if (it) RowState.Plain else RowState.Missing },
                )
            }
            if (fields.mistakes.isNotEmpty()) {
                ActivityReasons {
                    fields.mistakes.forEach { item ->
                        ActivityReason(item.feedback) {
                            RichText(item.mistake, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
                        }
                    }
                }
            }
        }
        solution?.let {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val label = stringResource(R.string.activities_code_query_that_works)
                ActivityCanvasLabel(label)
                val shape = RoundedCornerShape(12.dp)
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(shape)
                        .background(MaterialTheme.colorScheme.surface)
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    CodeListing(it, CodeLanguage.Sql, label)
                }
            }
        }
    }
}

private val CELL_PADDING = 14.dp
