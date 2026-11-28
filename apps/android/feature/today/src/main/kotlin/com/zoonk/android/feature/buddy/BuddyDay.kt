package com.zoonk.android.feature.buddy

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zoonk.android.R
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
import com.zoonk.android.ui.theme.zoonkType
import com.zoonk.api.models.BuddyStatus
import com.zoonk.api.models.BuddyStatusEnergy
import com.zoonk.api.models.BuddyStatusNextStage

internal fun BuddyStatus.look(): BuddyLook =
    BuddyLook(
        kind = BuddyKind.of(buddy.kind.value),
        glasses = BuddyGlasses.of(buddy.glasses.value),
        belt = Belt.fromKey(belt.color) ?: Belt.White,
        energy = energy.current,
        studiedToday = energy.studiedToday,
    )

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

/** Main's Energy beside the buddy's name: its mark and value, opening the buddy's day in a sheet ([open]). */
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
    val energy = status.energy.current?.let { formatPercent(it / PERCENT, currentLocale()) }
    val label = stringResource(R.string.buddy_page_energy_named, name)
    val notYet = stringResource(R.string.stats_not_yet)
    val icon = with(LocalDensity.current) { LINE_ICON.toDp() }

    TextButton(
        onClick = { onOpenChange(true) },
        Modifier.semantics(mergeDescendants = true) { contentDescription = "$label ${energy ?: notYet}" },
        contentPadding = PaddingValues(horizontal = DAY_LINE_PADDING),
    ) {
        Icon(painterResource(R.drawable.ic_bolt), null, Modifier.size(icon), tint = MaterialTheme.zoonk.energy)
        Text(
            energy ?: DASH,
            Modifier.padding(start = LINE_GAP),
            color = if (energy == null) MaterialTheme.zoonk.faint else MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
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
        missions = today.missions.mapNotNull { it.toDayMission() },
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
            Text(title, Modifier.semantics { heading() }, style = MaterialTheme.zoonkType.sectionTitle)
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
            Text(title, Modifier.weight(1f).semantics { heading() }, style = MaterialTheme.zoonkType.sectionTitle)
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
    val belt = Belt.fromKey(next.belt)?.let { stringResource(it.label) } ?: return ""

    return stringResource(R.string.buddy_page_grows, belt)
}

private const val PERCENT = 100.0
private const val DASH = "–"
private val LINE_ICON = 14.sp

/** The day's line is a quiet button: its words sit this far inside its box. */
internal val DAY_LINE_PADDING = 8.dp

/** Main's `gap-1` between the mark and the value. */
private val LINE_GAP = 4.dp
