package com.zoonk.android.feature.player.steps

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.player.engine.ChallengeDebrief
import com.zoonk.android.feature.player.engine.ChallengeMeterState
import com.zoonk.android.feature.player.engine.ChallengeMove
import com.zoonk.android.feature.player.engine.ChallengeProgress
import com.zoonk.android.feature.player.engine.LessonPhase
import com.zoonk.android.feature.player.engine.LessonPlayerState
import com.zoonk.android.feature.player.engine.challengeDebrief
import com.zoonk.android.feature.player.engine.challengeMeters
import com.zoonk.android.feature.player.engine.challengeNames
import com.zoonk.android.feature.player.engine.challengeProgress
import com.zoonk.android.feature.player.engine.fillChallengeNames
import com.zoonk.android.feature.player.engine.pickChallengeChoice
import com.zoonk.android.feature.player.model.ChallengeMessage
import com.zoonk.android.feature.player.model.ChallengePanel
import com.zoonk.android.feature.player.model.ChallengeSlot
import com.zoonk.android.feature.player.model.ChallengeStepContent
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.feature.player.model.StepContent
import com.zoonk.android.feature.player.model.StepResult
import com.zoonk.android.ui.components.LabelChip
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOf1Content.Variant
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentMetersInner.GoodWhen
import kotlin.math.abs

/** The learner's colleagues' names for a challenge's `{{slot}}`s, read once for the lesson. */
val LocalChallengeTeam = staticCompositionLocalOf<List<String>?> { null }

private const val BIG_METER_CHANGE = 25L
private const val METER_MAX = 100f
private const val PRACTICE_SECONDS = 300L

private class ChallengeNames(
    val names: Map<String, String>,
) {
    fun fill(text: String) = fillChallengeNames(text, names)
}

/** Main's `ChallengeStepView`: the case's intro, the conversation decision by decision, then its debrief. */
@Composable
internal fun ChallengeView(
    step: LessonStep,
    content: StepContent.Challenge,
    answer: LessonAnswer?,
    result: StepResult?,
    state: LessonPlayerState,
    actions: StepActions,
) {
    val challenge = content.content
    val team = LocalChallengeTeam.current
    val names = remember(challenge.team, team) { ChallengeNames(challengeNames(challenge.team, team)) }

    when (val progress = challengeProgress(challenge, answer, state.revealed[step.id] ?: 0)) {
        ChallengeProgress.Intro -> {
            ChallengeIntro(challenge, names)
        }

        is ChallengeProgress.Ended -> {
            if (result != null) {
                ChallengeDebriefView(challenge, names, progress.walk.moves)
            } else {
                ChallengeConversation(challenge, names, progress.walk.moves, progress, state, actions)
            }
        }

        is ChallengeProgress.Deciding -> {
            ChallengeConversation(challenge, names, progress.walk.moves, progress, state, actions)
        }
    }
}

