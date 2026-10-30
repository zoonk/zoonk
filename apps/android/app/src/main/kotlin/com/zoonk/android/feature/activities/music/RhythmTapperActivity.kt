package com.zoonk.android.feature.activities.music

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.indication
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.feature.activities.interaction
import com.zoonk.android.feature.player.model.ActivityAnswer
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.ActivityExpected
import com.zoonk.api.models.ActivityExpectedAnswer
import com.zoonk.api.models.LessonStepAnswerOneOf3AnswerOneOf11
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer.LessonStepAnswerOneOf3AnswerOneOf11Value as RhythmAnswerValue
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf33Value as RhythmTapperContent

val rhythmTapperRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_music_badge_tap_along, R.drawable.ic_back_hand) },
        canvas = { RhythmTapperActivity(it) },
    )

fun rhythmAnswer(
    tapTimesMs: List<Double>,
    deviceDelayMs: Double?,
): ActivityAnswer =
    RhythmAnswerValue(LessonStepAnswerOneOf3AnswerOneOf11(LessonStepAnswerOneOf3AnswerOneOf11.Kind.RHYTHM, tapTimesMs, deviceDelayMs))

private val ActivityAnswer?.rhythm: LessonStepAnswerOneOf3AnswerOneOf11? get() = (this as? RhythmAnswerValue)?.value

private val ActivityExpected?.rhythmTapTimes: List<Double>? get() =
    (interaction as? ActivityExpectedAnswer.RhythmWrapper)
        ?.value
        ?.tapTimesMs

@Composable
private fun RhythmTapperActivity(props: ActivityProps) {
    val content = (props.content as RhythmTapperContent).value.fields
    val fields =
        RhythmFields(
            content.pattern,
            content.rounds.toInt(),
            content.stepsPerBeat.toInt(),
            content.tempo.toInt(),
            content.toleranceMs.toInt(),
        )
    val device = rememberDeviceDelay()
    val audio = rememberMusicAudio()
    val check = rememberSoundCheck(audio)
    var isCheckingSound by rememberSaveable { mutableStateOf(false) }
    val deviceDelayMs = (device.delay as? DeviceDelay.Measured)?.ms?.toDouble()
    val run =
        rememberRhythmRun(audio, fields) { taps ->
            props.onAnswerChange(taps.takeIf { it.isNotEmpty() }?.let { rhythmAnswer(it, deviceDelayMs) })
        }

    DisposableEffect(audio, run, check) {
        audio.onInterruption = {
            run.stop()
            check.stop()
        }
        onDispose { audio.onInterruption = null }
    }

    ActivityCanvas(gap = 16.dp) {
        if (!props.isChecked && (device.delay == DeviceDelay.Unset || isCheckingSound)) {
            SoundCheckPanel(
                check = check,
                onDone = {
                    device.save(it)
                    isCheckingSound = false
                },
                onSkip = {
                    device.skip()
                    isCheckingSound = false
                },
            )
        } else {
            RhythmPractice(props, fields, run) {
                run.stop()
                check.stop()
                props.onAnswerChange(null)
                isCheckingSound = true
            }
        }
        MusicSoundNote(audio)
    }
}

@Composable
private fun RhythmPractice(
    props: ActivityProps,
    fields: RhythmFields,
    run: RhythmRun,
    onCheckSound: () -> Unit,
) {
    val pad = remember { FocusRequester() }
    val answer = props.answer.rhythm
    val taps = answer?.tapTimesMs.takeIf { run.phase == RhythmRun.Phase.Idle || run.phase == RhythmRun.Phase.Done }
    val results =
        taps?.let {
            Rhythm.results(fields.beatMs, answer?.deviceDelayMs, props.expected.rhythmTapTimes ?: fields.tapTimes, it, fields.toleranceMs)
        }

    RhythmStatus(fields, round = run.position?.round?.takeIf { run.phase == RhythmRun.Phase.Tapping })
    RhythmGrid(fields, run.position, results?.hits)

    if (!props.isChecked) {
        RhythmTapPad(
            isActive = run.isRunning,
            isCountingIn = run.phase == RhythmRun.Phase.CountIn,
            focus = pad,
            onTap = run::tap,
        )
    }

    if (!props.isChecked && !run.isRunning && run.phase != RhythmRun.Phase.Listening) {
        RhythmControls(
            hasTried = taps != null,
            enabled = !props.isLocked,
            onListen = { run.start(RhythmKind.Listen) },
            onStart = {
                props.onAnswerChange(null)
                run.start(RhythmKind.Tap)
                pad.requestFocus()
            },
            onCheckSound = onCheckSound,
        )
    }

    results?.let { RhythmFeedback(it) }
}

