package com.zoonk.android.feature.activities

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf34Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf34FieldsAfter
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf34FieldsAfterFactsInner
import java.util.Locale
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf34Value as BeforeAfterContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2Value as NumericCheckValue

private typealias BeforeAfterState = PlayableLibraryStepAnyOfContentOneOf34FieldsAfter
private typealias Fact = PlayableLibraryStepAnyOfContentOneOf34FieldsAfterFactsInner

val beforeAfterRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_before_after, R.drawable.ic_compare_arrows) },
        canvas = { BeforeAfterActivity(it) },
        showsData = { true },
    )

@Composable
private fun BeforeAfterActivity(props: ActivityProps) {
    val content = (props.content as BeforeAfterContent).value
    val fields = content.fields
    val locale = currentLocale()
    var revealed by rememberSaveable { mutableStateOf(false) }
    val showsAfter = revealed || props.isChecked
    val highlightId =
        (content.check as? NumericCheckValue)?.let {
            it.value.output ?: fields.before.facts
                .firstOrNull()
                ?.id
        }
    val ratios =
        fields.before.facts
            .associate { it.id to changeRatio(fields, it.id) }
            .takeIf { props.isChecked }
    val afterFocus = remember { FocusRequester() }
    val description =
        listOf(
            describe(fields.before, locale),
            fields.change,
            if (showsAfter) describe(fields.after, locale) else stringResource(R.string.activities_before_after_hidden),
        ).joinToString(" ")

    LaunchedEffect(revealed) { if (revealed) afterFocus.requestFocus() }

    ActivityCanvas(description) {
        StateCard(fields.before, other = fields.after, isAfter = false, highlightId = highlightId, ratios = null)
        Row(Modifier.padding(horizontal = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
                painterResource(R.drawable.ic_arrow_downward),
                contentDescription = null,
                modifier = Modifier.padding(top = 2.dp).size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            RichText(fields.change, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium))
        }
        if (showsAfter) {
            StateCard(
                fields.after,
                other = fields.before,
                isAfter = true,
                highlightId = highlightId,
                ratios = ratios,
                modifier = Modifier.focusRequester(afterFocus).focusable(),
            )
        } else {
            OutlinedButton(
                onClick = { revealed = true },
                modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp),
                shape = RoundedCornerShape(12.dp),
                border = BorderStroke(2.dp, MaterialTheme.zoonk.vizAccent.copy(alpha = SOFT)),
            ) {
                Icon(painterResource(R.drawable.ic_visibility), contentDescription = null, modifier = Modifier.size(16.dp))
                Text(
                    stringResource(R.string.activities_before_after_show, fields.after.label),
                    modifier = Modifier.padding(start = 8.dp),
                    color = MaterialTheme.zoonk.vizAccent,
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
    }
}

@Composable
private fun StateCard(
    state: BeforeAfterState,
    other: BeforeAfterState,
    isAfter: Boolean,
    highlightId: String?,
    ratios: Map<String, Double?>?,
    modifier: Modifier = Modifier,
) {
    val accent = MaterialTheme.zoonk.vizAccent

    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (isAfter) accent.copy(alpha = SOFT) else MaterialTheme.colorScheme.surface)
            .semantics { contentDescription = state.label }
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            state.label,
            color = if (isAfter) accent else MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.titleSmall,
        )
        state.facts.forEach { fact ->
            FactRow(
                fact,
                other = other.facts.find { it.id == fact.id },
                isAfter = isAfter,
                change = ratios?.get(fact.id)?.let(::describeChange),
                highlighted = fact.id == highlightId,
            )
        }
        RichText(state.description, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun FactRow(
    fact: Fact,
    other: Fact?,
    isAfter: Boolean,
    change: FactChange?,
    highlighted: Boolean,
) {
    val locale = currentLocale()
    val accent = MaterialTheme.zoonk.vizAccent
    val shares = if (isAfter) barShares(other?.value ?: 0.0, fact.value) else barShares(fact.value, other?.value ?: 0.0)
    val share = remember { Animatable(shares.first) }

    LaunchedEffect(isAfter) {
        if (isAfter) share.animateTo(shares.second, tween(GROW_MILLIS, easing = ZoonkMotion.EaseOut))
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(
                fact.label,
                modifier = Modifier.weight(1f),
                color = if (isAfter) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                formatAmount(fact.value, locale, fact.unit),
                color = if (isAfter) accent else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.titleMedium.withTabularFigures(),
            )
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(CircleShape)
                .background(if (isAfter) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceContainerHigh),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(share.value)
                    .fillMaxHeight()
                    .clip(CircleShape)
                    .background(if (isAfter) accent else MaterialTheme.colorScheme.onSurfaceVariant),
            )
        }
        if (change != null) {
            Surface(
                shape = CircleShape,
                color = if (highlighted) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surface,
                contentColor = if (highlighted) MaterialTheme.colorScheme.onTertiaryContainer else MaterialTheme.colorScheme.onSurface,
            ) {
                Text(
                    changeLabel(change, locale),
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    style =
                        MaterialTheme.typography.labelMedium
                            .withTabularFigures()
                            .copy(fontWeight = FontWeight.SemiBold),
                )
            }
        }
    }
}

@Composable
private fun changeLabel(
    change: FactChange,
    locale: Locale,
): String =
    when (change) {
        FactChange.Same -> stringResource(R.string.activities_before_after_no_change)
        is FactChange.Percent -> formatAmount(change.percent, locale, "%", signed = true)
        is FactChange.Less -> stringResource(R.string.activities_before_after_less, formatAmount(change.times, locale))
        is FactChange.More -> stringResource(R.string.activities_before_after_more, formatAmount(change.times, locale))
    }

private fun describe(
    state: BeforeAfterState,
    locale: Locale,
): String =
    listOf(
        "${state.label}:",
        state.facts.joinToString(", ") { "${it.label} ${formatAmount(it.value, locale, it.unit)}" },
        state.description,
    ).joinToString(" ")

/** Core's `changeRatio`: a fact's after value over its before value. */
internal fun changeRatio(
    fields: PlayableLibraryStepAnyOfContentOneOf34Fields,
    factId: String,
): Double? {
    val before =
        fields.before.facts
            .find { it.id == factId }
            ?.value
    val after =
        fields.after.facts
            .find { it.id == factId }
            ?.value
    return if (before == null || after == null || before == 0.0) null else after / before
}

private const val SOFT = 0.16f
private const val GROW_MILLIS = 700
