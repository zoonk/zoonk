package com.zoonk.android.feature.onboarding.start

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.AttachedSource
import com.zoonk.android.feature.onboarding.Choice
import com.zoonk.android.feature.onboarding.ChoiceList
import com.zoonk.android.feature.onboarding.PickedFile
import com.zoonk.android.feature.onboarding.Refusal
import com.zoonk.android.feature.onboarding.WriteOutcome

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

@Composable
fun attachErrorMessage(outcome: WriteOutcome<*>): String =
    stringResource(
        when (val refusal = (outcome as? WriteOutcome.Refused)?.refusal) {
            is Refusal.Limit -> {
                when {
                    refusal.limit.tier == "plus" -> R.string.onboarding_attach_limit_plus
                    refusal.limit.period == "month" -> R.string.onboarding_attach_limit_month
                    else -> R.string.onboarding_attach_limit_day
                }
            }

            Refusal.SlowDown -> {
                R.string.onboarding_attach_slow_down
            }

            Refusal.Unsupported -> {
                R.string.onboarding_attach_unsupported
            }

            Refusal.SignUpRequired -> {
                R.string.onboarding_attach_sign_in
            }

            null -> {
                R.string.onboarding_attach_failed
            }
        },
    )

private enum class Pasting { Text, Link }

/**
 * Main's `AttachControls`: a file through the system picker, or pasted text or a link. Shared with
 * Today's research ask. [error] is the last attempt's, in words.
 */
@Composable
fun AttachControls(
    pending: Boolean,
    error: String?,
    onFile: (PickedFile) -> Unit,
    onText: (String) -> Unit,
    onLink: (String) -> Unit,
) {
    val resolver = LocalContext.current.contentResolver
    var pasting by rememberSaveable { mutableStateOf<Pasting?>(null) }
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            uri?.let { onFile(resolver.picked(it)) }
        }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AssistChip(
                onClick = { picker.launch(ACCEPTED_TYPES) },
                enabled = !pending,
                label = { Text(stringResource(R.string.onboarding_upload_file)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_upload), contentDescription = null, Modifier.size(18.dp)) },
            )
            FilterChip(
                selected = pasting == Pasting.Text,
                onClick = { pasting = if (pasting == Pasting.Text) null else Pasting.Text },
                enabled = !pending,
                label = { Text(stringResource(R.string.onboarding_paste_text)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_description), contentDescription = null, Modifier.size(18.dp)) },
            )
            FilterChip(
                selected = pasting == Pasting.Link,
                onClick = { pasting = if (pasting == Pasting.Link) null else Pasting.Link },
                enabled = !pending,
                label = { Text(stringResource(R.string.onboarding_paste_link)) },
                leadingIcon = { Icon(painterResource(R.drawable.ic_link), contentDescription = null, Modifier.size(18.dp)) },
            )
        }

        when (pasting) {
            Pasting.Text -> {
                PasteField(
                    label = stringResource(R.string.onboarding_your_text),
                    placeholder = stringResource(R.string.onboarding_paste_text_placeholder),
                    action = stringResource(R.string.onboarding_add_text),
                    pending = pending,
                    minLines = 4,
                    keyboardType = KeyboardType.Text,
                    onAdd = onText,
                )
            }

            Pasting.Link -> {
                PasteField(
                    label = stringResource(R.string.onboarding_link),
                    placeholder = stringResource(R.string.onboarding_paste_link_placeholder),
                    action = stringResource(R.string.onboarding_add_link),
                    pending = pending,
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
                Text(stringResource(R.string.onboarding_adding_material), style = MaterialTheme.typography.bodyMedium)
            }
        }

        if (error != null) {
            Text(
                error,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun PasteField(
    label: String,
    placeholder: String,
    action: String,
    pending: Boolean,
    minLines: Int,
    keyboardType: KeyboardType,
    onAdd: (String) -> Unit,
) {
    var value by rememberSaveable { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(
            value = value,
            onValueChange = { value = it },
            modifier = Modifier.fillMaxWidth(),
            label = { Text(label) },
            placeholder = { Text(placeholder) },
            minLines = minLines,
            maxLines = 10,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        )
        Button(onClick = { onAdd(value.trim()) }, enabled = !pending && value.isNotBlank()) { Text(action) }
    }
}

@Composable
internal fun AttachPanel(
    pending: Boolean,
    error: String?,
    onFile: (PickedFile) -> Unit,
    onText: (String) -> Unit,
    onLink: (String) -> Unit,
) {
    PanelCard {
        Text(stringResource(R.string.onboarding_study_material), fontWeight = FontWeight.Medium, style = MaterialTheme.typography.bodyLarge)
        Text(
            stringResource(R.string.onboarding_material_description),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        AttachControls(pending, error, onFile, onText, onLink)
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
        TextButton(onClick = onCreateAccount) { Text(stringResource(R.string.onboarding_create_account_short)) }
    }
}

@Composable
private fun PanelCard(content: @Composable () -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }
    }
}

/** Removing material takes its own button, never a tap on its name. */
@Composable
internal fun AttachedChips(
    items: List<AttachedSource>,
    onRemove: (String) -> Unit,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEach { item ->
            val title = item.title.ifBlank { stringResource(R.string.onboarding_your_text) }
            Surface(shape = MaterialTheme.shapes.extraLarge, color = MaterialTheme.colorScheme.surfaceContainerHigh) {
                Row(modifier = Modifier.padding(start = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(painterResource(R.drawable.ic_description), contentDescription = null, modifier = Modifier.size(18.dp))
                    Text(
                        title,
                        modifier = Modifier.padding(start = 6.dp).widthIn(max = 240.dp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    IconButton(onClick = { onRemove(item.id) }) {
                        Icon(
                            painterResource(R.drawable.ic_close),
                            contentDescription = stringResource(R.string.onboarding_remove_material, title),
                            modifier = Modifier.size(18.dp),
                        )
                    }
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
        Text(
            stringResource(R.string.onboarding_intent_title),
            modifier =
                Modifier.semantics {
                    heading()
                },
            style = MaterialTheme.typography.titleMedium,
        )
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
internal fun MaterialAnswer(outcome: WriteOutcome<com.zoonk.api.models.MaterialQuestionAnswer>) {
    val answer = (outcome as? WriteOutcome.Done)?.value
    if (answer == null) {
        val refusal = (outcome as? WriteOutcome.Refused)?.refusal
        Text(
            text =
                stringResource(
                    when (refusal) {
                        is Refusal.Limit -> {
                            when {
                                refusal.limit.tier == "plus" -> R.string.onboarding_question_limit_plus
                                refusal.limit.period == "month" -> R.string.onboarding_question_limit_month
                                else -> R.string.onboarding_question_limit_day
                            }
                        }

                        Refusal.SignUpRequired -> {
                            R.string.onboarding_question_sign_in
                        }

                        Refusal.SlowDown -> {
                            R.string.onboarding_question_slow_down
                        }

                        else -> {
                            R.string.onboarding_question_failed
                        }
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
                        val page = citation.page
                        val label =
                            when {
                                page == null -> {
                                    citation.title
                                }

                                citation.unit == com.zoonk.api.models.MaterialCitation.Unit.SLIDE -> {
                                    stringResource(
                                        R.string.onboarding_citation_slide,
                                        citation.title,
                                        page.toString(),
                                    )
                                }

                                else -> {
                                    stringResource(R.string.onboarding_citation_page, citation.title, page.toString())
                                }
                            }
                        com.zoonk.android.ui.components
                            .LabelChip(text = label, icon = R.drawable.ic_description)
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
