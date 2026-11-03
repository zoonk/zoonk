package com.zoonk.android.feature.certificates

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.openWebPage
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.api.models.OwnedCertificate
import kotlinx.datetime.toJavaLocalDate

/**
 * Main's LinkedIn dialog: LinkedIn's add-to-profile form no longer fills itself in, so each field
 * has Copy beside it. The issue date has none: LinkedIn picks it from menus.
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
            stringResource(R.string.certificates_linkedin_name) to certificate.linkedInName(),
            stringResource(R.string.certificates_linkedin_organization) to stringResource(R.string.app_name),
            stringResource(R.string.certificates_linkedin_credential_id) to formatCertificateCode(certificate.code),
            stringResource(R.string.certificates_linkedin_credential_url) to certificate.url.toString(),
        )
    val issued = formatDate(certificate.completedOn.toJavaLocalDate(), currentLocale(), DateStyle.Month)

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 16.dp)) {
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
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

            Column(Modifier.padding(vertical = 8.dp)) {
                fields.take(2).forEach { (label, value) -> Field(label, value, onCopy) }
                Field(stringResource(R.string.certificates_linkedin_issue_date), issued, onCopy = null)
                fields.drop(2).forEach { (label, value) -> Field(label, value, onCopy) }
            }

            Button(
                onClick = { openWebPage(context, certificate.linkedInUrl.toString()) },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            ) {
                Icon(painterResource(R.drawable.ic_north_east), contentDescription = null)
                Text(stringResource(R.string.certificates_linkedin_open), Modifier.padding(start = 8.dp))
            }
        }
    }
}

/** LinkedIn's field name over its value, as the form names it. */
@Composable
private fun Field(
    label: String,
    value: String,
    onCopy: ((String) -> Unit)?,
) {
    val copyLabel = stringResource(R.string.certificates_copy_field, label)

    ListItem(
        headlineContent = { Text(value) },
        overlineContent = { Text(label) },
        trailingContent =
            onCopy?.let {
                {
                    OutlinedButton(onClick = { it(value) }, modifier = Modifier.semantics { contentDescription = copyLabel }) {
                        Icon(painterResource(R.drawable.ic_content_copy), contentDescription = null, modifier = Modifier.size(18.dp))
                        Text(stringResource(R.string.certificates_copy), Modifier.padding(start = 8.dp).clearAndSetSemantics {})
                    }
                }
            },
        colors = ListItemDefaults.colors(containerColor = Color.Transparent),
    )
}
