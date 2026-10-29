package com.zoonk.android.feature.session

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.Belt
import com.zoonk.android.ui.components.BeltTicks
import com.zoonk.android.ui.components.Meter
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.components.color
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.formatPercent
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.MistakePatternPracticeResultReachedLevel

/** A new belt level and the tenth of Energy a block reached, each null when it reached none. */
data class ReachedFacts(
    val level: MistakePatternPracticeResultReachedLevel?,
    val energy: Long?,
)

/**
 * Main's `ReachedMoment`. A new belt's level is left to its ceremony ([beltCeremony]), which shows
 * first, so it isn't said twice.
 */
@Composable
fun ReachedMoment(
    reached: ReachedFacts,
    beltCeremony: Boolean,
    delayMillis: Int,
    buddyName: String,
    modifier: Modifier = Modifier,
) {
    val level = reached.level.takeUnless { beltCeremony }
    val energy = reached.energy
    if (level == null && energy == null) return

    val celebrate = celebrates()

    Column(modifier) {
        level?.let { LevelReached(it, if (celebrate) delayMillis else null) }
        if (level != null && energy != null) HorizontalDivider()
        energy?.let {
            EnergyReached(
                it,
                buddyName,
                if (celebrate) {
                    delayMillis +
                        if (level !=
                            null
                        ) {
                            ZoonkMotion.BEAT_MILLIS
                        } else {
                            0
                        }
                } else {
                    null
                },
            )
        }
    }
}

@Composable
private fun ReachedRow(
    title: String,
    detail: String,
    mark: @Composable () -> Unit,
    bar: @Composable () -> Unit,
) {
    Column(Modifier.padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            mark()
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(detail, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
        }
        bar()
    }
}

@Composable
private fun LevelReached(
    level: MistakePatternPracticeResultReachedLevel,
    delayMillis: Int?,
) {
    val belt = Belt.entries.first { it.name.equals(level.color.value, ignoreCase = true) }
    val number = formatNumber(level.level.toDouble(), currentLocale())

    ReachedRow(
        title = stringResource(R.string.session_level_up),
        detail = stringResource(R.string.belt_level, stringResource(belt.label), number),
        mark = { LevelBadge(belt, number, delayMillis) },
        bar = { BeltTicks(belt, level.level.toInt(), fillsLast = delayMillis != null, delayMillis = delayMillis ?: 0) },
    )
}

@Composable
private fun LevelBadge(
    belt: Belt,
    number: String,
    delayMillis: Int?,
) {
    val color = belt.color
    val scale = remember { Animatable(if (delayMillis != null) 0f else 1f) }
    LaunchedEffect(delayMillis) {
        if (delayMillis != null) scale.animateTo(1f, tween(SETTLE_MILLIS, delayMillis, ZoonkMotion.EaseSpring))
    }

    Box(
        modifier =
            Modifier
                .size(40.dp)
                .graphicsLayer {
                    scaleX = scale.value
                    scaleY = scale.value
                }.background(color, CircleShape)
                .border(1.dp, MaterialTheme.colorScheme.onSurface.copy(alpha = EDGE_ALPHA), CircleShape)
                .clearAndSetSemantics {},
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = number,
            color = if (belt in LIGHT_BELTS) Color.Black.copy(alpha = LIGHT_BELT_TEXT_ALPHA) else Color.White,
            style = MaterialTheme.typography.titleMedium.withTabularFigures(),
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/** Its bar shows where Energy is now, never filling from empty: the moment doesn't know where it came from. */
@Composable
private fun EnergyReached(
    energy: Long,
    buddyName: String,
    delayMillis: Int?,
) {
    val share = formatPercent(energy / PERCENT, currentLocale())
    val max = energy >= MAX_ENERGY
    val scale = remember { Animatable(if (delayMillis != null) 0f else 1f) }
    LaunchedEffect(delayMillis) {
        if (delayMillis != null) scale.animateTo(1f, tween(SETTLE_MILLIS, delayMillis, ZoonkMotion.EaseFollow))
    }

    ReachedRow(
        title = stringResource(if (max) R.string.session_energy_max else R.string.session_energy_at, share),
        detail =
            when {
                max -> stringResource(R.string.session_energy_glowing_brightest, buddyName)
                energy == GLOWING_ENERGY -> stringResource(R.string.session_energy_glowing, buddyName)
                else -> stringResource(R.string.session_energy_detail)
            },
        mark = {
            Box(Modifier.size(40.dp), contentAlignment = Alignment.Center) {
                Icon(
                    painter = painterResource(R.drawable.ic_bolt),
                    contentDescription = null,
                    modifier =
                        Modifier.size(20.dp).graphicsLayer {
                            scaleX = scale.value
                            scaleY = scale.value
                        },
                    tint = MaterialTheme.zoonk.energy,
                )
            }
        },
        bar = { Meter((energy / PERCENT).toFloat(), color = MaterialTheme.zoonk.energy) },
    )
}

private val LIGHT_BELTS = setOf(Belt.White, Belt.Yellow, Belt.Orange)

private const val PERCENT = 100.0

/** Where the buddy starts glowing (core's `getBuddyEnergyState`). */
private const val GLOWING_ENERGY = 80L
private const val MAX_ENERGY = 100L
private const val SETTLE_MILLIS = 650
private const val EDGE_ALPHA = 0.1f
private const val LIGHT_BELT_TEXT_ALPHA = 0.8f
