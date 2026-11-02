package com.zoonk.android.ui.characters

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.answerTone

/**
 * Main's `BuddyPicker`: the four buddies, each with its art, name and tagline, then an optional
 * name. An empty [name] keeps the buddy's own name in each language. [look] draws the cards (a new
 * buddy is white-belted and half-full); [glasses] are the picked buddy's.
 */
@Composable
fun BuddyPicker(
    kind: BuddyKind,
    name: String,
    onSelect: (BuddyKind) -> Unit,
    onNameChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    glasses: BuddyGlasses = BuddyGlasses.Round,
    look: BuddyLook = BuddyLook(energy = NEW_BUDDY_ENERGY),
) {
    val label = stringResource(R.string.buddy_picker_label)

    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        FlowRow(
            modifier = Modifier.selectableGroup().semantics { contentDescription = label },
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            maxItemsInEachRow = 2,
        ) {
            BuddyKind.entries.forEach { option ->
                BuddyOption(
                    look = look.copy(kind = option, glasses = if (option == kind) glasses else BuddyGlasses.Round),
                    selected = option == kind,
                    onSelect = { onSelect(option) },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        OutlinedTextField(
            value = name,
            onValueChange = { onNameChange(it.take(MAX_NAME_LENGTH)) },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(stringResource(R.string.buddy_picker_name)) },
            placeholder = { Text(buddyName(kind, null)) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
        )
    }
}

@Composable
private fun BuddyOption(
    look: BuddyLook,
    selected: Boolean,
    onSelect: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tone = answerTone(picked = selected, result = null)

    OutlinedCard(
        modifier = modifier.selectable(selected = selected, role = Role.RadioButton, onClick = onSelect),
        border = tone.border,
        colors = CardDefaults.outlinedCardColors(containerColor = tone.container),
    ) {
        Box(Modifier.fillMaxWidth()) {
            RadioButton(selected = selected, onClick = null, modifier = Modifier.align(Alignment.TopEnd).padding(8.dp))
            Column(
                modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 12.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Buddy(look = look, modifier = Modifier.size(ART_SIZE), expression = BuddyExpression.Happy)
                Text(
                    text = buddyName(look.kind, null),
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = stringResource(look.kind.tagline),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

private val BuddyKind.tagline: Int
    get() =
        when (this) {
            BuddyKind.Zu -> R.string.buddy_tagline_zu
            BuddyKind.Noodle -> R.string.buddy_tagline_noodle
            BuddyKind.Beep -> R.string.buddy_tagline_beep
            BuddyKind.Otto -> R.string.buddy_tagline_otto
        }

private val ART_SIZE = 80.dp
private const val MAX_NAME_LENGTH = 24
private const val NEW_BUDDY_ENERGY = 50.0
