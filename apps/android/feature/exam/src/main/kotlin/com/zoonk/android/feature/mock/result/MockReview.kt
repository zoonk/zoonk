package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.InlineTextContent
import androidx.compose.foundation.text.appendInlineContent
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onPlaced
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.Placeholder
import androidx.compose.ui.text.PlaceholderVerticalAlign
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.recode
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
import com.zoonk.android.feature.mock.runner.UnsureMark
import com.zoonk.android.feature.mock.runner.trueFalseWords
import com.zoonk.android.feature.questions.Citation
import com.zoonk.android.feature.questions.ItemCitationNote
import com.zoonk.android.feature.questions.ItemLine
import com.zoonk.android.feature.questions.ItemSet
import com.zoonk.android.feature.questions.ItemSetText
import com.zoonk.android.feature.questions.ItemText
import com.zoonk.android.feature.questions.TrueFalseWords
import com.zoonk.android.feature.questions.trueFalseLabel
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.AnswerTag
import com.zoonk.android.ui.components.ButtonEdge
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TagBesideOrUnder
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.components.iconButtonEdge
import com.zoonk.android.ui.format.FACT_SEPARATOR
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamReviewInner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Where the learner is in the questions to review. A phone and a tablet read them on the page and an
 * open book on the page after the fold, and folding recreates the screen, so the screen saves the
 * question at the top of what they read. It's noted as the learner scrolls, since the screen lays out
 * again without its fold before it's saved. The list shown next brings that question back to its top once.
 */
@Stable
internal class ReviewPlace(
    private var anchor: Int?,
) {
    private val entries = HashMap<Int, LayoutCoordinates>()
    private var list: LayoutCoordinates? = null
    private var listAt: Offset? = null
    private var restoresRunning = 0

    /** The question a list shown now brings to its top. */
    fun restoring(): Int? = anchor

    /** Brings that question back with [scroll]; where the list passes on the way isn't where the learner is. */
    fun restore(
        scope: CoroutineScope,
        scroll: suspend () -> Unit,
    ) {
        restoresRunning++
        scope.launch { scroll() }.invokeOnCompletion { restoresRunning-- }
    }

    fun entryPlaced(
        index: Int,
        coordinates: LayoutCoordinates,
    ) {
        entries[index] = coordinates
    }

    /** Notes where the learner is once a list they see moves, which a scroll does; a list just placed somewhere new hasn't. */
    fun listMoved(coordinates: LayoutCoordinates) {
        val at = coordinates.positionInWindow()
        val scrolled = coordinates === list && at != listAt
        list = coordinates
        listAt = at
        if (!scrolled || restoresRunning > 0) return

        anchor = entries.filterValues { it.isAttached && it.boundsInWindow().height > 0f }.keys.minOrNull()
    }

    companion object {
        val Saver = Saver<ReviewPlace, Int>(save = { it.anchor ?: -1 }, restore = { ReviewPlace(anchor = it.takeIf { at -> at >= 0 }) })
    }
}

@Composable
internal fun rememberReviewPlace(): ReviewPlace = rememberSaveable(saver = ReviewPlace.Saver) { ReviewPlace(anchor = null) }

/**
 * Main's `MockReview`: every question the learner missed or wasn't sure of as rows of one list, each
 * saying what it asked and which it was. A row opens in place to its passage, the answers and why.
 */
@Composable
internal fun ReviewSection(
    view: MockExam,
    app: AppContainer,
    place: ReviewPlace,
    opened: List<String>,
    onToggle: (String) -> Unit,
) {
    if (view.review.isEmpty()) return
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SectionHeader(stringResource(R.string.mock_result_review), detail = formatNumber(view.review.size.toDouble(), currentLocale()))
        ReviewList(view, app, place, opened, onToggle)
    }
}

@Composable
private fun ReviewList(
    view: MockExam,
    app: AppContainer,
    place: ReviewPlace,
    opened: List<String>,
    onToggle: (String) -> Unit,
) {
    val words = view.trueFalseWords
    val scope = rememberCoroutineScope()
    val requesters = remember(view.review.size) { List(view.review.size) { BringIntoViewRequester() } }
    val restore = remember { Restore(place.restoring()) }

    Column(Modifier.onGloballyPositioned(place::listMoved)) {
        view.review.forEachIndexed { index, entry ->
            if (index > 0) HorizontalDivider()
            val key = "$REVIEW${entry.itemId}"
            ReviewEntry(
                entry,
                open = key in opened,
                onToggle = { onToggle(key) },
                numbered = view.scoring != MockExam.Scoring.NET,
                words,
                app,
                Modifier.bringIntoViewRequester(requesters[index]).onPlaced { coordinates ->
                    place.entryPlaced(index, coordinates)
                    if (restore.at == index && !restore.done) {
                        restore.done = true
                        place.restore(scope) {
                            // Asked to show a rect as tall as the window, whatever scrolls the page brings the question's top to its own.
                            val window = coordinates.findRootCoordinates().size
                            requesters[index].bringIntoView(Rect(0f, 0f, coordinates.size.width.toFloat(), window.height.toFloat()))
                        }
                    }
                },
            )
        }
    }
}

private class Restore(
    val at: Int?,
) {
    var done = false
}

/**
 * The row says which question it is, how it went and, in amber with its bookmark, whether the learner
 * wasn't sure; a wrong answer needs no word, the list is mostly of them.
 */
