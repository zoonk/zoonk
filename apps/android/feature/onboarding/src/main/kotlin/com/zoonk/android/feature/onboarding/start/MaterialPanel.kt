package com.zoonk.android.feature.onboarding.start

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.LocalMinimumInteractiveComponentSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.listSaver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.feature.onboarding.PickedFile
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.uploadLimit
import com.zoonk.android.ui.components.Eyebrow
import com.zoonk.android.ui.components.LimitNotice
import com.zoonk.android.ui.components.LimitSubject
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.OutlinedTextField
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.limitLifted
import com.zoonk.android.ui.components.materialCitationLabel
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.theme.ZoonkRadius
import com.zoonk.api.models.MaterialCitation

/** What the uploads route reads. */
private val ACCEPTED_TYPES =
    arrayOf(
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/markdown",
        "image/jpeg",
        "image/png",
        "image/webp",
    )

/** A refused or failed attempt: a cap is the shared dated notice (its day, Subscribe); anything else is a line. */
@Composable
private fun AttachFailure(
    failure: WriteOutcome<*>,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
) {
    val refusal = (failure as? WriteOutcome.Refused)?.refusal
    if (refusal is Refusal.Limit) {
        LimitNotice(refusal.limit.reached, LimitSubject.Uploads, onCreateAccount, onSubscribe)
        return
    }
    Text(
        stringResource(
            when (refusal) {
                Refusal.SlowDown -> R.string.onboarding_attach_slow_down
                Refusal.Unsupported -> R.string.onboarding_attach_unsupported
                Refusal.SignUpRequired -> R.string.onboarding_attach_sign_in
                Refusal.AlreadyRead -> R.string.onboarding_attach_already_read
                else -> R.string.onboarding_attach_failed
            },
        ),
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodyMedium,
    )
}

enum class Pasting { Text, Link }

/** What the attach controls are pasting and the words typed so far, held where they should outlive the controls. */
@Stable
class AttachDraft(
    pasting: Pasting? = null,
    text: String = "",
    link: String = "",
) {
    var pasting by mutableStateOf(pasting)
    var text by mutableStateOf(text)
    var link by mutableStateOf(link)

    fun clear() {
        pasting = null
        text = ""
        link = ""
    }

    companion object {
        val Saver =
            listSaver<AttachDraft, String>(
                save = { listOf(it.pasting?.name.orEmpty(), it.text, it.link) },
                restore = { (pasting, text, link) -> AttachDraft(Pasting.entries.find { it.name == pasting }, text, link) },
            )
    }
}

@Composable
fun rememberAttachDraft() = rememberSaveable(saver = AttachDraft.Saver) { AttachDraft() }

