package com.zoonk.android.feature.certificates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.openWebPage
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonSize
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.theme.GeistMono
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.delay
import kotlinx.datetime.toJavaLocalDate
import kotlin.time.Duration.Companion.seconds

/**
 * Main's LinkedIn dialog: LinkedIn's add-to-profile form no longer fills itself in, so each field
 * has Copy beside it, which says Copied for a moment, as main's does. The issue date has none:
 * LinkedIn picks it from menus.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LinkedInSheet(
    certificate: OwnedCertificate,
    onCopy: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val fields =
        listOf(
            stringResource(R.string.certificates_linkedin_name) to certificate.naming.words(),
            stringResource(R.string.certificates_linkedin_organization) to stringResource(R.string.app_name),
            stringResource(R.string.certificates_linkedin_credential_id) to formatCertificateCode(certificate.code),
            stringResource(R.string.certificates_linkedin_credential_url) to certificate.url.toString(),
        )
    val issued = formatDate(certificate.completedOn.toJavaLocalDate(), currentLocale(), DateStyle.Month)
    var copied by remember { mutableStateOf<String?>(null) }
    var copies by remember { mutableIntStateOf(0) }
    val copy = { label: String, value: String ->
        onCopy(value)
        copied = label
        copies++
    }

    LaunchedEffect(copies) {
        if (copied != null) {
            delay(COPIED_FOR)
            copied = null
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 16.dp)) {
            Column(Modifier.padding(horizontal = LIST_ITEM_INSET), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    stringResource(R.string.certificates_linkedin_title),
                    Modifier.semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    stringResource(R.string.certificates_linkedin_description),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            // Main's list group: the issue date between the organization and the credential, as LinkedIn's form asks.
            Column(Modifier.padding(vertical = 8.dp)) {
                fields.take(2).forEach { (label, value) ->
                    Field(label, value, copied == label) { copy(label, value) }
                    ListDivider()
                }
                Field(stringResource(R.string.certificates_linkedin_issue_date), issued, copied = false, onCopy = null)
                fields.drop(2).forEach { (label, value) ->
                    ListDivider()
                    Field(label, value, copied == label, mono = true) { copy(label, value) }
                }
            }

            Button(
                onClick = { openWebPage(context, certificate.linkedInUrl.toString()) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = LIST_ITEM_INSET),
                size = ButtonSize.Large,
            ) {
                Text(stringResource(R.string.certificates_linkedin_open))
                Icon(painterResource(R.drawable.ic_north_east), contentDescription = null, Modifier.padding(start = 8.dp).size(18.dp))
            }
        }
    }
}

/** Main's `FieldRow`: LinkedIn's field name over its value, as the form names it, with Copy at its end; ids in mono. */
@Composable
private fun Field(
    label: String,
    value: String,
    copied: Boolean,
    mono: Boolean = false,
    onCopy: (() -> Unit)?,
) {
    val copyLabel = stringResource(R.string.certificates_copy_field, label)
    val copiedLabel = stringResource(R.string.certificates_copied)

    ListRow(
        headline = {
            Column {
                Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                Text(value, fontFamily = if (mono) GeistMono else null)
            }
        },
        trailing =
            onCopy?.let {
                {
                    OutlinedButton(
                        onClick = it,
                        modifier =
                            Modifier.semantics {
                                contentDescription = copyLabel
                                if (copied) stateDescription = copiedLabel
                            },
                        size = ButtonSize.Small,
                    ) {
                        Icon(
                            painterResource(if (copied) R.drawable.ic_check else R.drawable.ic_content_copy),
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                        )
                        Text(
                            if (copied) copiedLabel else stringResource(R.string.certificates_copy),
                            Modifier.padding(start = 6.dp).clearAndSetSemantics {},
                        )
                    }
                }
            },
    )
}

private val COPIED_FOR = 2.seconds