@Composable
private fun EntryFacts(entry: MockExamReviewInner) {
    val facts =
        factsLine(
            stringResource(R.string.mock_result_question, entry.number.toInt()),
            entry.area,
            when (entry.outcome) {
                MockExamReviewInner.Outcome.BLANK -> stringResource(R.string.mock_result_blank)
                MockExamReviewInner.Outcome.PARTIAL -> stringResource(R.string.mock_result_partly_right)
                MockExamReviewInner.Outcome.RIGHT -> stringResource(R.string.mock_result_right)
                MockExamReviewInner.Outcome.WRONG -> null
            },
        )
    if (!entry.unsure) {
        Text(facts)
        return
    }
    val amber = MaterialTheme.zoonk.warningText
    Text(
        buildAnnotatedString {
            append(facts)
            append(FACT_SEPARATOR)
            withStyle(SpanStyle(color = amber)) {
                appendInlineContent(UNSURE_MARK, " ")
                // A no-break space keeps the bookmark with its words when the line wraps.
                append("\u00A0")
                append(stringResource(R.string.mock_not_sure))
            }
        },
        inlineContent =
            mapOf(
                UNSURE_MARK to
                    InlineTextContent(Placeholder(1.em, 1.em, PlaceholderVerticalAlign.TextCenter)) {
                        UnsureMark(Modifier.fillMaxSize())
                    },
            ),
    )
}

@Composable
private fun ReviewEntry(
    entry: MockExamReviewInner,
    open: Boolean,
    onToggle: () -> Unit,
    numbered: Boolean,
    words: TrueFalseWords,
    app: AppContainer,
    modifier: Modifier,
) {
    val muted = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)

    Column(modifier) {
        ListRow(
            headline = { ItemLine(entry.question) },
            modifier = Modifier.bleed(LIST_ITEM_INSET),
            onClick = onToggle,
            expanded = open,
            supporting = { EntryFacts(entry) },
        )
        if (open) {
            Column(Modifier.padding(top = 4.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // A row opens on its own, so a passage shared with the question before it shows whole.
                entry.set?.let { ItemSetText(it.recode<_, ItemSet>(), continued = false) }
                entry.context?.let { ItemText(it, style = muted) }
                ReviewAnswers(entry, numbered, words)
                entry.explanation?.let { ItemText(it, style = MaterialTheme.typography.bodyMedium) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f)) { entry.citation?.let { ItemCitationNote(it.recode<_, Citation>()) } }
                    Box(Modifier.iconButtonEdge(ButtonEdge.End)) {
                        ReportProblemMenu(app, FeedbackTarget("mock-review", FeedbackSubmissionContext.ContentKind.ITEM, entry.itemId))
                    }
                }
            }
        }
    }
}

@Composable
private fun ReviewAnswers(
    entry: MockExamReviewInner,
    numbered: Boolean,
    words: TrueFalseWords,
) {
    val yours = entry.learnerAnswer
    val right = entry.correctAnswer

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (entry.outcome == MockExamReviewInner.Outcome.RIGHT) {
            // The learner's answer is the right one, so it shows once, as theirs.
            (yours ?: right)?.let { ReviewAnswer(it, entry, AnswerResult.Right, picked = true, numbered, words) }
        } else {
            yours?.let { ReviewAnswer(it, entry, AnswerResult.Wrong, picked = true, numbered, words) }
            right?.let { ReviewAnswer(it, entry, AnswerResult.Right, picked = false, numbered, words) }
        }
    }
}

/**
 * The review has a pick's words but not its number, so a statement's verdict shows its own mark
 * (its number where the runner numbered them) and any other answer shows how it went.
 */
@Composable
private fun ReviewAnswer(
    answer: String,
    entry: MockExamReviewInner,
    result: AnswerResult,
    picked: Boolean,
    numbered: Boolean,
    words: TrueFalseWords,
) {
    val right = result == AnswerResult.Right
    val tone = answerTone(picked = picked, result = result)
    val shape = RoundedCornerShape(ZoonkRadius.option)
    val statement = entry.format == MockExamReviewInner.Format.TRUE_FALSE && (answer == "true" || answer == "false")
    val isTrue = answer == "true"

    Row(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(tone.container)
            .border(tone.border, shape)
            .padding(horizontal = 14.dp, vertical = 14.dp)
            .semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        when {
            statement && numbered -> {
                Text(if (isTrue) "1" else "2", style = MaterialTheme.typography.labelLarge.withTabularFigures())
            }

            else -> {
                val check = if (statement) isTrue else right
                Icon(
                    painterResource(if (check) R.drawable.ic_check else R.drawable.ic_close),
                    contentDescription = null,
                    modifier = Modifier.size(20.dp),
                    tint = if (right) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.error,
                )
            }
        }
        TagBesideOrUnder(
            modifier = Modifier.weight(1f),
            content = {
                when {
                    statement -> ItemLine(trueFalseLabel(isTrue, words))

                    // A typed answer is plain text, so `__init__` keeps its underscores.
                    entry.format == MockExamReviewInner.Format.TYPED -> Text(answer)

                    else -> ItemLine(answer)
                }
            },
            tag = { AnswerTag(picked = picked, result = result) },
        )
    }
}

private const val REVIEW = "review:"
private const val UNSURE_MARK = "unsure"