/** Shared with Today's research ask. [failure] is the last attempt's; [pendingText] says what [pending] waits for. */
@Composable
fun AttachControls(
    pending: Boolean,
    failure: WriteOutcome<*>?,
    onFile: (PickedFile) -> Unit,
    onText: (String) -> Unit,
    onLink: (String) -> Unit,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
    pendingText: String? = null,
    draft: AttachDraft = rememberAttachDraft(),
) {
    val resolver = LocalContext.current.contentResolver
    val pasting = draft.pasting
    val limit = failure.uploadLimit
    val enabled = !pending && (limit == null || limitLifted(limit.reached))
    val chipColors = FilterChipDefaults.filterChipColors(labelColor = MaterialTheme.colorScheme.onSurface)
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            uri?.let { onFile(resolver.picked(it)) }
        }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            AssistChip(
                onClick = { picker.launch(ACCEPTED_TYPES) },
                enabled = enabled,
                label = { Text(stringResource(R.string.onboarding_upload_file)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_upload), contentDescription = null, Modifier.size(18.dp)) },
            )
            FilterChip(
                selected = pasting == Pasting.Text,
                onClick = { draft.pasting = if (pasting == Pasting.Text) null else Pasting.Text },
                enabled = enabled,
                colors = chipColors,
                label = { Text(stringResource(R.string.onboarding_paste_text)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_description), contentDescription = null, Modifier.size(18.dp)) },
            )
            FilterChip(
                selected = pasting == Pasting.Link,
                onClick = { draft.pasting = if (pasting == Pasting.Link) null else Pasting.Link },
                enabled = enabled,
                colors = chipColors,
                label = { Text(stringResource(R.string.onboarding_paste_link)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_link), contentDescription = null, Modifier.size(18.dp)) },
            )
        }

        when (pasting) {
            Pasting.Text -> {
                PasteField(
                    value = draft.text,
                    onValueChange = { draft.text = it },
                    label = stringResource(R.string.onboarding_your_text),
                    placeholder = stringResource(R.string.onboarding_paste_text_placeholder),
                    action = stringResource(R.string.onboarding_add_text),
                    enabled = enabled,
                    minLines = 4,
                    keyboardType = KeyboardType.Text,
                    onAdd = onText,
                )
            }

            Pasting.Link -> {
                PasteField(
                    value = draft.link,
                    onValueChange = { draft.link = it },
                    label = stringResource(R.string.onboarding_link),
                    placeholder = stringResource(R.string.onboarding_paste_link_placeholder),
                    action = stringResource(R.string.onboarding_add_link),
                    enabled = enabled,
                    minLines = 1,
                    keyboardType = KeyboardType.Uri,
                    onAdd = onLink,
                )
            }

            null -> {}
        }

        if (pending) {
            Row(
                modifier = Modifier.semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                Text(pendingText ?: stringResource(R.string.onboarding_adding_material), style = MaterialTheme.typography.bodyMedium)
            }
        }

        if (failure != null) {
            Box(Modifier.semantics { liveRegion = LiveRegionMode.Polite }) { AttachFailure(failure, onCreateAccount, onSubscribe) }
        }
    }
}

@Composable
private fun PasteField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    action: String,
    enabled: Boolean,
    minLines: Int,
    keyboardType: KeyboardType,
    onAdd: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            label = label,
            placeholder = { Text(placeholder) },
            minLines = minLines,
            maxLines = 10,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        )
        OutlinedButton(onClick = { onAdd(value.trim()) }, enabled = enabled && value.isNotBlank()) { Text(action) }
    }
}

