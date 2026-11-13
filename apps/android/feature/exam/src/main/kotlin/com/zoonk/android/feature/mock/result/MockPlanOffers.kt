package com.zoonk.android.feature.mock.result

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.R
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.StepTitle
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.stepHeading
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.MockAdapt
import com.zoonk.api.models.MockPlanOfferInput.Offer
import com.zoonk.api.models.MockPlanOfferResult
import com.zoonk.api.models.MockResultPreparation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.floor
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

/** Main's `usePlanChange`: one question at a time; the plan changes only on the learner's yes. */
class MockPlanOffersViewModel(
    private val store: MockRunStore,
    private val sessions: SessionSource,
    private val blockId: String,
) : ViewModel() {
    private val mutable = MutableStateFlow(PlanOffers())
    val state: StateFlow<PlanOffers> = mutable.asStateFlow()

    /** Says yes to [offer] for the session that tapped it. */
    fun accept(offer: Offer) {
        if (mutable.value.applying || mutable.value.answers[offer].isSettled) return
        val owner = sessions.current
        mutable.update { it.copy(applying = true) }
        viewModelScope.launch {
            val answer =
                when (val result = store.adapt(blockId, offer)) {
                    is MutationResult.Done -> OfferAnswer.Outcome(result.value)
                    is MutationResult.Failed -> OfferAnswer.Failed
                    MutationResult.Obsolete -> null
                }
            mutable.update { state ->
                val kept = answer?.takeIf { sessions.current == owner }
                state.copy(answers = state.answers + listOfNotNull(kept?.let { offer to it }), applying = false)
            }
        }
    }

    fun decline(offer: Offer) {
        mutable.update { state ->
            if (state.answers[offer].isSettled) state else state.copy(answers = state.answers + (offer to OfferAnswer.Declined))
        }
    }
}

/** The offer the learner answers now: the next ones show once this one is answered. */
internal fun PlanOffers.open(adapt: MockAdapt?): Offer? = planOffers(adapt).firstOrNull { !answers[it].isSettled }

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
    onAccept: (Offer) -> Unit,
    onDecline: (Offer) -> Unit,
) {
    val question = offers.open(adapt) ?: planOffers(adapt).firstOrNull()

    Column(Modifier.semantics(mergeDescendants = true) { heading() }.stepHeading(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            stringResource(if (preparation != null) R.string.mock_result_your_preparation else R.string.mock_result_your_plan),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.titleMedium,
        )
        if (preparation != null) {
            PreparationReadout(preparation, MaterialTheme.typography.displayMedium)
        } else {
            question?.let { StepTitle(offerTitle(it, adapt)) }
        }
    }
    preparation?.let { PreparationMeter(it) }
    if (adapt != null && planOffers(adapt).isNotEmpty()) PlanChange(adapt, offers, showTitle = preparation != null, onAccept, onDecline)
}

/** "14%", with where it came from under it: "Up from 12%". */
@Composable
internal fun PreparationReadout(
    preparation: MockResultPreparation,
    style: TextStyle,
) {
    val locale = currentLocale()
    val before = formatPercent(preparation.before, locale)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            formatPercent(preparation.after, locale),
            style = style.withTabularFigures().copy(fontWeight = FontWeight.SemiBold),
        )
        Text(
            stringResource(
                if (preparation.after <
                    preparation.before
                ) {
                    R.string.mock_result_down_from
                } else {
                    R.string.mock_result_up_from
                },
                before,
            ),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.zoonkType.data,
        )
    }
}

@Composable
internal fun PreparationMeter(preparation: MockResultPreparation) {
    Meter(preparation.after.toFloat(), Modifier.widthIn(max = METER_WIDTH))
}

private class OfferCopy(
    val title: String,
    val line: String,
    val accept: String,
    val decline: String,
)

@Composable
private fun offerTitle(
    offer: Offer,
    adapt: MockAdapt?,
): String =
    when (offer) {
        Offer.SKIP -> {
            val lessons = adapt?.skip?.lessons?.toInt() ?: 0
            pluralStringResource(R.plurals.mock_result_skip_title, lessons, lessons)
        }

        Offer.FOCUS -> {
            stringResource(R.string.mock_result_focus_title, adapt?.focus?.area.orEmpty())
        }
    }

