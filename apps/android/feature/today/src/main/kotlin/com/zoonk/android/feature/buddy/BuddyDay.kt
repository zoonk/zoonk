package com.zoonk.android.feature.buddy

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.missions.MissionsCard
import com.zoonk.android.feature.session.DayMission
import com.zoonk.android.feature.session.toDayMission
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.ListRowChevron
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.rememberExpandedBottomSheetState
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

/** What the buddy's day rows open, and the row whose tap is opening or couldn't open. */
internal class BuddyDayTaps(
    val open: (BuddyTap) -> Unit,
    private val opening: BuddyTap? = null,
    private val failed: BuddyTap? = null,
) {
    fun isOpening(tap: BuddyTap?): Boolean = tap != null && tap == opening

    fun hasFailed(tap: BuddyTap?): Boolean = tap != null && tap == failed
}

internal fun DayMission.tap(firstStep: Boolean = false): BuddyTap? = opens?.let { BuddyTap(it, firstStep) }

/** Main's quiet line beside the buddy on a phone: Energy and the day's missions, opening the day in a sheet ([open]). */
@Composable
internal fun BuddyTodayLine(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    taps: BuddyDayTaps,
    open: Boolean,
    onOpenChange: (Boolean) -> Unit,
    navigator: AppNavigator,
) {
    val today = status.today
    val done = today?.missions?.count { it.status == StudyMission.Status.DONE } ?: 0
    val energy = status.energy.current?.let { formatPercent(it / PERCENT, currentLocale()) }
    val number = MaterialTheme.typography.labelMedium.withTabularFigures()
    val muted = MaterialTheme.colorScheme.onSurfaceVariant

    val icon = with(LocalDensity.current) { LINE_ICON.toDp() }

    FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), itemVerticalAlignment = Alignment.CenterVertically) {
        TextButton(onClick = { navigator.open(AppRoute.StatsEnergy) }, contentPadding = PaddingValues(horizontal = DAY_LINE_PADDING)) {
            Icon(painterResource(R.drawable.ic_bolt), null, Modifier.size(icon), tint = MaterialTheme.zoonk.energy)
            Text(
                stringResource(R.string.buddy_page_energy_named, name),
                Modifier.padding(start = ENERGY_GAP),
                color = muted,
                style = number,
            )
            Text(energy ?: DASH, Modifier.padding(start = ENERGY_GAP), color = muted, style = number)
        }
        TextButton(onClick = { onOpenChange(true) }, contentPadding = PaddingValues(horizontal = DAY_LINE_PADDING)) {
            if (today != null && today.missions.isNotEmpty()) {
                MissionsRing(done, today.missions.size, Modifier.size(icon), strokeWidth = RING_STROKE)
                Spacer(Modifier.width(MISSIONS_GAP))
            }
            Text(
                today
                    ?.takeIf {
                        it.missions.isNotEmpty()
                    }?.let { pluralStringResource(R.plurals.buddy_page_missions_count, it.missions.size, done, it.missions.size) }
                    ?: stringResource(R.string.buddy_page_today, name),
                color = muted,
                style = number,
            )
        }
    }

    if (open) BuddyTodaySheet(status, look, name, taps, navigator, onDismiss = { onOpenChange(false) })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BuddyTodaySheet(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    taps: BuddyDayTaps,
    navigator: AppNavigator,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberExpandedBottomSheetState()) {
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
                    growthLine(status.nextStage),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            BuddyEnergy(status.energy, name) {
                onDismiss()
                navigator.open(AppRoute.StatsEnergy)
            }
            if (status.today?.missions?.isNotEmpty() == true) {
                HorizontalDivider()
                BuddyMissions(status, look, name, taps) {
                    onDismiss()
                    navigator.open(AppRoute.StatsLevel)
                }
            }
            if (status.firstSteps != null) {
                HorizontalDivider()
                BuddyFirstStepsSection(status.firstSteps, look, name, taps)
            }
        }
    }
}

/** The buddy's day beside its conversation, where there's room. */
@Composable
internal fun BuddyDayPane(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    taps: BuddyDayTaps,
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
        BuddyMissions(status, look, name, taps) { navigator.open(AppRoute.StatsLevel) }
        BuddyFirstStepsSection(status.firstSteps, look, name, taps)

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(name, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
            Column {
                PaneRow(growthLine(status.nextStage))
                HorizontalDivider()
                PaneRow(stringResource(R.string.buddy_page_remembers, name), onClick = { navigator.open(AppRoute.Memory) }) {
                    memory.value?.let {
                        Text(
                            it.facts.size.toString(),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
                        )
                    }
                }
                HorizontalDivider()
                PaneRow(stringResource(R.string.buddy_glasses), onClick = onGlasses) { GlassesCount(status) }
                HorizontalDivider()
                PaneRow(stringResource(R.string.buddy_page_weekly_summary), onClick = { navigator.open(AppRoute.Logbook) })
            }
        }
    }
}

/** One of the buddy's rows; one that opens something says so with a chevron. */
@Composable
private fun PaneRow(
    text: String,
    onClick: (() -> Unit)? = null,
    trailing: @Composable () -> Unit = {},
) {
    Row(
        Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
            .heightIn(min = 48.dp)
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
        trailing()
        if (onClick != null) {
            ListRowChevron()
        }
    }
}

@Composable
private fun BuddyMissions(
    status: BuddyStatus,
    look: BuddyLook,
    name: String,
    taps: BuddyDayTaps,
    onLevel: () -> Unit,
) {
    val today = status.today ?: return

    MissionsCard(
        missions = today.missions.map { it.toDayMission() },
        bonus = today.fullMeal.bonus,
        bonusEarned = today.fullMeal.earned,
        buddy = look,
        buddyName = name,
        onOpen = { opens -> taps.open(BuddyTap(opens)) },
        onLevel = onLevel,
        opening = { mission -> taps.isOpening(mission.tap()) },
        openFailed = { mission -> taps.hasFailed(mission.tap()) },
    )
}

/** Main's Energy: before the first lesson, how it starts; then its meter and what keeps it up, opening Energy's page. */
@Composable
private fun BuddyEnergy(
    energy: BuddyStatusEnergy,
    name: String,
    onOpen: () -> Unit,
) {
    val title = stringResource(R.string.buddy_page_energy_named, name)
    val current = energy.current

    if (current == null) {
        Column(Modifier.clickable(onClick = onOpen), verticalArrangement = Arrangement.spacedBy(4.dp)) {
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
            energy.studiedToday -> null
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
            ListRowChevron()
        }
        Meter((current / PERCENT).toFloat(), color = MaterialTheme.zoonk.energy)
        line?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium) }
    }
}

@Composable
private fun growthLine(next: BuddyStatusNextStage?): String {
    next ?: return stringResource(R.string.buddy_page_fully_grown)
    val belt = stringResource(belt(next.belt).label)

    return stringResource(R.string.buddy_page_grows, belt)
}

private const val PERCENT = 100.0
private const val DASH = "–"
private const val RING_STROKE = 6f
private val LINE_ICON = 14.sp

/** The day's line is a quiet button: its words sit this far inside its box. */
internal val DAY_LINE_PADDING = 8.dp

/** Main's `gap-1` and `gap-1.5` between the line's mark and words. */
private val ENERGY_GAP = 4.dp
private val MISSIONS_GAP = 6.dp