@Composable
internal fun AttachPanel(
    pending: Boolean,
    failure: WriteOutcome<*>?,
    onFile: (PickedFile) -> Unit,
    onText: (String) -> Unit,
    onLink: (String) -> Unit,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
) {
    PanelCard {
        Text(stringResource(R.string.onboarding_study_material), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
        Text(
            stringResource(R.string.onboarding_material_description),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        AttachControls(pending, failure, onFile, onText, onLink, onCreateAccount, onSubscribe)
    }
}

@Composable
internal fun SignUpPrompt(onCreateAccount: () -> Unit) {
    PanelCard {
        Text(stringResource(R.string.onboarding_study_material), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
        Text(
            stringResource(R.string.onboarding_material_sign_up),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        TextButton(onClick = onCreateAccount) { Text(stringResource(R.string.onboarding_create_account)) }
    }
}

@Composable
private fun PanelCard(content: @Composable () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

/**
 * Removing material takes its own button, never a tap on its name; material that can't be read anymore ([unreadable]) is marked,
 * and a [limitReached] says why no more can be added.
 */
@Composable
internal fun AttachedChips(
    items: List<AttachedSource>,
    unreadable: Set<String>,
    limitReached: Int?,
    onRemove: (String) -> Unit,
) {
    val marked = items.filter { it.id in unreadable }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items.forEach { item -> AttachedChip(item, item in marked, onRemove) }
        }
        if (marked.isNotEmpty()) {
            Text(
                marked.singleOrNull()?.let { stringResource(R.string.onboarding_material_unreadable_one, materialTitle(it)) }
                    ?: stringResource(R.string.onboarding_material_unreadable_some),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        if (limitReached != null) {
            Text(
                stringResource(R.string.onboarding_material_limit, formatNumber(limitReached.toDouble(), currentLocale())),
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun materialTitle(item: AttachedSource) = item.title.ifBlank { stringResource(R.string.onboarding_your_text) }

@Composable
private fun AttachedChip(
    item: AttachedSource,
    unreadable: Boolean,
    onRemove: (String) -> Unit,
) {
    val title = materialTitle(item)
    val state = stringResource(R.string.onboarding_material_unreadable_state)
    val colors = MaterialTheme.colorScheme
    Surface(
        shape = RoundedCornerShape(ZoonkRadius.md),
        color = if (unreadable) colors.errorContainer else colors.surfaceContainerHigh,
        contentColor = if (unreadable) colors.onErrorContainer else colors.onSurface,
    ) {
        Row(
            modifier = Modifier.padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                painterResource(if (unreadable) R.drawable.ic_error else R.drawable.ic_description),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = LocalContentColor.current,
            )
            Text(
                title,
                modifier = Modifier.widthIn(max = 240.dp).semantics { if (unreadable) stateDescription = state },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodyMedium,
            )
            // Main's 28dp ✕ keeps the chip at main's height; a tap anywhere in the 48dp target around it still removes.
            CompositionLocalProvider(LocalMinimumInteractiveComponentSize provides Dp.Unspecified) {
                IconButton(onClick = { onRemove(item.id) }, modifier = Modifier.size(28.dp)) {
                    Icon(
                        painterResource(R.drawable.ic_close),
                        contentDescription = stringResource(R.string.onboarding_remove_material, title),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
internal fun MaterialIntentChoice(
    value: MaterialIntent?,
    onChange: (MaterialIntent) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.onboarding_intent_title))
        ChoiceList(
            choices =
                listOf(
                    Choice(
                        MaterialIntent.Exam,
                        stringResource(R.string.onboarding_intent_exam),
                        stringResource(R.string.onboarding_intent_exam_description),
                    ),
                    Choice(
                        MaterialIntent.Understand,
                        stringResource(R.string.onboarding_intent_understand),
                        stringResource(R.string.onboarding_intent_understand_description),
                    ),
                    Choice(
                        MaterialIntent.Questions,
                        stringResource(R.string.onboarding_intent_questions),
                        stringResource(R.string.onboarding_intent_questions_description),
                    ),
                ),
            value = value,
            label = stringResource(R.string.onboarding_intent_label),
            onChange = onChange,
        )
    }
}

data class MaterialTurn(
    val question: String,
    val outcome: WriteOutcome<com.zoonk.api.models.MaterialQuestionAnswer>,
)

@Composable
internal fun MaterialAnswer(
    outcome: WriteOutcome<com.zoonk.api.models.MaterialQuestionAnswer>,
    onCreateAccount: () -> Unit,
    onSubscribe: () -> Unit,
) {
    val answer = (outcome as? WriteOutcome.Done)?.value
    if (answer == null) {
        val refusal = (outcome as? WriteOutcome.Refused)?.refusal
        if (refusal is Refusal.Limit) {
            LimitNotice(refusal.limit.reached, LimitSubject.Questions, onCreateAccount, onSubscribe)
            return
        }
        Text(
            stringResource(
                when (refusal) {
                    Refusal.SignUpRequired -> R.string.onboarding_question_sign_in
                    Refusal.SlowDown -> R.string.onboarding_question_slow_down
                    else -> R.string.onboarding_question_failed
                },
            ),
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }

    OutlinedCard {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(answer.answer, style = MaterialTheme.typography.bodyLarge)
            if (answer.citations.isNotEmpty()) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    answer.citations.forEach { citation ->
                        val label = materialCitationLabel(citation.title, citation.page, citation.unit == MaterialCitation.Unit.SLIDE)
                        Eyebrow(text = label, icon = R.drawable.ic_description)
                    }
                }
            }
        }
    }
}

private fun ContentResolver.picked(uri: Uri): PickedFile {
    var name = uri.lastPathSegment ?: "file"
    var size: Long? = null
    query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
            cursor.getString(0)?.let { name = it }
            if (!cursor.isNull(1)) size = cursor.getLong(1)
        }
    }
    return PickedFile(name = name, mimeType = getType(uri), size = size, open = {
        openInputStream(uri)
            ?: throw java.io.IOException("Unreadable $uri")
    })
}