@Composable
private fun RhythmStatus(
    fields: RhythmFields,
    round: Int?,
) {
    Text(
        if (round == null) {
            pluralStringResource(R.plurals.activities_music_rhythm_rounds, fields.rounds, fields.tempo, fields.rounds)
        } else {
            stringResource(R.string.activities_music_rhythm_round, fields.tempo, round + 1, fields.rounds)
        },
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium.withTabularFigures(),
    )
}

/** Main's `RhythmGrid`: each round's steps left to right, hits filled, the step sounding now ringed, and each hit's result above it. */
@Composable
private fun RhythmGrid(
    fields: RhythmFields,
    position: RhythmPosition?,
    hits: List<HitResult>?,
) {
    val description =
        pluralStringResource(
            R.plurals.activities_music_rhythm_description,
            fields.pattern.length,
            fields.pattern.length,
            fields.stepsPerBeat,
            fields.hitSteps.joinToString(", ") { "${it + 1}" },
        )
    val hitsPerRound = fields.hitSteps.size

    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
        Column(Modifier.clearAndSetSemantics { contentDescription = description }, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(fields.rounds) { round ->
                Row(verticalAlignment = Alignment.Bottom) {
                    fields.pattern.forEachIndexed { step, symbol ->
                        val isHit = symbol == 'x'
                        val hit = if (isHit) hits?.getOrNull(round * hitsPerRound + fields.hitSteps.indexOf(step)) else null
                        if (step > 0 && step % fields.stepsPerBeat == 0) Spacer(Modifier.width(BEAT_GAP))
                        StepCell(isHit = isHit, isPlaying = position?.round == round && position.step == step, result = hit?.status)
                    }
                }
            }
            Row {
                repeat(fields.beats) { beat ->
                    if (beat > 0) Spacer(Modifier.width(BEAT_GAP))
                    Text(
                        "${beat + 1}",
                        Modifier.weight(fields.stepsPerBeat.toFloat()).padding(start = STEP_GAP),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.labelSmall.withTabularFigures(),
                    )
                }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                LegendItem(stringResource(R.string.activities_music_rhythm_hits)) {
                    Box(Modifier.width(12.dp).height(8.dp).background(MaterialTheme.zoonk.vizAccent, RoundedCornerShape(2.dp)))
                }
                LegendItem(stringResource(R.string.activities_music_on_time)) { ResultMark(TapStatus.OnTime) }
                LegendItem(stringResource(R.string.activities_music_early_or_late)) { ResultMark(TapStatus.Early) }
            }
        }
    }
}

@Composable
private fun RowScope.StepCell(
    isHit: Boolean,
    isPlaying: Boolean,
    result: TapStatus?,
) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(6.dp)

    Column(
        Modifier.weight(1f).padding(start = STEP_GAP),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(Modifier.height(8.dp), contentAlignment = Alignment.Center) { result?.let { ResultMark(it) } }
        Box(
            Modifier
                .fillMaxWidth()
                .height(32.dp)
                .clip(shape)
                .background(if (isHit) MaterialTheme.zoonk.vizAccent else colors.surface)
                .then(if (isPlaying) Modifier.border(2.dp, colors.onSurface, shape) else Modifier),
        )
    }
}

