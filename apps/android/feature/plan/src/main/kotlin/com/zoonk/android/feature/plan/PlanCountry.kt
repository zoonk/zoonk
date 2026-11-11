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
import androidx.compose.runtime.saveable.rememberSaveable
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
import com.zoonk.android.feature.country.shownLanguage
import com.zoonk.android.ui.components.AlertDialog
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ListRow
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
    onPick: (String, () -> Unit) -> Unit,
    pending: Boolean,
    failed: Boolean,
    modifier: Modifier = Modifier,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    var asking by rememberSaveable { mutableStateOf<String?>(null) }
    var askingName by rememberSaveable { mutableStateOf("") }
    val lessonLanguage = lessonLanguageLine(country.lessonVariety)
    // A failed save closes the question, and the picker shows the error with the old country still picked.
    LaunchedEffect(failed) { if (failed) asking = null }

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
        onClick = { open = true },
        modifier = modifier,
    )
    if (open) {
        CountrySheet(
            title = stringResource(R.string.onboarding_variety_title),
            suggested = goal.suggested.choices(),
            language = shownLanguage(),
            selected = country.code,
            onPick = { choice: CountryChoice? ->
                choice?.let {
                    asking = it.code
                    askingName = it.name
                }
            },
            onDismiss = { open = false },
            pending = pending,
            failed = failed,
        )
    }
    asking?.let { code ->
        AlertDialog(
            onDismissRequest = { if (!pending) asking = null },
            title = { Text(stringResource(R.string.country_change_title)) },
            text = {
                Text(stringResource(R.string.country_change_body, askingName), Modifier.verticalScroll(rememberScrollState()))
            },
            confirmButton = {
                TextButton(
                    busy = pending,
                    enabled = !pending,
                    onClick = {
                        onPick(code) {
                            asking = null
                            open = false
                        }
                    },
                ) { Text(stringResource(R.string.country_change_confirm)) }
            },
            dismissButton = {
                TextButton(onClick = { asking = null }, enabled = !pending) { Text(stringResource(R.string.plan_cancel)) }
            },
        )
    }
}

/** The read-only country rows, where Adjust plan is the only place a phone lists the plan's settings: a foreign exam's country, a general course's examples. */
@Composable
internal fun CountryFacts(goal: LearnerSummaryGoal) {
    goal.contentCountry?.takeIf { goal.editableCountry == null }?.let { exam ->
        ListRow(headline = { Text(stringResource(R.string.country_exam_label)) }, supporting = { Text(exam.name) })
    }
    goal.examplesCountry?.let { examples ->
        ListRow(headline = { Text(stringResource(R.string.country_lesson_examples_label)) }, supporting = { Text(examples.name) })
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

@Composable
internal fun CountryRebuildNotice(
    rebuild: CountryRebuild,
    retrying: Boolean,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(modifier.fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite }) {
        Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            when (rebuild) {
                CountryRebuild.Preparing -> CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                CountryRebuild.Ready -> Icon(painterResource(R.drawable.ic_check), contentDescription = null)
                CountryRebuild.Failed -> Icon(painterResource(R.drawable.ic_warning), contentDescription = null, tint = MaterialTheme.zoonk.warning)
            }
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                val title =
                    when (rebuild) {
                        CountryRebuild.Preparing -> R.string.country_rebuild_title
                        CountryRebuild.Ready -> R.string.country_rebuild_ready
                        CountryRebuild.Failed -> R.string.country_rebuild_failed_title
                    }
                Text(stringResource(title), style = MaterialTheme.typography.titleSmall)
                val body =
                    when (rebuild) {
                        CountryRebuild.Preparing -> R.string.country_rebuild_body
                        CountryRebuild.Ready -> null
                        CountryRebuild.Failed -> R.string.country_rebuild_failed_body
                    }
                body?.let {
                    Text(stringResource(it), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
                if (rebuild == CountryRebuild.Failed) {
                    Button(onClick = onRetry, busy = retrying, enabled = !retrying, modifier = Modifier.padding(top = 8.dp)) {
                        Text(stringResource(R.string.generation_try_again))
                    }
                }
            }
        }
    }
}
