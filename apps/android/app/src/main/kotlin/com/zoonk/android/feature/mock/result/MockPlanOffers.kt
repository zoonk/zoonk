package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.StepDetail
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.MockAdapt
import com.zoonk.api.models.MockPlanOfferInput.Offer
import com.zoonk.api.models.MockPlanOfferResult
import com.zoonk.api.models.MockResultPreparation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import kotlin.math.roundToLong

sealed interface OfferAnswer {
    data class Outcome(
        val result: MockPlanOfferResult,
    ) : OfferAnswer

    data object Declined : OfferAnswer

    data object Failed : OfferAnswer
}

data class PlanOffers(
    val answers: Map<Offer, OfferAnswer> = emptyMap(),
    val applying: Boolean = false,
)

private val OfferAnswer?.isSettled: Boolean get() = this != null && this != OfferAnswer.Failed

/** Main's `usePlanChange`: the plan changes only on the learner's Apply; Keep my plan changes nothing. */
class MockPlanOffersViewModel(
    private val store: MockRunStore,
    private val blockId: String,
) : ViewModel() {
    private val mutable = MutableStateFlow(PlanOffers())
    val state: StateFlow<PlanOffers> = mutable.asStateFlow()

    /** Applies the offers not settled yet, one after another, as main does. */
    fun apply(offers: List<Offer>) {
        if (mutable.value.applying) return
        val open = offers.filterNot { mutable.value.answers[it].isSettled }
        mutable.update { it.copy(applying = true) }
        viewModelScope.launch {
            val answers =
                buildMap {
                    open.forEach { offer ->
                        when (val result = store.adapt(blockId, offer)) {
                            is MutationResult.Done -> put(offer, OfferAnswer.Outcome(result.value))
                            is MutationResult.Failed -> put(offer, OfferAnswer.Failed)
                            MutationResult.Obsolete -> Unit
                        }
                    }
                }
            mutable.update { it.copy(answers = it.answers + answers, applying = false) }
        }
    }

    fun keep(offers: List<Offer>) {
        mutable.update { state ->
            state.copy(
                answers =
                    state.answers + offers.filterNot { state.answers[it].isSettled }.associateWith { OfferAnswer.Declined },
            )
        }
    }
}

fun planOffers(adapt: MockAdapt?): List<Offer> =
    listOfNotNull(
        Offer.SKIP.takeIf { adapt?.skip != null },
        Offer.FOCUS.takeIf {
            adapt?.focus !=
                null
        },
    )

/** A share the learner would read as unchanged ("41% → 41%") isn't news. */
internal fun MockResultPreparation.hasMoved(): Boolean = (before * PERCENT).roundToLong() != (after * PERCENT).roundToLong()

@Composable
internal fun PlanStep(
    adapt: MockAdapt?,
    preparation: MockResultPreparation?,
    offers: PlanOffers,
    onApply: () -> Unit,
    onKeep: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Eyebrow(stringResource(if (preparation != null) R.string.mock_result_your_preparation else R.string.mock_result_your_plan))
        if (preparation != null) {
            PreparationNumbers(preparation, MaterialTheme.typography.displaySmall)
        } else {
            planChangeTitle(adapt)?.let { StepTitle(it) }
        }
    }
    preparation?.let { PreparationMeter(it) }
    if (adapt != null && planOffers(adapt).isNotEmpty()) PlanChange(adapt, offers, showTitle = preparation != null, onApply, onKeep)
}

@Composable
internal fun PreparationNumbers(
    preparation: MockResultPreparation,
    style: TextStyle,
) {
    val locale = currentLocale()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = muted)) { append("${formatPercent(preparation.before, locale)} → ") }
            append(formatPercent(preparation.after, locale))
        },
        style = style.withTabularFigures().copy(fontWeight = FontWeight.SemiBold),
    )
}

@Composable
internal fun PreparationMeter(preparation: MockResultPreparation) {
    Meter(preparation.after.toFloat(), Modifier.widthIn(max = METER_WIDTH))
    StepDetail(
        stringResource(
            if (preparation.after < preparation.before) R.string.mock_result_preparation_fell else R.string.mock_result_preparation_counts,
        ),
    )
}

@Composable
private fun planChangeTitle(adapt: MockAdapt?): String? {
    val skip = adapt?.skip
    val focus = adapt?.focus
    return when {
        skip != null -> pluralStringResource(R.plurals.mock_result_skip_title, skip.topics.size, skip.topics.size)
        focus != null -> stringResource(R.string.mock_result_focus_title, focus.area)
        else -> null
    }
}

@Composable
internal fun PlanChange(
    adapt: MockAdapt,
    offers: PlanOffers,
    showTitle: Boolean,
    onApply: () -> Unit,
    onKeep: () -> Unit,
) {
    val open = planOffers(adapt).filterNot { offers.answers[it].isSettled }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (showTitle) {
            planChangeTitle(adapt)?.let { Text(it, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium) }
        }
        OfferLines(adapt)
        if (open.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onApply, enabled = !offers.applying) {
                    if (offers.applying) {
                        CircularProgressIndicator(Modifier.size(ButtonDefaults.IconSize), strokeWidth = 2.dp)
                        Text(stringResource(R.string.mock_result_apply), Modifier.padding(start = ButtonDefaults.IconSpacing))
                    } else {
                        Text(stringResource(R.string.mock_result_apply))
                    }
                }
                TextButton(onClick = onKeep, enabled = !offers.applying) { Text(stringResource(R.string.mock_result_keep_plan)) }
            }
        }
        OfferStatus(adapt, offers)
    }
}

