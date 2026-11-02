// Debug-only samples for reviewers: never shipped, so never translated.
@file:Suppress("HardcodedComposeText")

package com.zoonk.android.gallery

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AssistChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.zoonk.android.ui.characters.Buddy
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyCrop
import com.zoonk.android.ui.characters.BuddyExpression
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.CharacterActor
import com.zoonk.android.ui.characters.Trickster
import com.zoonk.android.ui.characters.TricksterAct
import com.zoonk.android.ui.characters.TricksterArt
import com.zoonk.android.ui.characters.TricksterDrawing
import com.zoonk.android.ui.characters.TricksterExpression
import com.zoonk.android.ui.characters.rememberBuddyActorState
import com.zoonk.android.ui.characters.rememberTricksterActorState
import com.zoonk.android.ui.components.Belt
import kotlinx.coroutines.launch

@Composable
internal fun Buddies() {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Samples("Kinds, adult") {
            BuddyKind.entries.forEach { Sample(it.name) { Buddy(BuddyLook(it, belt = Belt.Blue, energy = 60.0), Modifier.size(72.dp)) } }
        }
        Samples("Stages: white, orange and blue belts") {
            listOf(Belt.White, Belt.Orange, Belt.Blue).forEach { belt ->
                Sample(belt.name) { Buddy(BuddyLook(BuddyKind.Beep, belt = belt), Modifier.size(72.dp)) }
            }
        }
        Samples("Energy: napping, awake, glowing") {
            listOf(BuddyKind.Zu, BuddyKind.Beep).forEach { kind ->
                listOf(10.0, 50.0, 95.0).forEach { energy ->
                    Sample("$energy") { Buddy(BuddyLook(kind, belt = Belt.Green, energy = energy), Modifier.size(56.dp)) }
                }
            }
        }
        Samples("Expressions") {
            BuddyExpression.entries.forEach {
                Sample(it.name) { Buddy(BuddyLook(BuddyKind.Noodle, belt = Belt.Black), Modifier.size(64.dp), expression = it) }
            }
        }
        Samples("Glasses") {
            BuddyGlasses.entries.forEach { Sample(it.name) { Buddy(BuddyLook(BuddyKind.Otto, it, Belt.Purple), Modifier.size(64.dp)) } }
        }
        Samples("Faces at icon sizes: 24, 32 and 48 dp") {
            BuddyKind.entries.forEach { kind ->
                listOf(24, 32, 48).forEach { size ->
                    Buddy(BuddyLook(kind, belt = Belt.Yellow), Modifier.size(size.dp), crop = BuddyCrop.Face)
                }
            }
        }
    }
}

@Composable
internal fun Tricksters() {
    Samples("Sly, smug, defeated, with his sign") {
        TricksterExpression.entries.forEach { Sample(it.name) { Trickster(Modifier.size(72.dp), it) } }
        Sample("Challenge") { TricksterArt(Modifier.size(72.dp)) }
        Sample("Mark") { Trickster(Modifier.size(20.dp)) }
    }
}

@Composable
internal fun Acts() {
    val scope = rememberCoroutineScope()
    val buddy = rememberBuddyActorState()
    val trickster = rememberTricksterActorState()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(24.dp)) {
            BuddyActor(BuddyLook(BuddyKind.Zu, belt = Belt.Orange, energy = 70.0), Modifier.size(120.dp), state = buddy)
            // Without his sign, as main's stage plays him, so Defeated ends in the pose a learner sees.
            CharacterActor(
                remember { TricksterDrawing(holdsSign = false) },
                TricksterExpression.Sly,
                null,
                trickster,
                null,
                Modifier.size(120.dp),
            )
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            BuddyAct.entries.forEach { act -> AssistChip(onClick = { scope.launch { buddy.play(act) } }, label = { Text(act.name) }) }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf(
                "Blink" to TricksterAct.Blink,
                "Smug" to TricksterAct.Smug,
                "Back to sly" to TricksterAct.Sly,
                "Defeated" to TricksterAct.Defeat,
            ).forEach { (name, act) ->
                AssistChip(onClick = { scope.launch { trickster.play(act) } }, label = { Text(name) })
            }
        }
    }
}

@Composable
private fun Samples(
    title: String,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            itemVerticalAlignment = Alignment.Bottom,
        ) { content() }
    }
}

@Composable
private fun Sample(
    name: String,
    art: @Composable () -> Unit,
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        art()
        Text(name, style = MaterialTheme.typography.labelSmall)
    }
}
