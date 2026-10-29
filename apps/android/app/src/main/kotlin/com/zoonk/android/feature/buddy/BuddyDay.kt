package com.zoonk.android.feature.buddy

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.missions.MissionsCard
import com.zoonk.android.feature.session.MissionOpens
import com.zoonk.android.feature.session.toDayMission
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.buddyStageName
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.BuddyStatusEnergy
import com.zoonk.api.models.BuddyStatusNextStage
import com.zoonk.api.models.StudyMission

internal fun BuddyStatus.look(): BuddyLook =
    BuddyLook(
        kind = BuddyKind.of(buddy.kind.value),
        glasses = BuddyGlasses.of(buddy.glasses.value),
        belt = belt(belt.color),
        energy = energy.current,
        studiedToday = energy.studiedToday,
    )

private fun belt(color: String): Belt = Belt.entries.first { it.name.equals(color, ignoreCase = true) }

/** Main's quiet line beside the buddy on a phone: Energy and the day's missions, opening the day in a sheet. */
@Composable
internal fun BuddyTodayLine(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    onMission: (MissionOpens) -> Unit,
    navigator: AppNavigator,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    val today = status.today
    val done = today?.missions?.count { it.status == StudyMission.Status.DONE } ?: 0
    val energy = status.energy.current?.let { formatPercent(it / PERCENT, currentLocale()) }
    val spoken =
        listOfNotNull(
            "${stringResource(R.string.buddy_page_energy)} ${energy ?: stringResource(R.string.buddy_page_not_yet)}",
            missionsLabel(today?.missions?.size, done),
        ).joinToString(", ")
    val number = MaterialTheme.typography.labelMedium.withTabularFigures()

    TextButton(onClick = { open = true }, modifier = Modifier.clearAndSetSemantics { contentDescription = spoken }) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    painterResource(R.drawable.ic_bolt),
                    contentDescription = null,
                    Modifier.size(14.dp),
                    tint = MaterialTheme.zoonk.energy,
                )
                Text(energy ?: DASH, style = number, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (today == null || today.missions.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(painterResource(R.drawable.ic_check), contentDescription = null, Modifier.size(14.dp))
                    Text(
                        today?.let { "$done/${it.missions.size}" } ?: DASH,
                        style = number,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }

    if (open) {
        BuddyTodaySheet(status, look, name, onMission = { opens ->
            open = false
            onMission(opens)
        }, navigator, onDismiss = {
            open =
                false
        })
    }
}

@Composable
private fun missionsLabel(
    total: Int?,
    done: Int,
): String? =
    when (total) {
        null -> stringResource(R.string.buddy_page_missions)
        0 -> null
        else -> stringResource(R.string.buddy_page_missions_done, done, total)
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BuddyTodaySheet(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    onMission: (MissionOpens) -> Unit,
    navigator: AppNavigator,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp)
                .padding(bottom = 24.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    stringResource(R.string.buddy_page_today, name),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    "${buddyStageName(look.stage)} · ${growthLine(status.nextStage)}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            BuddyEnergy(status.energy, name) {
                onDismiss()
                navigator.open(AppRoute.StatsEnergy)
            }
            BuddyMissions(status, look, name, onMission)
            BuddyFirstStepsSection(status.firstSteps, look, name, onMission)
        }
    }
}

/** The buddy's day beside its conversation, where there's room. */
@Composable
internal fun BuddyDayPane(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    onMission: (MissionOpens) -> Unit,
    onGlasses: () -> Unit,
    navigator: AppNavigator,
    app: AppContainer,
) {
    val memory by app.memory.memory.collectShown()

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        BuddyEnergy(status.energy, name) { navigator.open(AppRoute.StatsEnergy) }
        BuddyMissions(status, look, name, onMission)
        BuddyFirstStepsSection(status.firstSteps, look, name, onMission)

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(name, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
            OutlinedCard(Modifier.fillMaxWidth()) {
                ListItem(headlineContent = { Text(growthLine(status.nextStage)) }, colors = ROW_COLORS)
                HorizontalDivider()
                ListItem(
                    headlineContent = { Text(stringResource(R.string.buddy_page_remembers, name)) },
                    trailingContent = {
                        memory.value?.let {
                            Text(
                                it.facts.size.toString(),
                                style = MaterialTheme.typography.labelLarge.withTabularFigures(),
                            )
                        }
                    },
                    modifier = Modifier.clickable { navigator.open(AppRoute.Memory) },
                    colors = ROW_COLORS,
                )
                HorizontalDivider()
                ListItem(
                    headlineContent = { Text(stringResource(R.string.buddy_glasses)) },
                    trailingContent = { GlassesCount(status) },
                    modifier = Modifier.clickable(onClick = onGlasses),
                    colors = ROW_COLORS,
                )
                HorizontalDivider()
                ListItem(
                    headlineContent = { Text(stringResource(R.string.buddy_page_weekly_summary)) },
                    modifier = Modifier.clickable { navigator.open(AppRoute.Logbook) },
                    colors = ROW_COLORS,
                )
            }
        }
    }
}

@Composable
private fun BuddyMissions(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    onMission: (MissionOpens) -> Unit,
) {
    val today = status.today ?: return

    MissionsCard(
        missions = today.missions.map { it.toDayMission() },
        bonus = today.fullMeal.bonus,
        bonusEarned = today.fullMeal.earned,
        buddy = look,
        buddyName = name,
        onOpen = onMission,
        brainPower = status.belt.totalBrainPower,
    )
}

/** Main's Energy: before the first lesson, how it starts; then its meter and what keeps it up, opening Energy's page. */
@Composable
private fun BuddyEnergy(
    energy: BuddyStatusEnergy,
    name: String,
    onOpen: () -> Unit,
) {
    val title = stringResource(R.string.buddy_page_energy)
    val current = energy.current

    if (current == null) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
            Text(
                stringResource(R.string.buddy_page_energy_starts),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }

    val line =
        when {
            energy.state == BuddyStatusEnergy.State.NAPPING -> stringResource(R.string.buddy_page_energy_napping, name)
            energy.studiedToday -> stringResource(R.string.buddy_page_energy_studied)
            else -> stringResource(R.string.buddy_page_energy_study)
        }

    Column(
        Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .clickable(onClick = onOpen)
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.typography.titleSmall)
            Text(formatPercent(current / PERCENT, currentLocale()), style = MaterialTheme.typography.labelLarge.withTabularFigures())
            Icon(
                painterResource(R.drawable.ic_chevron_right),
                contentDescription = null,
                Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Meter((current / PERCENT).toFloat(), color = MaterialTheme.zoonk.energy)
        Text(line, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun growthLine(next: BuddyStatusNextStage?): String {
    next ?: return stringResource(R.string.buddy_page_fully_grown)
    val belt = stringResource(belt(next.belt).label)

    return when (next.stage) {
        BuddyStatusNextStage.Stage.ADULT -> stringResource(R.string.buddy_page_grows_adult, belt)
        BuddyStatusNextStage.Stage.BABY, BuddyStatusNextStage.Stage.YOUNG -> stringResource(R.string.buddy_page_grows_young, belt)
    }
}

private val ROW_COLORS @Composable get() = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface)

private const val PERCENT = 100.0
private const val DASH = "–"
