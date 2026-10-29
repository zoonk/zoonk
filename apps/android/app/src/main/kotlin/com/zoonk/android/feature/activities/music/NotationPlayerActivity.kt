package com.zoonk.android.feature.activities.music

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import com.zoonk.android.ui.components.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.activities.ActivityBadge
import com.zoonk.android.feature.activities.ActivityCanvas
import com.zoonk.android.feature.activities.ActivityProps
import com.zoonk.android.feature.activities.ActivityRenderer
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf32Fields
import kotlin.math.roundToInt
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf32Value as NotationPlayerContent

val notationPlayerRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_music_badge_read_listen, R.drawable.ic_music_note) },
        canvas = { NotationPlayerActivity(it) },
    )

/** Main's `practiceTempos`: the tempo with two slower ones to practice at, rounded to 5 bpm. */
fun practiceTempos(tempo: Int): List<Int> =
    (SLOWER_SHARES.map { (tempo * it / TEMPO_STEP).roundToInt() * TEMPO_STEP } + tempo).distinct().sorted()

@Composable
private fun NotationPlayerActivity(props: ActivityProps) {
    val fields = (props.content as NotationPlayerContent).value.fields
    val tune = remember(fields.notation) { AbcTune.parse(fields.notation) }
    val audio = rememberMusicAudio()
    val playback = rememberNotationPlayback(audio)
    val labels = rememberMusicLabels()
    var showsTab by rememberSaveable { mutableStateOf(fields.view == PlayableLibraryStepAnyOfContentOneOf32Fields.View.TAB) }
    var tempo by rememberSaveable { mutableIntStateOf(fields.tempo.toInt()) }
    val bars = tune.outline
    val outline =
        bars
            .mapIndexed { index, notes ->
                stringResource(
                    R.string.activities_music_bar_notes,
                    index + 1,
                    notes.joinToString(", ") { labels.spoken(MusicNotes.pitchClassName(it)) },
                )
            }.joinToString(" ")

    ActivityCanvas(gap = 16.dp) {
        FlowRow(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalArrangement = Arrangement.spacedBy(12.dp),
            itemVerticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.padding(end = 12.dp)) {
                Text(
                    tune.title ?: stringResource(R.string.activities_music_melody),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                )
                tune.composer?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
            ViewToggle(showsTab) {
                playback.stop()
                showsTab = it
            }
        }

        NotationStaff(tune, showsTab, Modifier.semantics { contentDescription = outline }, playing = { playback.playing })

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            PlayButton(playback.isPlaying, enabled = tune.hasMusic) {
                if (playback.isPlaying) playback.stop() else playback.play(tune, tempo)
            }
            PlaybackProgress(playback.playing?.bar, bars.size, Modifier.weight(1f))
            TempoMenu(tempo, practiceTempos(fields.tempo.toInt())) {
                playback.stop()
                tempo = it
            }
        }

        MusicSoundNote(audio)
    }
}

@Composable
private fun ViewToggle(
    showsTab: Boolean,
    onChange: (Boolean) -> Unit,
) {
    val label = stringResource(R.string.activities_music_show_as)
    val views = listOf(false to R.string.activities_music_staff, true to R.string.activities_music_tab)

    SingleChoiceSegmentedButtonRow(Modifier.semantics { contentDescription = label }) {
        views.forEachIndexed { index, (isTab, text) ->
            SegmentedButton(
                selected = showsTab == isTab,
                onClick = { if (showsTab != isTab) onChange(isTab) },
                shape = SegmentedButtonDefaults.itemShape(index, views.size),
            ) {
                Text(stringResource(text))
            }
        }
    }
}

@Composable
private fun PlayButton(
    isPlaying: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    val label = stringResource(if (isPlaying) R.string.activities_music_stop else R.string.activities_music_play_melody)

    FilledIconButton(onClick = onClick, enabled = enabled) {
        Icon(
            painterResource(if (isPlaying) R.drawable.ic_stop_filled else R.drawable.ic_play_arrow),
            contentDescription = label,
            modifier = Modifier.size(24.dp),
        )
    }
}

@Composable
private fun PlaybackProgress(
    bar: Int?,
    bars: Int,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        LinearProgressIndicator(
            progress = { if (bar == null || bars == 0) 0f else (bar + 1f) / bars },
            modifier = Modifier.fillMaxWidth().height(6.dp).clearAndSetSemantics {},
            color = MaterialTheme.zoonk.vizSecondary,
            trackColor = MaterialTheme.colorScheme.outlineVariant,
            gapSize = 0.dp,
            drawStopIndicator = {},
        )
        Text(
            if (bar == null) {
                pluralStringResource(R.plurals.activities_music_bars, bars, bars)
            } else {
                stringResource(R.string.activities_music_bar_of, bar + 1, bars)
            },
            Modifier.semantics { liveRegion = LiveRegionMode.Polite },
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium.withTabularFigures(),
        )
    }
}

@Composable
private fun TempoMenu(
    tempo: Int,
    tempos: List<Int>,
    onChange: (Int) -> Unit,
) {
    var isOpen by remember { mutableStateOf(false) }
    val current = stringResource(R.string.activities_music_bpm, tempo)
    val label = stringResource(R.string.activities_music_tempo, current)

    Box {
        OutlinedButton(
            onClick = { isOpen = true },
            modifier =
                Modifier.semantics {
                    contentDescription = label
                    role = Role.DropdownList
                },
        ) {
            Text(current, style = MaterialTheme.typography.labelLarge.withTabularFigures())
            Icon(painterResource(R.drawable.ic_arrow_drop_down), contentDescription = null, modifier = Modifier.padding(start = 4.dp))
        }
        DropdownMenu(expanded = isOpen, onDismissRequest = { isOpen = false }) {
            tempos.forEach { option ->
                DropdownMenuItem(
                    text = {
                        Text(
                            stringResource(R.string.activities_music_bpm, option),
                            style = MaterialTheme.typography.bodyLarge.withTabularFigures(),
                        )
                    },
                    trailingIcon =
                        if (option == tempo) {
                            { Icon(painterResource(R.drawable.ic_check), contentDescription = null) }
                        } else {
                            null
                        },
                    modifier = Modifier.widthIn(min = 112.dp).semantics { selected = option == tempo },
                    onClick = {
                        isOpen = false
                        if (option != tempo) onChange(option)
                    },
                )
            }
        }
    }
}

private const val TEMPO_STEP = 5
private val SLOWER_SHARES = listOf(0.6, 0.8)
