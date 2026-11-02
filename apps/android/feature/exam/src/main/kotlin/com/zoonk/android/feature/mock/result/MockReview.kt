package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.recode
import com.zoonk.android.feature.feedback.FeedbackTarget
import com.zoonk.android.feature.feedback.ReportProblemMenu
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
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.TagBesideOrUnder
import com.zoonk.android.ui.components.answerTone
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.FeedbackSubmissionContext
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockExamReviewInner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Where the learner is in the questions to review. A phone reads them in a sheet and an open book on
 * the page after the fold, and folding recreates the screen, so the screen saves whether the learner
 * is in them and the question at the top of what they read. Both are noted as the learner scrolls,
 * since the screen lays out again without its fold before it's saved. Each list that shows them
 * brings that question back to its top once.
 */
@Stable
internal class ReviewPlace(
    open: Boolean,
    private var anchor: Int?,
) {
    /** Whether the learner is in the questions, which a phone shows in the sheet. */
    var open by mutableStateOf(open)
        private set
    private var section: LayoutCoordinates? = null
    private val entries = HashMap<Int, LayoutCoordinates>()
    private var list: LayoutCoordinates? = null
    private var listAt: Offset? = null
    private var restoresRunning = 0

    fun openSheet() {
        open = true
        anchor = null
    }

    fun closeSheet() {
        open = false
        anchor = null
    }

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

    fun sectionPlaced(coordinates: LayoutCoordinates) {
        section = coordinates
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

        val top = entries.filterValues { it.isAttached && it.boundsInWindow().height > 0f }.keys.minOrNull()
        val inline = section?.takeIf { it.isAttached }
        when {
            inline == null -> {
                anchor = top ?: anchor
            }

            top == null -> {
                open = false
                anchor = null
            }

            // On the page, the learner reads the questions once their title has scrolled away.
            inline.boundsInWindow().top > inline.positionInWindow().y -> {
                open = true
                anchor = top
            }

            // With their title in view, they're as far in as they were, at the question in view.
            else -> {
                anchor = top
            }
        }
    }

    companion object {
        val Saver =
            Saver<ReviewPlace, IntArray>(
                save = { intArrayOf(if (it.open) 1 else 0, it.anchor ?: -1) },
                restore = { ReviewPlace(open = it[0] == 1, anchor = it[1].takeIf { at -> at >= 0 }) },
            )
    }
}

@Composable
internal fun rememberReviewPlace(): ReviewPlace = rememberSaveable(saver = ReviewPlace.Saver) { ReviewPlace(open = false, anchor = null) }

@Composable
internal fun ReviewSection(
    view: MockExam,
    app: AppContainer,
    place: ReviewPlace,
) {
    if (view.review.isEmpty()) return
    Box(
        Modifier.onPlaced(place::sectionPlaced),
    ) { ResultSection(stringResource(R.string.mock_result_review)) { ReviewList(view, app, place) } }
}

/** Main's `MockReviewDrawer`: the same questions in a sheet, where the score step stays short on a phone. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ReviewSheet(
    view: MockExam,
    app: AppContainer,
    place: ReviewPlace,
) {
    ModalBottomSheet(onDismissRequest = place::closeSheet, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        // The title stays while a long review scrolls under it.
        Column(Modifier.padding(horizontal = 24.dp).navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.mock_result_review), Modifier.semantics { heading() }, style = MaterialTheme.typography.titleLarge)
            val scroll = rememberScrollState()
            Column(Modifier.weight(1f, fill = false).verticalScroll(scroll)) { ReviewList(view, app, place, scroll) }
        }
    }
}

@Composable
private fun ReviewList(
    view: MockExam,
    app: AppContainer,
    place: ReviewPlace,
    sheetScroll: ScrollState? = null,
) {
    val words = view.trueFalseWords
    val scope = rememberCoroutineScope()
    val requesters = remember(view.review.size) { List(view.review.size) { BringIntoViewRequester() } }
    val restore = remember { Restore(place.restoring()) }

    Column(Modifier.onGloballyPositioned(place::listMoved)) {
        view.review.forEachIndexed { index, entry ->
            if (index > 0) HorizontalDivider()
            val continued =
                entry.set != null && view.review
                    .getOrNull(index - 1)
                    ?.set
                    ?.id == entry.set?.id
            ReviewEntry(
                entry,
                continued,
                numbered = view.scoring != MockExam.Scoring.NET,
                words,
                app,
                Modifier.bringIntoViewRequester(requesters[index]).onPlaced { coordinates ->
                    place.entryPlaced(index, coordinates)
                    if (restore.at == index && !restore.done) {
                        restore.done = true
                        place.restore(scope) {
                            if (sheetScroll != null) {
                                // The sheet first lays out taller than the window as it slides up, so it scrolls to the question itself.
                                sheetScroll.scrollTo(coordinates.positionInParent().y.roundToInt())
                            } else {
                                // Asked to show a rect as tall as the window, whatever scrolls the page brings the question's top to its own.
                                val window = coordinates.findRootCoordinates().size
                                requesters[index].bringIntoView(Rect(0f, 0f, coordinates.size.width.toFloat(), window.height.toFloat()))
                            }
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

@Composable
private fun ReviewEntry(
    entry: MockExamReviewInner,
    continued: Boolean,
    numbered: Boolean,
    words: TrueFalseWords,
    app: AppContainer,
    modifier: Modifier,
) {
    val number = entry.number.toInt()
    val muted = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurfaceVariant)

    Column(modifier.padding(vertical = 20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                entry.area?.let { stringResource(R.string.mock_result_question_area, number, it) }
                    ?: stringResource(R.string.mock_result_question, number),
                Modifier.weight(1f),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.labelMedium.withTabularFigures(),
            )
            ReportProblemMenu(app, FeedbackTarget("mock-review", FeedbackSubmissionContext.ContentKind.ITEM, entry.itemId))
        }
        entry.set?.let { ItemSetText(it.recode<_, ItemSet>(), continued = continued) }
        entry.context?.let { ItemText(it, style = muted) }
        RichText(entry.question, style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium))
        if (entry.outcome ==
            MockExamReviewInner.Outcome.PARTIAL
        ) {
            Text(stringResource(R.string.mock_result_partly_right_note), style = muted)
        }
        ReviewAnswers(entry, numbered, words)
        entry.explanation?.let { ItemText(it, style = MaterialTheme.typography.bodyMedium) }
        entry.citation?.let { ItemCitationNote(it.recode<_, Citation>()) }
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

    if (yours == null) {
        Text(
            stringResource(R.string.mock_result_left_blank),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        yours?.let { ReviewAnswer(it, entry, right = false, numbered, words) }
        right?.let { ReviewAnswer(it, entry, right = true, numbered, words) }
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
    right: Boolean,
    numbered: Boolean,
    words: TrueFalseWords,
) {
    val result = if (right) AnswerResult.Right else AnswerResult.Wrong
    val tone = answerTone(picked = !right, result = result)
    val shape = RoundedCornerShape(12.dp)
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
            content = { ItemLine(if (statement) trueFalseLabel(isTrue, words) else answer) },
            tag = { AnswerTag(picked = !right, result = result) },
        )
    }
}
