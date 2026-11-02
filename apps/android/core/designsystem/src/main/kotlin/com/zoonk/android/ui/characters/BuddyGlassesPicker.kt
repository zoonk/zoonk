package com.zoonk.android.ui.characters

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.answerTone

/**
 * Main's glasses picker: every pair, worn by [look]'s buddy; the ones not earned yet are dimmed
 * with how to earn them and can't be picked.
 */
@Composable
fun BuddyGlassesPicker(
    look: BuddyLook,
    earned: Set<BuddyGlasses>,
    selected: BuddyGlasses,
    onSelect: (BuddyGlasses) -> Unit,
    modifier: Modifier = Modifier,
) {
    val label = stringResource(R.string.buddy_glasses)

    Column(
        modifier = modifier.selectableGroup().semantics { contentDescription = label },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        BuddyGlasses.entries.forEach { glasses ->
            val isEarned = glasses in earned
            val isSelected = glasses == selected
            val tone = answerTone(picked = isSelected, result = null)

            OutlinedCard(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .selectable(selected = isSelected, enabled = isEarned, role = Role.RadioButton) { onSelect(glasses) },
                border = tone.border,
                colors = CardDefaults.outlinedCardColors(containerColor = tone.container),
            ) {
                Row(
                    modifier = Modifier.padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Buddy(
                        look = look.copy(glasses = glasses),
                        modifier =
                            Modifier
                                .size(48.dp)
                                .alpha(if (isEarned) 1f else LOCKED_ALPHA),
                        expression = BuddyExpression.Happy,
                    )
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(stringResource(glasses.label), style = MaterialTheme.typography.titleSmall)
                        if (!isEarned) {
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    painterResource(R.drawable.ic_lock),
                                    contentDescription = null,
                                    modifier = Modifier.size(14.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Text(
                                    text = stringResource(glasses.howToEarn),
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                    RadioButton(selected = isSelected, onClick = null, enabled = isEarned)
                }
            }
        }
    }
}

val BuddyGlasses.label: Int
    get() =
        when (this) {
            BuddyGlasses.Round -> R.string.buddy_glasses_round
            BuddyGlasses.Star -> R.string.buddy_glasses_star
            BuddyGlasses.Aviator -> R.string.buddy_glasses_aviator
            BuddyGlasses.CatEye -> R.string.buddy_glasses_cat_eye
            BuddyGlasses.Retro -> R.string.buddy_glasses_retro
            BuddyGlasses.Monocle -> R.string.buddy_glasses_monocle
        }

/** What the buddy wears, as a row's line says it ("Round glasses", "A monocle"). */
val BuddyGlasses.worn: Int
    get() =
        when (this) {
            BuddyGlasses.Round -> R.string.buddy_glasses_worn_round
            BuddyGlasses.Star -> R.string.buddy_glasses_worn_star
            BuddyGlasses.Aviator -> R.string.buddy_glasses_worn_aviator
            BuddyGlasses.CatEye -> R.string.buddy_glasses_worn_cat_eye
            BuddyGlasses.Retro -> R.string.buddy_glasses_worn_retro
            BuddyGlasses.Monocle -> R.string.buddy_glasses_worn_monocle
        }

private val BuddyGlasses.howToEarn: Int
    get() =
        when (this) {
            BuddyGlasses.Star -> R.string.buddy_glasses_earn_star
            BuddyGlasses.Aviator -> R.string.buddy_glasses_earn_aviator
            BuddyGlasses.CatEye -> R.string.buddy_glasses_earn_cat_eye
            BuddyGlasses.Retro -> R.string.buddy_glasses_earn_retro
            BuddyGlasses.Monocle -> R.string.buddy_glasses_earn_monocle
            BuddyGlasses.Round -> R.string.buddy_glasses_earn_round
        }

private const val LOCKED_ALPHA = 0.4f