@Composable
private fun ChallengeIntro(
    content: ChallengeStepContent,
    names: ChallengeNames,
) {
    val setting = names.fill(content.setting)

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            LabelChip(
                stringResource(
                    if (content.variant ==
                        Variant.WHAT_IF
                    ) {
                        R.string.player_challenge_what_if
                    } else {
                        R.string.player_challenge_case
                    },
                    setting,
                ),
                icon = R.drawable.ic_target,
            )
            QuestionText(names.fill(content.title))
        }

        OutlinedCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ChallengeLabel(stringResource(R.string.player_challenge_mission), heading = true)
                RichText(
                    text = names.fill(content.mission),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Normal),
                )
                content.deadline?.let { deadline ->
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(
                            painterResource(R.drawable.ic_schedule),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            names.fill(deadline),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        content.panels.forEach { ChallengePanelView(it, names) }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            ChallengeLabel(stringResource(R.string.player_challenge_team), heading = true)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                content.team.forEach { slot ->
                    val name = names.names[slot.id] ?: slot.role
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        ChallengeAvatar(name, slot)
                        Column {
                            Text(name, style = MaterialTheme.typography.labelLarge)
                            if (!slot.ai) {
                                Text(
                                    names.fill(slot.role),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
            }
        }

        Text(
            stringResource(if (content.team.any { it.ai }) R.string.player_challenge_help_ai else R.string.player_challenge_help),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun ChallengeConversation(
    content: ChallengeStepContent,
    names: ChallengeNames,
    moves: List<ChallengeMove>,
    progress: ChallengeProgress,
    state: LessonPlayerState,
    actions: StepActions,
) {
    val newest = remember { BringIntoViewRequester() }

    LaunchedEffect(moves.size) { if (moves.isNotEmpty()) newest.bringIntoView() }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        ChallengeMeters(challengeMeters(content, moves), names, moved = moves.isNotEmpty())

        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            moves.forEach { move ->
                move.node.messages.forEach { ChallengeMessageView(it, content.team, names) }
                ChallengePick(names.fill(move.choice.text))
                ChallengeEffects(move, content, names)
                move.choice.replies.forEach { ChallengeMessageView(it, content.team, names) }
                move.choice.timeJump?.let { jump ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        HorizontalDivider(Modifier.weight(1f))
                        Icon(
                            painterResource(R.drawable.ic_event_upcoming),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            names.fill(jump.label),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        HorizontalDivider(Modifier.weight(1f))
                    }
                    jump.panel?.let { ChallengePanelView(it, names) }
                }
            }
            if (progress is ChallengeProgress.Deciding) {
                progress.walk.node.messages.forEach {
                    ChallengeMessageView(
                        it,
                        content.team,
                        names,
                    )
                }
            }
        }

        Box(Modifier.bringIntoViewRequester(newest)) {
            if (progress is ChallengeProgress.Deciding) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    RichText(
                        text = names.fill(progress.walk.node.prompt),
                        modifier = Modifier.semantics { heading() },
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    )
                    ChoiceOptions(
                        options =
                            progress.walk.node.choices
                                .map { ChoiceOption(it.id, names.fill(it.text), isCorrect = false) },
                        selectedId = progress.pendingChoiceId,
                        isChecked = false,
                        isGuess = false,
                        locked = state.phase != LessonPhase.Playing,
                        onSelect = { id -> actions.select(pickChallengeChoice(id, progress.confirmed)) },
                    )
                }
            } else if (progress is ChallengeProgress.Ended) {
                Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.large) {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ChallengeLabel(stringResource(R.string.player_challenge_what_happened), heading = true)
                        RichText(text = names.fill(progress.walk.ending.outcome), style = MaterialTheme.typography.bodyLarge)
                    }
                }
            }
        }
    }
}

@Composable
private fun ChallengeLabel(
    text: String,
    heading: Boolean = false,
    color: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Text(
        text,
        modifier = if (heading) Modifier.semantics { heading() } else Modifier,
        color = color,
        style = MaterialTheme.typography.labelLarge,
    )
}

