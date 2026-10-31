package com.zoonk.android.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.characters.BuddyGlasses
import com.zoonk.android.ui.characters.BuddyGlassesPicker
import com.zoonk.android.ui.characters.BuddyKind
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.characters.BuddyPicker

/**
 * Main's buddy editor, in Preferences and on the buddy tab: its kind and name, and its glasses
 * where [earnedGlasses] are given (the buddy tab wears them from a sheet of their own). It stays
 * open until the change saves.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun BuddyEditor(
    look: BuddyLook,
    name: String,
    isSaving: Boolean,
    saveFailed: Boolean,
    onClose: () -> Unit,
    onSave: (BuddyKind, BuddyGlasses, String) -> Unit,
    earnedGlasses: Set<BuddyGlasses>? = null,
) {
    var kind by rememberSaveable { mutableStateOf(look.kind) }
    var glasses by rememberSaveable { mutableStateOf(look.glasses) }
    var typed by rememberSaveable { mutableStateOf(name) }

    ModalBottomSheet(onDismissRequest = onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(Modifier.navigationBarsPadding().imePadding()) {
            Column(
                modifier =
                    Modifier
                        .weight(1f, fill = false)
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(stringResource(R.string.settings_preferences_buddy), style = MaterialTheme.typography.titleLarge)
                BuddyPicker(
                    kind = kind,
                    name = typed,
                    onSelect = { kind = it },
                    onNameChange = { typed = it },
                    glasses = glasses,
                    look = look,
                )
                if (earnedGlasses != null) {
                    Text(stringResource(R.string.buddy_glasses), style = MaterialTheme.typography.titleMedium)
                    BuddyGlassesPicker(
                        look = look.copy(kind = kind),
                        earned = earnedGlasses,
                        selected = glasses,
                        onSelect = { glasses = it },
                    )
                }
            }
            HorizontalDivider()
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (saveFailed) {
                    Text(
                        text = stringResource(R.string.settings_preferences_save_failed),
                        modifier = Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                } else {
                    Spacer(Modifier.weight(1f))
                }
                TextButton(onClick = onClose) { Text(stringResource(R.string.settings_cancel)) }
                Button(onClick = { onSave(kind, glasses, typed) }, enabled = !isSaving) { Text(stringResource(R.string.settings_save)) }
            }
        }
    }
}