/** Main's `PlanChangeStatus`: one line per outcome; a declined offer goes unsaid once another applied. */
@Composable
private fun OfferStatus(
    adapt: MockAdapt,
    offers: PlanOffers,
) {
    val answered = planOffers(adapt).mapNotNull { offer -> offers.answers[offer]?.let { offer to it } }
    val applied = answered.any { (_, answer) -> (answer as? OfferAnswer.Outcome)?.result?.status == MockPlanOfferResult.Status.APPLIED }
    val lines =
        answered
            .filterNot { (_, answer) -> applied && answer == OfferAnswer.Declined }
            .map { (offer, answer) -> answerLine(offer, answer) }
            .distinct()
    if (lines.isEmpty()) return

    Row(
        Modifier.semantics(mergeDescendants = true) {
            liveRegion = LiveRegionMode.Polite
        },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (applied) {
            Icon(
                painterResource(R.drawable.ic_check_circle),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.tertiary,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            lines.forEach { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
        }
    }
}

@Composable
private fun answerLine(
    offer: Offer,
    answer: OfferAnswer,
): String =
    when (answer) {
        OfferAnswer.Declined -> {
            stringResource(R.string.mock_result_plan_stays)
        }

        OfferAnswer.Failed -> {
            stringResource(R.string.mock_result_plan_not_saved)
        }

        is OfferAnswer.Outcome -> {
            val result = answer.result
            when {
                result.status == MockPlanOfferResult.Status.APPLIED && offer == Offer.SKIP -> {
                    val lessons = result.lessonsSkipped.toInt()
                    pluralStringResource(R.plurals.mock_result_skip_done, lessons, lessons)
                }

                result.status == MockPlanOfferResult.Status.APPLIED -> {
                    stringResource(R.string.mock_result_focus_done)
                }

                result.reason == MockPlanOfferResult.Reason.ALREADY_IN -> {
                    stringResource(R.string.mock_result_already_in)
                }

                result.reason == MockPlanOfferResult.Reason.CANT_MOVE -> {
                    stringResource(R.string.mock_result_cant_move)
                }

                else -> {
                    stringResource(R.string.mock_result_already_changed)
                }
            }
        }
    }

private enum class LineKind { Removed, Context, Added }

private data class OfferLine(
    val kind: LineKind,
    val text: String,
)

/** Topics off the plan are good news, so they take the progress blue, as main's `DiffLines` do. */
@Composable
private fun OfferLines(adapt: MockAdapt) {
    val skip = adapt.skip
    val focus = adapt.focus
    val named = skip?.topics.orEmpty().take(TOPICS_NAMED)
    val more = (skip?.topics?.size ?: 0) - named.size
    val lines =
        named.map { OfferLine(LineKind.Removed, it) } +
            listOfNotNull(
                more.takeIf { it > 0 }?.let {
                    OfferLine(
                        LineKind.Removed,
                        pluralStringResource(R.plurals.mock_result_more_topics, it, it),
                    )
                },
                skip?.let {
                    val lessons = it.lessons.toInt()
                    OfferLine(LineKind.Context, pluralStringResource(R.plurals.mock_result_lessons_less, lessons, lessons))
                },
                focus?.let {
                    // Partial credit reads to the hundredth.
                    val correct = (it.correct * PERCENT).roundToInt() / PERCENT
                    val right =
                        pluralStringResource(
                            R.plurals.mock_right_answers,
                            correct.toInt(),
                            formatNumber(correct, currentLocale()),
                            it.total.toInt(),
                        )
                    OfferLine(LineKind.Added, stringResource(R.string.mock_result_more_time, it.area, right))
                },
            )
    val removed = stringResource(R.string.mock_result_off_plan)
    val added = stringResource(R.string.mock_result_new)
    val shape = MaterialTheme.shapes.medium

    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape)
            .padding(vertical = 4.dp),
    ) {
        lines.forEach { line ->
            val (container, content) = line.colors()
            val spoken =
                when (line.kind) {
                    LineKind.Removed -> "$removed: ${line.text}"
                    LineKind.Added -> "$added: ${line.text}"
                    LineKind.Context -> line.text
                }
            Row(
                Modifier
                    .fillMaxWidth()
                    .background(container)
                    .padding(horizontal = 12.dp, vertical = 3.dp)
                    .clearAndSetSemantics { contentDescription = spoken },
            ) {
                val style = MaterialTheme.typography.bodySmall.withTabularFigures()
                when (line.kind) {
                    LineKind.Removed -> Text("− ", style = style, color = content)
                    LineKind.Added -> Text("+ ", style = style, color = content)
                    LineKind.Context -> Unit
                }
                Text(line.text, style = style, color = content)
            }
        }
    }
}

@Composable
private fun OfferLine.colors(): Pair<Color, Color> {
    val colors = MaterialTheme.colorScheme
    return when (kind) {
        LineKind.Removed -> colors.tertiaryContainer to colors.onTertiaryContainer
        LineKind.Context -> Color.Transparent to colors.onSurfaceVariant
        LineKind.Added -> Color.Transparent to colors.onSurface
    }
}

private const val PERCENT = 100.0
private const val TOPICS_NAMED = 3
private val METER_WIDTH = 320.dp
