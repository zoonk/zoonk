package com.zoonk.android.feature.planlink

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.LoadState
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.setup.selectedCheck
import com.zoonk.android.feature.plan.phaseKindName
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.components.EmptyState
import com.zoonk.android.ui.components.LoadFailedMessage
import com.zoonk.android.ui.components.OtherTime
import com.zoonk.android.ui.components.timeChoices
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlanLink
import com.zoonk.api.models.PlanLinkOutline
import com.zoonk.api.models.PlanLinkOutlinePhasesInner
import com.zoonk.api.models.PlanPhase
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

@Composable
fun PlanLinkScreen(
    route: AppRoute.PlanLink,
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    PlanLinkScreen(route, app.onboarding, signedIn = session is SessionState.SignedIn, navigator)
}

/** Shows only the plan's subject and shape; its owner is sent to their own Plan. */
@Composable
internal fun PlanLinkScreen(
    route: AppRoute.PlanLink,
    store: OnboardingStore,
    signedIn: Boolean,
    navigator: AppNavigator,
) {
    val vm = viewModel { PlanLinkViewModel(store, createSavedStateHandle()) }
    val resource = store.planLinks[route.planId]
    val state by resource.collectShown()
    val link = (state as? LoadState.Loaded)?.value
    val scope = rememberCoroutineScope()

    LaunchedEffect(link?.owner) { if (link?.owner != null) navigator.showRoot(AppTab.Plan) }

    PageScaffold(onBack = navigator::back) { padding ->
        when (val shown = state) {
            is LoadState.Loaded -> {
                if (shown.value.owner != null) return@PageScaffold
                PageWithSupportingPane(
                    supportingPane = { Phases(shown.value.outline, Modifier.verticalScroll(rememberScrollState()).padding(24.dp)) },
                    modifier = Modifier.padding(padding),
                ) { beside ->
                    Column(
                        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(24.dp),
                    ) {
                        Heading(shown.value)
                        if (signedIn) {
                            StartForm(vm, onStart = { vm.start(route.planId) { navigator.showRoot(AppTab.Plan) } })
                        } else {
                            val title =
                                shown.value.outline.subject
                                    ?.title
                                    .orEmpty()
                            Button(
                                onClick = { navigator.open(AppRoute.StartGoal(goal = title, planId = route.planId)) },
                                modifier = Modifier.widthIn(max = FORM_WIDTH).fillMaxWidth(),
                            ) {
                                Text(stringResource(R.string.planlink_start))
                            }
                            MakeItYours()
                        }
                        if (!beside) Phases(shown.value.outline)
                    }
                }
            }

            is LoadState.Failed -> {
                if (shown.error == ApiError.NotFound) {
                    EmptyState(
                        icon = R.drawable.ic_link,
                        title = stringResource(R.string.planlink_not_found),
                        description = stringResource(R.string.planlink_not_found_description),
                        modifier = Modifier.padding(padding),
                    )
                } else {
                    LoadFailedMessage(onRetry = { scope.launch { resource.refresh() } }, modifier = Modifier.padding(padding))
                }
            }

            LoadState.Empty -> {
                EmptyState(
                    icon = R.drawable.ic_link,
                    title = stringResource(R.string.planlink_not_found),
                    description = stringResource(R.string.planlink_not_found_description),
                    modifier = Modifier.padding(padding),
                )
            }

            LoadState.Idle, LoadState.Loading -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
        }
    }
}

@Composable
private fun Heading(link: PlanLink) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.planlink_eyebrow),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        Text(
            link.outline.subject?.title ?: stringResource(R.string.planlink_study_plan),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineSmall,
        )
        link.outline.subject?.description?.let {
            Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun StartForm(
    vm: PlanLinkViewModel,
    onStart: () -> Unit,
) {
    val locale = currentLocale()
    Column(Modifier.widthIn(max = FORM_WIDTH), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val minutesLabel = stringResource(R.string.planlink_minutes_label)
        Text(minutesLabel, fontWeight = FontWeight.Medium)
        FlowRow(Modifier.semantics { contentDescription = minutesLabel }, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            timeChoices(vm.minutes).forEach { option ->
                FilterChip(
                    selected = option == vm.minutes,
                    onClick = { vm.pick(option) },
                    leadingIcon = selectedCheck(option == vm.minutes),
                    label = { Text(formatMinutes(option, locale), style = MaterialTheme.typography.labelLarge.withTabularFigures()) },
                )
            }
        }
        OtherTime(vm.minutes, stringResource(R.string.onboarding_schedule_other_time_label), vm::pick)
        Button(onClick = onStart, enabled = !vm.isStarting, modifier = Modifier.fillMaxWidth()) {
            Text(stringResource(R.string.planlink_start))
        }
        vm.failure?.let {
            Text(
                stringResource(if (it == StartFailure.Refused) R.string.planlink_refused else R.string.planlink_failed),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        MakeItYours()
    }
}

@Composable
private fun MakeItYours() {
    Text(
        stringResource(R.string.planlink_make_it_yours),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}

@Composable
private fun Phases(
    outline: PlanLinkOutline,
    modifier: Modifier = Modifier,
) {
    val locale = currentLocale()
    val phases = pluralStringResource(R.plurals.planlink_phases, outline.phases.size, outline.phases.size)
    val skills = pluralStringResource(R.plurals.planlink_skills, outline.skillCount.toInt(), outline.skillCount.toInt())
    val study = formatMinutes(approximateMinutes(outline.hours).coerceAtLeast(1), locale)

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            stringResource(R.string.planlink_study_plan),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium,
        )
        Text(
            stringResource(R.string.planlink_facts, study, phases, skills),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall.withTabularFigures(),
        )
        outline.phases.forEachIndexed { index, phase ->
            if (index > 0) HorizontalDivider()
            PhaseRow(index, phase)
        }
    }
}

@Composable
private fun PhaseRow(
    index: Int,
    phase: PlanLinkOutlinePhasesInner,
) {
    val locale = currentLocale()
    val number = index + 1
    val kind = PlanPhase.Kind.entries.firstOrNull { it.value == phase.kind.value }
    val name = phase.name.ifEmpty { kind?.let { phaseKindName(it, number) }.orEmpty() }
    val minutes = approximateMinutes(phase.hours)

    // The plan starts at its first phase, marked as the row the learner is on.
    val start = if (index == 0) MaterialTheme.colorScheme.surfaceContainerHigh else Color.Transparent
    Row(
        Modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) {}
            .background(start, MaterialTheme.shapes.small)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Text(
            number.toString(),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge.withTabularFigures(),
        )
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(name, fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyMedium)
            phase.milestone?.let {
                Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
        // A phase too small to measure shows no size, so nothing ever reads "~0 min".
        if (minutes > 0) {
            Text(
                stringResource(R.string.planlink_about, formatMinutes(minutes, locale)),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall.withTabularFigures(),
            )
        }
    }
}

/** Under an hour in minutes, from an hour in whole hours, as main rounds a plan's size. */
private fun approximateMinutes(hours: Double): Int {
    val minutes = (hours * MINUTES_PER_HOUR).roundToInt()
    return if (minutes < MINUTES_PER_HOUR) minutes else hours.roundToInt() * MINUTES_PER_HOUR
}

private const val MINUTES_PER_HOUR = 60
private val FORM_WIDTH = 480.dp