@Composable
private fun ChallengeAvatar(
    name: String,
    slot: ChallengeSlot?,
) {
    val ai = slot?.ai == true

    Box(
        modifier =
            Modifier
                .size(36.dp)
                .background(
                    if (ai) MaterialTheme.colorScheme.inverseSurface else MaterialTheme.colorScheme.surfaceContainerHighest,
                    CircleShape,
                ).clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        if (ai) {
            Icon(
                painterResource(R.drawable.ic_smart_toy),
                contentDescription = null,
                modifier = Modifier.size(18.dp),
                tint = MaterialTheme.colorScheme.inverseOnSurface,
            )
        } else {
            Text(name.take(1).uppercase(), style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun ChallengePanelView(
    panel: ChallengePanel,
    names: ChallengeNames,
) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            panel.title?.let { ChallengeLabel(names.fill(it)) }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                panel.metrics.forEach { metric ->
                    Column(Modifier.widthIn(min = 120.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(
                            names.fill(metric.label),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            metric.`value`,
                            style =
                                MaterialTheme.typography.headlineSmall
                                    .withTabularFigures()
                                    .copy(fontWeight = FontWeight.SemiBold),
                        )
                        metric.note?.let {
                            Text(
                                names.fill(it),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
            panel.note?.let {
                RichText(
                    text = names.fill(it),
                    style = MaterialTheme.typography.bodySmall.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                )
            }
        }
    }
}

@Composable
private fun ChallengeMessageView(
    message: ChallengeMessage,
    slots: List<ChallengeSlot>,
    names: ChallengeNames,
) {
    val slot = slots.firstOrNull { it.id == message.from }
    val name = names.names[message.from] ?: message.from
    val role = slot?.takeUnless { it.ai }?.let { names.fill(it.role) }

    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        ChallengeAvatar(name, slot)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(name, style = MaterialTheme.typography.labelLarge)
                role?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
            }
            RichText(text = names.fill(message.text), style = MaterialTheme.typography.bodyLarge)
        }
    }
}

/** The learner's pick, said as theirs. */
@Composable
private fun ChallengePick(text: String) {
    val you = stringResource(R.string.player_challenge_you, text)

    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
        Surface(
            modifier = Modifier.fillMaxWidth(0.85f).clearAndSetSemantics { contentDescription = you },
            color = MaterialTheme.colorScheme.primary,
            shape = MaterialTheme.shapes.large,
        ) {
            RichText(
                text = text,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
                style = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onPrimary),
            )
        }
    }
}

@Composable
private fun ChallengeEffects(
    move: ChallengeMove,
    content: ChallengeStepContent,
    names: ChallengeNames,
) {
    val moved =
        move.choice.effects.mapNotNull { effect ->
            content.meters.firstOrNull { it.id == effect.meter }?.takeIf { effect.change != 0L }?.let {
                ChallengeMeterState(
                    it,
                    0,
                    effect.change,
                )
            }
        }

    if (moved.isEmpty()) return

    FlowRow(
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {},
        horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.End),
    ) {
        moved.forEach { meter ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    names.fill(meter.meter.label),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                MeterChange(meter)
            }
        }
    }
}

@Composable
private fun MeterChange(meter: ChallengeMeterState) {
    if (meter.change == 0L) {
        Text(
            stringResource(R.string.player_challenge_no_change),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
        )
        return
    }

    val big = abs(meter.change) >= BIG_METER_CHANGE
    val up = meter.change > 0
    val good = up == (meter.meter.goodWhen == GoodWhen.HIGH)
    val color = if (good) MaterialTheme.colorScheme.tertiary else MaterialTheme.zoonk.warningText
    val (icon, words) =
        when {
            up && big -> R.drawable.ic_keyboard_double_arrow_up to R.string.player_challenge_much_higher
            up -> R.drawable.ic_arrow_upward to R.string.player_challenge_bit_higher
            big -> R.drawable.ic_keyboard_double_arrow_down to R.string.player_challenge_much_lower
            else -> R.drawable.ic_arrow_downward to R.string.player_challenge_bit_lower
        }

    Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(16.dp), tint = color)
        Text(stringResource(words), color = color, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
private fun ChallengeMeters(
    meters: List<ChallengeMeterState>,
    names: ChallengeNames,
    moved: Boolean,
) {
    if (meters.isEmpty()) return

    val label = stringResource(R.string.player_challenge_meters)

    Surface(
        modifier =
            Modifier.semantics {
                contentDescription = label
                liveRegion = LiveRegionMode.Polite
            },
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = MaterialTheme.shapes.large,
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            meters.forEach { meter ->
                val share by animateFloatAsState(meter.value / METER_MAX, label = "challenge meter")
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(names.fill(meter.meter.label), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                        if (moved) MeterChange(meter)
                    }
                    LinearProgressIndicator(
                        progress = { share },
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        trackColor = MaterialTheme.colorScheme.surface,
                        drawStopIndicator = {},
                    )
                }
            }
        }
    }
}

