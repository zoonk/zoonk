package com.zoonk.android.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.country.CountryChoice
import com.zoonk.android.feature.country.CountrySheet
import com.zoonk.android.feature.country.choices
import com.zoonk.android.feature.country.lessonLanguageLine
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.delay
import kotlin.time.Duration.Companion.seconds

/** The goal's content country when the learner can change it: a country-dependent learn goal's. */
internal val LearnerSummaryGoal.editableCountry: GoalContentCountry?
    get() = contentCountry?.takeIf { it.editable && it.kind == GoalContentCountry.Kind.CONTENT }

/**
 * The Adjust plan row, as the language's: the content country, the lesson language when core
 * discloses one, and Change. A new country rebuilds the plan, so it asks first; the old plan stays
 * until the new one saves.
 */
@Composable
internal fun ContentCountryRow(
    goal: LearnerSummaryGoal,
    country: GoalContentCountry,
    drafts: EditorDrafts,
    onPick: (String, () -> Unit) -> Unit,
    pending: Boolean,
    failed: Boolean,
    modifier: Modifier = Modifier,
) {
    val lessonLanguage = lessonLanguageLine(country.lessonVariety)
    // A failed save closes the question it answered, and the picker shows the error with the old country still picked.
    LaunchedEffect(failed) { if (failed && drafts.countryAsked?.sent == true) drafts.countryAsked = null }

    ListRow(
        headline = { Text(stringResource(R.string.country_content_label)) },
        supporting = {
            Column {
                Text(country.name)
                lessonLanguage?.let { Text(it) }
            }
        },
        trailing = { Text(stringResource(R.string.onboarding_aim_change)) },
        chevron = false,
        onClick = { drafts.picking = PlanPicker.Country },
        modifier = modifier,
    )
    if (drafts.picking == PlanPicker.Country) {
        CountrySheet(
            title = stringResource(R.string.onboarding_variety_title),
            suggested = goal.suggested.choices(),
            language = goal.language,
            selected = country.code,
            onPick = { choice: CountryChoice? -> choice?.let { drafts.countryAsked = CountryAsked(it.code, it.name) } },
            onDismiss = { drafts.picking = null },
            pending = pending,
            failed = failed,
        )
    }
    drafts.countryAsked?.let { asked ->
        AlertDialog(
            onDismissRequest = { if (!pending) drafts.countryAsked = null },
            title = { Text(stringResource(R.string.country_change_title)) },
            text = {
                Text(stringResource(R.string.country_change_body, asked.name), Modifier.verticalScroll(rememberScrollState()))
            },
            confirmButton = {
                TextButton(
                    busy = pending,
                    enabled = !pending,
                    onClick = {
                        drafts.countryAsked = asked.copy(sent = true)
                        onPick(asked.code) {
                            drafts.countryAsked = null
                            drafts.picking = null
                        }
                    },
                ) { Text(stringResource(R.string.country_change_confirm)) }
            },
            dismissButton = {
                TextButton(onClick = { drafts.countryAsked = null }, enabled = !pending) { Text(stringResource(R.string.plan_cancel)) }
            },
        )
    }
}

/** The read-only country rows, where Adjust plan is the only place a phone lists the plan's settings: a foreign exam's country, a general course's examples. */
@Composable
internal fun CountryFacts(
    goal: LearnerSummaryGoal,
    modifier: Modifier = Modifier,
) {
    goal.contentCountry?.takeIf { goal.editableCountry == null }?.let { exam ->
        ListRow(headline = { Text(stringResource(R.string.country_exam_label)) }, supporting = { Text(exam.name) }, modifier = modifier)
    }
    goal.examplesCountry?.let { examples ->
        ListRow(
            headline = { Text(stringResource(R.string.country_lesson_examples_label)) },
            supporting = { Text(examples.name) },
            modifier = modifier,
        )
    }
}

/** What the top of the Plan says while a new plan is prepared for a new country, once it's ready, or when it failed. */
internal enum class CountryRebuild { Preparing, Ready, Failed }

/**
 * While a new country's plan is prepared the summary is read again every so often, which is how the
 * Plan learns it saved; it then reads the new plan and says it's ready until the learner leaves.
 */
@Composable
internal fun rememberCountryRebuild(
    goal: LearnerSummaryGoal,
    app: AppContainer,
): CountryRebuild? {
    val rebuild = goal.contentCountry?.rebuild
    var waited by remember(goal.id) { mutableStateOf(false) }
    var ready by remember(goal.id) { mutableStateOf(false) }

    WhileShown(rebuild == GoalContentCountry.Rebuild.PREPARING) {
        while (true) {
            delay(REBUILD_REFRESH)
            app.learnerSummary.summary.refresh()
        }
    }
    LaunchedEffect(rebuild) {
        when (rebuild) {
            GoalContentCountry.Rebuild.PREPARING -> {
                waited = true
                ready = false
            }

            GoalContentCountry.Rebuild.FAILED -> {
                waited = false
            }

            GoalContentCountry.Rebuild.NONE, null -> {
                if (waited) {
                    waited = false
                    ready = true
                    app.plans.plan[goal.id].refresh()
                }
            }
        }
    }

    return when {
        rebuild == GoalContentCountry.Rebuild.PREPARING -> CountryRebuild.Preparing
        rebuild == GoalContentCountry.Rebuild.FAILED -> CountryRebuild.Failed
        ready -> CountryRebuild.Ready
        else -> null
    }
}

private val REBUILD_REFRESH = 15.seconds

/** Preparing and failed are cards above the roadmap; ready is one quiet line, as main's. */
@Composable
internal fun CountryRebuildNotice(
    rebuild: CountryRebuild,
    retrying: Boolean,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val announced = modifier.semantics { liveRegion = LiveRegionMode.Polite }
    if (rebuild == CountryRebuild.Ready) {
        Text(
            stringResource(R.string.country_rebuild_ready),
            announced,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }
    val failed = rebuild == CountryRebuild.Failed
    OutlinedCard(announced.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (failed) {
                Icon(painterResource(R.drawable.ic_warning), contentDescription = null, tint = MaterialTheme.zoonk.warning)
            } else {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    stringResource(if (failed) R.string.country_rebuild_failed_title else R.string.country_rebuild_title),
                    style = MaterialTheme.typography.titleSmall,
                )
                Text(
                    stringResource(if (failed) R.string.country_rebuild_failed_body else R.string.country_rebuild_body),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (failed) {
                    OutlinedButton(
                        onClick = onRetry,
                        busy = retrying,
                        enabled = !retrying,
                        size = ButtonSize.Small,
                        leadingIcon = { ButtonIcon(R.drawable.ic_refresh) },
                        modifier = Modifier.padding(top = 8.dp),
                    ) {
                        Text(stringResource(R.string.generation_try_again))
                    }
                }
            }
        }
    }
}
