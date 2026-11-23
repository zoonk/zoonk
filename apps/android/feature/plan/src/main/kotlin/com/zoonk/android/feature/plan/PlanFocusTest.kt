package com.zoonk.android.feature.plan

import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.bleed
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.format.formatMomentDay
import com.zoonk.api.models.FocusTestOffer
import com.zoonk.api.models.FocusTestSessionQuestions
import com.zoonk.api.models.FocusTestSummary
import com.zoonk.api.models.LanguageLevelTestOneOfResultRangesValue
import com.zoonk.api.models.Plan
import com.zoonk.api.models.PlanPlacementTest
import com.zoonk.api.models.PlanPlacementTestOneOf
import com.zoonk.api.models.PlanPlacementTestOneOf1

/** The test's first sitting, for a learner who hasn't started it and whose time doesn't cover everything: where a focus would help most. */
fun focusTestOffer(plan: Plan): FocusTestOffer? =
    plan.focusTest
        ?.takeIf { it.state == FocusTestSummary.State.NOT_STARTED && planCoverage(plan) != null }
        ?.offer

/** The test's one line on the plan: what it's for and what it costs, what's left, or where its result is. */
@Composable
internal fun focusTestLine(summary: FocusTestSummary): String {
    val minutes = summary.offer?.minutes?.let { formatMinutes(it.toInt(), currentLocale()) }
    return when (summary.state) {
        FocusTestSummary.State.NOT_STARTED -> {
            factsLine(
                stringResource(if (summary.suggestsFocus) R.string.focustest_find_focus else R.string.focustest_find_start),
                minutes,
            )
        }

        FocusTestSummary.State.SITTING -> {
            factsLine(stringResource(R.string.focustest_in_progress), minutes?.let { stringResource(R.string.focustest_time_left, it) })
        }

        FocusTestSummary.State.CHECKED -> {
            stringResource(
                if (summary.sessionQuestions == FocusTestSessionQuestions.PAUSED) {
                    R.string.focustest_paused_in_sessions
                } else {
                    R.string.focustest_see_your_result
                },
            )
        }
    }
}

/** The Focus test's place on the plan: its name and one line; what it can do is on the screen it opens. */
@Composable
internal fun PlanFocusTestRow(
    summary: FocusTestSummary,
    onOpen: () -> Unit,
) {
    ListRow(
        headline = { Text(stringResource(R.string.focustest_title)) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = onOpen,
        supporting = { Text(focusTestLine(summary)) },
    )
}

/** "B1–B2": the levels a skill's answers place it between, never one level it can't promise. */
@Composable
fun levelRange(range: LanguageLevelTestOneOfResultRangesValue): String =
    if (range.low.value ==
        range.high.value
    ) {
        range.low.value
    } else {
        stringResource(R.string.placementtest_level_range, range.low.value, range.high.value)
    }

/** A language test's ranges, reading then listening, each named by its skill. */
@Composable
fun levelRangeFacts(ranges: Map<String, LanguageLevelTestOneOfResultRangesValue>): List<String> =
    listOfNotNull(
        ranges[READING]?.let { stringResource(R.string.placementtest_reading_range, levelRange(it)) },
        ranges[LISTENING]?.let { stringResource(R.string.placementtest_listening_range, levelRange(it)) },
    )

@Composable
fun lessonsSkippedLine(lessons: Int): String =
    if (lessons == 0) {
        stringResource(R.string.placementtest_no_lessons_skipped)
    } else {
        pluralStringResource(R.plurals.placementtest_lessons_skipped, lessons, lessons)
    }

/** The test's one line on the plan: what it's for, what's left, or its last result and when. */
@Composable
private fun placementTestLine(test: PlanPlacementTest): String {
    val locale = currentLocale()
    val (state, minutes, finishedAt) =
        when (test) {
            is PlanPlacementTest.PlanPlacementTestOneOfValue -> {
                Triple(
                    test.value.state.value,
                    test.value.estimatedMinutes,
                    test.value.result?.finishedAt,
                )
            }

            is PlanPlacementTest.PlanPlacementTestOneOf1Value -> {
                Triple(
                    test.value.state.value,
                    test.value.estimatedMinutes,
                    test.value.result?.finishedAt,
                )
            }
        }
    if (state == CONTINUE) {
        return factsLine(
            stringResource(R.string.placementtest_in_progress),
            stringResource(R.string.placementtest_time_left, formatMinutes(minutes.toInt(), locale)),
        )
    }
    if (test !is PlanPlacementTest.PlanPlacementTestOneOfValue) {
        return stringResource(R.string.placementtest_find_level)
    }
    finishedAt ?: return stringResource(R.string.placementtest_skip_lessons)
    return factsLine(
        lessonsSkippedLine(
            test.value.result
                ?.lessonsSkipped
                ?.toInt() ?: 0,
        ),
        formatMomentDay(finishedAt, locale),
    )
}

val PlanPlacementTest.isLanguage: Boolean get() = this is PlanPlacementTest.PlanPlacementTestOneOf1Value

/** A language course's test starts with its level; only a whole-course test past it walks the course's topics. */
val PlanPlacementTest.opensLevelTest: Boolean
    get() = this is PlanPlacementTest.PlanPlacementTestOneOf1Value && value.attempt == null

/** A test there's nothing left to check with has no row, as main hides it. */
fun PlanPlacementTest.isShown(): Boolean =
    when (this) {
        is PlanPlacementTest.PlanPlacementTestOneOfValue -> {
            value.state != PlanPlacementTestOneOf.State.START || value.estimatedMinutes > 0
        }

        is PlanPlacementTest.PlanPlacementTestOneOf1Value -> {
            value.state != PlanPlacementTestOneOf1.State.START ||
                value.estimatedMinutes > 0
        }
    }

/** Main's `PlanPlacementTest`: the plan's way into the test of what the learner already knows, the same piece as the Focus test's. */
@Composable
internal fun PlanPlacementTestRow(
    test: PlanPlacementTest,
    onOpen: () -> Unit,
) {
    ListRow(
        headline = { Text(stringResource(if (test.isLanguage) R.string.placementtest_level_title else R.string.placementtest_title)) },
        modifier = Modifier.bleed(LIST_ITEM_INSET),
        onClick = onOpen,
        supporting = { Text(placementTestLine(test)) },
    )
}

private const val CONTINUE = "continue"
private const val READING = "reading"
private const val LISTENING = "listening"
