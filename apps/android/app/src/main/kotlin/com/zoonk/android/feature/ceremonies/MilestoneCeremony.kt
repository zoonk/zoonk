package com.zoonk.android.feature.ceremonies

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.zoonk.android.R
import com.zoonk.android.ui.characters.ActReaction
import com.zoonk.android.ui.characters.BuddyAct
import com.zoonk.android.ui.characters.BuddyActor
import com.zoonk.android.ui.characters.BuddyExpression
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.BuddyStage
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.api.models.Milestone
import kotlinx.coroutines.launch
import java.util.UUID
import kotlin.time.Duration.Companion.milliseconds
import kotlin.time.TimeSource

/**
 * Main's `MilestoneCeremony`: a new belt, buddy stage or glasses, full screen, before the moment
 * that earned it. [onWearGlasses] null shows new glasses without offering to wear them. A badge
 * already shows on the checkpoint's result and in the logbook, so it gets no moment.
 */
@Composable
fun MilestoneCeremony(
    milestone: Milestone,
    buddy: BuddyLook,
    buddyName: String,
    onShown: (UUID) -> Unit,
    onClose: () -> Unit,
    onWearGlasses: (suspend (BuddyGlasses) -> Boolean)? = null,
) {
    LaunchedEffect(milestone.id) {
        onShown(milestone.id)
        if (milestone.kind == Milestone.Kind.BADGE) onClose()
    }
    if (milestone.kind == Milestone.Kind.BADGE) return

    val belt =
        Belt.entries
            .firstOrNull {
                it.name.equals(
                    milestone.key,
                    ignoreCase = true,
                )
            }.takeIf { milestone.kind == Milestone.Kind.BELT }
    val glasses = BuddyGlasses.entries.firstOrNull { it.key == milestone.key }.takeIf { milestone.kind == Milestone.Kind.GLASSES }
    val canWear = glasses != null && onWearGlasses != null
    val shownAt = remember { TimeSource.Monotonic.markNow() }
    val scope = rememberCoroutineScope()
    var closing by remember { mutableStateOf(false) }

    // A tap meant for the screen under it, as the ceremony appears, doesn't answer it.
    fun steady() = shownAt.elapsedNow() >= STEADY

    fun close() {
        if (closing) return
        closing = true
        onClose()
    }

    Dialog(
        onDismissRequest = ::close,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        Surface(Modifier.fillMaxSize()) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Column(
                    modifier =
                        Modifier
                            .weight(
                                1f,
                            ).fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 24.dp, vertical = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(32.dp, Alignment.CenterVertically),
                ) {
                    CeremonyArt(milestone.kind, buddy.copy(belt = belt ?: buddy.belt, glasses = glasses ?: buddy.glasses), buddyName, belt)
                    Column(
                        Modifier.widthIn(max = 384.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = ceremonyTitle(milestone, belt, glasses, buddyName),
                            modifier = Modifier.semantics { heading() },
                            style = MaterialTheme.typography.headlineMedium,
                            textAlign = TextAlign.Center,
                        )
                        Text(
                            text = ceremonyDetail(milestone, glasses, buddyName),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyLarge,
                            textAlign = TextAlign.Center,
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (canWear) {
                        FilledTonalButton(onClick = { if (steady()) close() }, modifier = Modifier.weight(1f)) {
                            Text(stringResource(R.string.ceremony_not_now))
                        }
                    }
                    Button(
                        onClick = {
                            if (!steady()) return@Button
                            if (glasses != null && onWearGlasses != null) {
                                scope.launch {
                                    onWearGlasses(glasses)
                                    close()
                                }
                            } else {
                                close()
                            }
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(stringResource(if (canWear) R.string.ceremony_wear else R.string.ceremony_continue))
                    }
                }
            }
        }
    }
}

/** White and Black would vanish behind the buddy, so they take the quiet fill. */
@Composable
private fun CeremonyArt(
    kind: Milestone.Kind,
    buddy: BuddyLook,
    buddyName: String,
    belt: Belt?,
) {
    val stage =
        if (belt == null || belt == Belt.White || belt == Belt.Black) {
            MaterialTheme.colorScheme.surfaceContainerHighest
        } else {
            belt.color.copy(alpha = STAGE_ALPHA)
        }

    Box(Modifier.size(240.dp), contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxSize().background(stage, CircleShape))
        BuddyActor(
            look = buddy,
            modifier = Modifier.size(168.dp),
            expression = BuddyExpression.Happy,
            reaction = ActReaction(if (kind == Milestone.Kind.GLASSES) BuddyAct.Proud else BuddyAct.Cheer, ZoonkMotion.BEAT_MILLIS),
            label = buddyName,
        )
    }
}

/** Fixed translated lines: nothing random, and never a comparison with anyone else. */
@Composable
private fun ceremonyTitle(
    milestone: Milestone,
    belt: Belt?,
    glasses: BuddyGlasses?,
    buddyName: String,
): String =
    when (milestone.kind) {
        Milestone.Kind.BELT -> {
            belt?.let { stringResource(R.string.ceremony_belt, stringResource(it.label)) }
                ?: stringResource(R.string.ceremony_new_belt)
        }

        Milestone.Kind.BUDDY_STAGE -> {
            stringResource(R.string.ceremony_grew_up, buddyName)
        }

        Milestone.Kind.GLASSES -> {
            stringResource(glassesCopy(glasses).first)
        }

        Milestone.Kind.BADGE -> {
            ""
        }
    }

@Composable
private fun ceremonyDetail(
    milestone: Milestone,
    glasses: BuddyGlasses?,
    buddyName: String,
): String =
    when (milestone.kind) {
        Milestone.Kind.BELT -> {
            milestone.beltStartBrainPower?.let {
                stringResource(
                    R.string.ceremony_belt_reached,
                    formatNumber(it.toDouble(), currentLocale()),
                )
            }
                ?: stringResource(R.string.ceremony_belt_detail)
        }

        Milestone.Kind.BUDDY_STAGE -> {
            val adult = BuddyStage.entries.firstOrNull { it.name.equals(milestone.key, ignoreCase = true) } == BuddyStage.Adult
            stringResource(if (adult) R.string.ceremony_stage_adult else R.string.ceremony_stage_young, buddyName)
        }

        Milestone.Kind.GLASSES -> {
            stringResource(glassesCopy(glasses).second)
        }

        Milestone.Kind.BADGE -> {
            ""
        }
    }

private fun glassesCopy(glasses: BuddyGlasses?): Pair<Int, Int> =
    when (glasses) {
        BuddyGlasses.Star -> R.string.ceremony_glasses_star to R.string.ceremony_glasses_star_detail
        BuddyGlasses.Aviator -> R.string.ceremony_glasses_aviator to R.string.ceremony_glasses_aviator_detail
        BuddyGlasses.CatEye -> R.string.ceremony_glasses_cat_eye to R.string.ceremony_glasses_cat_eye_detail
        BuddyGlasses.Retro -> R.string.ceremony_glasses_retro to R.string.ceremony_glasses_retro_detail
        BuddyGlasses.Monocle -> R.string.ceremony_glasses_monocle to R.string.ceremony_glasses_monocle_detail
        BuddyGlasses.Round, null -> R.string.ceremony_glasses_new to R.string.ceremony_glasses_new_detail
    }

private val STEADY = 500.milliseconds
private const val STAGE_ALPHA = 0.2f