/** On time is a dot; early or late is a dash, since an amber dot means review; a miss is a ring. */
@Composable
private fun ResultMark(status: TapStatus) {
    val colors = MaterialTheme.colorScheme
    when (status) {
        TapStatus.OnTime -> Box(Modifier.size(8.dp).background(colors.tertiary, CircleShape))
        TapStatus.Early, TapStatus.Late -> Box(Modifier.width(10.dp).height(4.dp).background(MaterialTheme.zoonk.warning, CircleShape))
        TapStatus.Missed -> Box(Modifier.size(8.dp).border(2.dp, colors.error, CircleShape))
    }
}

@Composable
private fun LegendItem(
    text: String,
    mark: @Composable () -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        mark()
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
    }
}

/**
 * Main's `RhythmTapPad`: a tap counts when the finger lands, at the time the touch screen sensed it, and Space taps from a
 * keyboard. TalkBack's double tap taps too, though only as closely as its gesture allows.
 */
@Composable
private fun RhythmTapPad(
    isActive: Boolean,
    isCountingIn: Boolean,
    focus: FocusRequester,
    onTap: (Double) -> Unit,
) {
    val active by rememberUpdatedState(isActive)
    val tap by rememberUpdatedState(onTap)
    val source = remember { MutableInteractionSource() }
    val label = stringResource(if (isCountingIn) R.string.activities_music_get_ready else R.string.activities_music_tap_here)
    val configuration = LocalConfiguration.current
    val hasKeyboard =
        configuration.keyboard == Configuration.KEYBOARD_QWERTY && configuration.hardKeyboardHidden == Configuration.HARDKEYBOARDHIDDEN_NO

    Column(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 128.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .indication(source, ripple())
            .focusRequester(focus)
            .focusable()
            .onPreviewKeyEvent { event ->
                if (event.key != Key.Spacebar) return@onPreviewKeyEvent false
                if (active && event.type == KeyEventType.KeyDown && event.nativeKeyEvent.repeatCount == 0) {
                    tap(MusicClock.ofUptimeMillis(event.nativeKeyEvent.eventTime))
                }
                true
            }.pointerInput(Unit) {
                awaitEachGesture {
                    val down = awaitFirstDown()
                    if (!active) return@awaitEachGesture
                    tap(MusicClock.ofUptimeMillis(down.uptimeMillis))
                    val press = PressInteraction.Press(down.position)
                    source.tryEmit(press)
                    waitForUpOrCancellation()
                    source.tryEmit(PressInteraction.Release(press))
                }
            }.semantics(mergeDescendants = true) {
                role = Role.Button
                if (!isActive) disabled()
                onClick {
                    tap(MusicClock.now())
                    true
                }
            }.alpha(if (isActive) 1f else INACTIVE_ALPHA)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(painterResource(R.drawable.ic_back_hand), contentDescription = null, modifier = Modifier.size(28.dp))
        Text(label, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))
        if (hasKeyboard) {
            Text(
                stringResource(R.string.activities_music_or_space),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun RhythmControls(
    hasTried: Boolean,
    enabled: Boolean,
    onListen: () -> Unit,
    onStart: () -> Unit,
    onCheckSound: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onListen, enabled = enabled, contentPadding = ButtonDefaults.ButtonWithIconContentPadding) {
                ButtonIcon(R.drawable.ic_headphones)
                Text(stringResource(R.string.activities_music_listen_first))
            }
            Button(
                onClick = onStart,
                enabled = enabled,
                contentPadding = if (hasTried) ButtonDefaults.ButtonWithIconContentPadding else ButtonDefaults.ContentPadding,
            ) {
                if (hasTried) ButtonIcon(R.drawable.ic_replay)
                Text(stringResource(if (hasTried) R.string.activities_music_try_again else R.string.activities_music_start_tapping))
            }
        }
        TextButton(onClick = onCheckSound, enabled = enabled) {
            ButtonIcon(R.drawable.ic_timer)
            Text(stringResource(R.string.activities_music_check_sound_again))
        }
    }
}