@Composable
private fun ChallengeDebriefView(
    content: ChallengeStepContent,
    names: ChallengeNames,
    moves: List<ChallengeMove>,
) {
    val debrief = challengeDebrief(content, moves)
    val outcome = content.endings.firstOrNull { it.id == moves.lastOrNull()?.choice?.next }?.outcome
    val top = remember { BringIntoViewRequester() }

    // It replaces the conversation, which left the screen scrolled to its end.
    LaunchedEffect(Unit) { top.bringIntoView() }

    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Column(Modifier.bringIntoViewRequester(top), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                stringResource(
                    if (content.variant ==
                        Variant.WHAT_IF
                    ) {
                        R.string.player_challenge_scenario_complete
                    } else {
                        R.string.player_challenge_complete
                    },
                ),
                modifier = Modifier.semantics { heading() },
                style = MaterialTheme.typography.headlineSmall,
            )
            outcome?.let {
                RichText(
                    text = names.fill(it),
                    style = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                )
            }
        }

        DebriefNotes(debrief, names)

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ChallengeLabel(stringResource(R.string.player_challenge_skills), heading = true)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                content.skills.forEach { skill ->
                    val practiced = skill.id == debrief.practice?.id
                    Surface(
                        color =
                            if (practiced) {
                                MaterialTheme.zoonk.warning.copy(
                                    alpha = 0.12f,
                                )
                            } else {
                                MaterialTheme.colorScheme.surfaceContainerHigh
                            },
                        shape = MaterialTheme.shapes.small,
                    ) {
                        Text(
                            names.fill(skill.name),
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                            color = if (practiced) MaterialTheme.zoonk.warningText else MaterialTheme.colorScheme.onSurface,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                }
            }
        }

        debrief.practice?.let { practice ->
            Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.large) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    ChallengeLabel(
                        stringResource(
                            R.string.player_challenge_practice,
                            names.fill(practice.name),
                            formatDuration(PRACTICE_SECONDS, currentLocale()),
                        ),
                        heading = true,
                    )
                    RichText(text = names.fill(practice.practice), style = MaterialTheme.typography.bodyLarge)
                }
            }
        }
    }
}

@Composable
private fun DebriefNotes(
    debrief: ChallengeDebrief,
    names: ChallengeNames,
) {
    if (debrief.good.isEmpty() && debrief.improve.isEmpty()) return

    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (debrief.good.isNotEmpty()) {
                NoteSection(stringResource(R.string.player_challenge_good), MaterialTheme.colorScheme.tertiary) {
                    debrief.good.forEach { note ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Icon(
                                painterResource(R.drawable.ic_check),
                                contentDescription = null,
                                modifier = Modifier.padding(top = 2.dp).size(18.dp),
                                tint = MaterialTheme.colorScheme.tertiary,
                            )
                            RichText(text = names.fill(note.text), style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
            if (debrief.good.isNotEmpty() && debrief.improve.isNotEmpty()) HorizontalDivider()
            if (debrief.improve.isNotEmpty()) {
                NoteSection(stringResource(R.string.player_challenge_improve), MaterialTheme.zoonk.warningText) {
                    debrief.improve.forEach { note ->
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            RichText(text = names.fill(note.text), style = MaterialTheme.typography.bodyLarge)
                            note.example?.let { example ->
                                Surface(color = MaterialTheme.zoonk.warning.copy(alpha = 0.1f), shape = MaterialTheme.shapes.large) {
                                    RichText(
                                        text = names.fill(example),
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                        style = MaterialTheme.typography.bodyLarge,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun NoteSection(
    title: String,
    color: Color,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ChallengeLabel(title, heading = true, color = color)
        content()
    }
}