@Composable
private fun offerCopy(
    offer: Offer,
    adapt: MockAdapt,
): OfferCopy {
    val locale = currentLocale()
    return when (offer) {
        Offer.SKIP -> {
            val topics = adapt.skip?.topics.orEmpty()
            val named = topics.take(TOPICS_NAMED)
            val more = topics.size - named.size
            val names =
                if (more > 0) {
                    pluralStringResource(R.plurals.mock_result_topics_and_more, more, named.joinToString(", "), more)
                } else {
                    formatList(named, locale)
                }
            OfferCopy(
                title = offerTitle(offer, adapt),
                line = stringResource(R.string.mock_result_skip_line, names),
                accept = stringResource(R.string.mock_result_skip_them),
                decline = stringResource(R.string.mock_result_keep_them),
            )
        }

        Offer.FOCUS -> {
            val focus = adapt.focus
            // Partial credit reads to the hundredth.
            val correct = ((focus?.correct ?: 0.0) * PERCENT).roundToInt() / PERCENT
            OfferCopy(
                title = offerTitle(offer, adapt),
                line =
                    pluralStringResource(
                        R.plurals.mock_result_focus_line,
                        floor(correct).toInt(),
                        formatNumber(correct, locale),
                        (focus?.total ?: 0L).toInt(),
                    ),
                accept = stringResource(R.string.mock_result_change_plan),
                decline = stringResource(R.string.mock_result_keep_plan),
            )
        }
    }
}

@Composable
internal fun PlanChange(
    adapt: MockAdapt,
    offers: PlanOffers,
    showTitle: Boolean,
    onAccept: (Offer) -> Unit,
    onDecline: (Offer) -> Unit,
) {
    val open = offers.open(adapt)

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        OfferStatus(adapt, offers)
        open?.let { offer ->
            val copy = offerCopy(offer, adapt)
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (showTitle) Text(copy.title, style = MaterialTheme.typography.bodyMedium)
                    Text(copy.line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(busy = offers.applying, onClick = { onAccept(offer) }, size = ButtonSize.Small) { Text(copy.accept) }
                    TextButton(onClick = { onDecline(offer) }, enabled = !offers.applying, size = ButtonSize.Small) { Text(copy.decline) }
                }
            }
        }
    }
}

/** Main's `PlanChangeStatus`: one line per answer that changed something or failed; a no says nothing. */
@Composable
private fun OfferStatus(
    adapt: MockAdapt,
    offers: PlanOffers,
) {
    val lines =
        planOffers(adapt).mapNotNull { offer ->
            val answer = offers.answers[offer] ?: return@mapNotNull null
            val applied = (answer as? OfferAnswer.Outcome)?.result?.status == MockPlanOfferResult.Status.APPLIED
            answerLine(offer, answer, adapt)?.let { it to applied }
        }
    if (lines.isEmpty()) return
    val glyph =
        with(LocalDensity.current) {
            MaterialTheme.typography.bodyMedium.lineHeight
                .toDp()
        }

    Column(
        Modifier.semantics(mergeDescendants = true) {
            liveRegion = LiveRegionMode.Polite
        },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        lines.forEach { (line, applied) ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (applied) {
                    Icon(
                        painterResource(R.drawable.ic_check_circle),
                        contentDescription = null,
                        modifier = Modifier.size(glyph),
                        tint = MaterialTheme.colorScheme.tertiary,
                    )
                }
                Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun answerLine(
    offer: Offer,
    answer: OfferAnswer,
    adapt: MockAdapt,
): String? =
    when (answer) {
        OfferAnswer.Declined -> {
            null
        }

        OfferAnswer.Failed -> {
            stringResource(R.string.mock_result_plan_not_saved)
        }

        is OfferAnswer.Outcome -> {
            val result = answer.result
            when {
                result.status != MockPlanOfferResult.Status.APPLIED -> {
                    stringResource(R.string.mock_result_plan_unchanged)
                }

                offer == Offer.SKIP -> {
                    val lessons = result.lessonsSkipped.toInt()
                    pluralStringResource(R.plurals.mock_result_skip_done, lessons, lessons)
                }

                else -> {
                    stringResource(R.string.mock_result_focus_done, adapt.focus?.area.orEmpty())
                }
            }
        }
    }

private const val PERCENT = 100.0
private const val TOPICS_NAMED = 3
private val METER_WIDTH = 320.dp
