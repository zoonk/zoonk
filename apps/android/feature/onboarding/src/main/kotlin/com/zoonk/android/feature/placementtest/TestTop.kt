package com.zoonk.android.feature.placementtest

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.TestContext
import com.zoonk.android.feature.onboarding.setup.SETUP_COLUMN_WIDTH
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TaskSegment
import com.zoonk.android.ui.components.TaskSegments
import com.zoonk.android.ui.scaffold.pageMargin
import com.zoonk.android.ui.scaffold.pagePadding

/**
 * A test open on screen, which is a task: its wait and its result keep ✕ alone, and a question ([asking]) names what it
 * tests in the bar, over one segment a question.
 */
internal data class Sitting(
    val asking: Asking? = null,
)

/**
 * A question's top: [title] is what it tests (a chapter, "Reading", a subject), [answered] of [total] its place, and
 * [groups] the runs of questions drawn apart (the language test's reading, listening and check). [left] is what ✕
 * says the learner left; [stop] is set while stopping gives a result, so ✕ offers it beside leaving.
 */
internal data class Asking(
    val title: String,
    val answered: Int,
    val total: Int,
    val left: AnalyticsEvent.TestLeft,
    val groups: List<Int> = emptyList(),
    val stop: TestStop? = null,
)

/**
 * "Stop and use my answers" behind ✕, with [hint] over the ways out when stopping is worth suggesting. While an answer
 * saves ([enabled] false) it waits for it, so the sheet never offers a stop the save would swallow.
 */
internal class TestStop(
    val hint: String? = null,
    val enabled: Boolean = true,
    val onStop: () -> Unit,
)

/** A test's question on screen, counting the one shown: a ceiling it can end before, never under what's answered. */
internal fun asking(
    test: TestContext,
    title: String,
    answered: Long,
    total: Long,
    groups: List<Int> = emptyList(),
    stop: TestStop? = null,
) = Sitting(
    Asking(
        title = title,
        answered = answered.toInt(),
        total = maxOf(total, answered + 1).toInt(),
        left = AnalyticsEvent.TestLeft(test, questionNumber = answered + 1),
        groups = groups,
        stop = stop,
    ),
)

/** The bar's title on a question, in the task title's one line. */
@Composable
internal fun TestTitle(sitting: Sitting?) {
    val asking = sitting?.asking ?: return
    Text(asking.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
}

/**
 * One segment a question under the bar, across the question's column: answered ones in the progress blue with no
 * verdict, the current one tinted. TalkBack reads it as "Question 3 of 8".
 */
@Composable
internal fun TestSegments(sitting: Sitting?) {
    val asking = sitting?.asking ?: return
    val segments =
        List(asking.total) { index ->
            when {
                index < asking.answered -> TaskSegment.Done
                index == asking.answered -> TaskSegment.Current
                else -> TaskSegment.Ahead
            }
        }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        TaskSegments(
            segments = segments,
            modifier = Modifier.widthIn(max = SETUP_COLUMN_WIDTH).padding(horizontal = pageMargin()),
            groups = asking.groups,
            contentDescription = stringResource(R.string.onboarding_test_question_progress, asking.answered + 1, asking.total),
            done = asking.answered,
        )
    }
}

/**
 * What ✕ and Back do on a test: open its two ways out while stopping gives a result ([waysOut]), else [leave], which
 * says the learner left a question.
 */
internal fun closeTest(
    sitting: Sitting?,
    waysOut: MutableState<Boolean>,
    leave: () -> Unit,
) {
    if (sitting?.asking?.stop != null) waysOut.value = true else leave()
}

@Composable
internal fun rememberWaysOut(): MutableState<Boolean> = rememberSaveable { mutableStateOf(false) }

/**
 * The sheet behind a test's ✕: "Finish later" leaves with the answers saved, "Stop and use my answers" ends the test
 * with them. Back opens it too while it can stop.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TestWaysOut(
    sitting: Sitting?,
    waysOut: MutableState<Boolean>,
    leave: () -> Unit,
) {
    val asking = sitting?.asking
    val stop = asking?.stop
    BackHandler(enabled = stop != null && !waysOut.value) { waysOut.value = true }
    if (stop == null || !waysOut.value) return

    ModalBottomSheet(onDismissRequest = { waysOut.value = false }) {
        Column(
            Modifier.padding(pagePadding()).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            stop.hint?.let {
                Text(
                    it,
                    modifier = Modifier.padding(bottom = 8.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Button(
                onClick = {
                    waysOut.value = false
                    leave()
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.placementtest_finish_later))
            }
            OutlinedButton(
                onClick = {
                    waysOut.value = false
                    stop.onStop()
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = stop.enabled,
            ) {
                Text(stringResource(R.string.onboarding_placement_stop))
            }
        }
    }
}