@Composable
private fun ButtonIcon(icon: Int) {
    Icon(
        painterResource(icon),
        contentDescription = null,
        modifier = Modifier.padding(end = ButtonDefaults.IconSpacing).size(ButtonDefaults.IconSize),
    )
}

@Composable
private fun RhythmFeedback(results: RhythmResults) {
    val onTime = results.hits.count { it.status == TapStatus.OnTime }
    val worst = Rhythm.worstHit(results.hits)
    val tap = formatNumber((worst?.index ?: 0) + 1.0, currentLocale())
    val ms = kotlin.math.abs(worst?.value?.offsetMs ?: 0)
    val detail =
        when (worst?.value?.status) {
            TapStatus.Early -> stringResource(R.string.activities_music_tap_early, tap, ms)
            TapStatus.Late -> stringResource(R.string.activities_music_tap_late, tap, ms)
            TapStatus.Missed -> stringResource(R.string.activities_music_tap_missed, tap)
            TapStatus.OnTime, null -> null
        }
    val extra = results.extraTaps.takeIf { it > 0 }?.let { pluralStringResource(R.plurals.activities_music_extra_taps, it, it) }

    Text(
        listOfNotNull(
            pluralStringResource(R.plurals.activities_music_taps_on_time, results.hits.size, onTime, results.hits.size),
            detail,
            extra,
        ).joinToString(" "),
        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        style = MaterialTheme.typography.bodyMedium,
    )
}

/** Main's `RhythmDelayCalibration`: asked once per device, so rhythms here are timed fairly whatever the headphones. */
@Composable
private fun SoundCheckPanel(
    check: SoundCheck,
    onDone: (Int) -> Unit,
    onSkip: () -> Unit,
) {
    val pad = remember { FocusRequester() }
    val phase = check.phase
    val reading = (phase as? SoundCheck.Phase.Done)?.delayMs
    val status =
        when (phase) {
            SoundCheck.Phase.Idle -> {
                pluralStringResource(R.plurals.activities_music_sound_check_intro, SoundCheckSchedule.CLICKS, SoundCheckSchedule.CLICKS)
            }

            SoundCheck.Phase.CountIn -> {
                stringResource(R.string.activities_music_sound_check_listen)
            }

            is SoundCheck.Phase.Tapping -> {
                stringResource(R.string.activities_music_sound_check_tap, phase.click, SoundCheckSchedule.CLICKS)
            }

            is SoundCheck.Phase.Done -> {
                when {
                    phase.delayMs == null -> stringResource(R.string.activities_music_sound_check_failed)
                    phase.delayMs < ON_TIME_MS -> stringResource(R.string.activities_music_sound_check_on_time)
                    else -> stringResource(R.string.activities_music_sound_check_late, phase.delayMs)
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            stringResource(R.string.activities_music_sound_check_title),
            Modifier.semantics { heading() },
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
        )
        Text(
            status,
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }

    RhythmTapPad(isActive = check.isRunning, isCountingIn = phase == SoundCheck.Phase.CountIn, focus = pad, onTap = check::tap)

    if (!check.isRunning) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (reading == null) {
                Button(onClick = {
                    check.start()
                    pad.requestFocus()
                }) {
                    Text(
                        if (phase is SoundCheck.Phase.Done) {
                            stringResource(R.string.activities_music_try_again)
                        } else {
                            stringResource(R.string.activities_music_sound_check_start)
                        },
                    )
                }
                TextButton(onClick = onSkip) { Text(stringResource(R.string.activities_music_skip_for_now)) }
            } else {
                Button(onClick = { onDone(reading) }) { Text(stringResource(R.string.activities_music_continue)) }
            }
        }
    }
}

private const val INACTIVE_ALPHA = 0.6f
private const val ON_TIME_MS = 20
private val STEP_GAP = 2.dp
private val BEAT_GAP = 6.dp
