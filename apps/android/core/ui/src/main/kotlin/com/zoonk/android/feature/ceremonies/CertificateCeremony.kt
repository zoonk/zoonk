package com.zoonk.android.feature.ceremonies

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.certificates.CertificateAction
import com.zoonk.android.feature.certificates.CertificateKind
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.feature.certificates.CertificateNameField
import com.zoonk.android.feature.certificates.CertificatePicture
import com.zoonk.android.feature.certificates.LinkedInSheet
import com.zoonk.android.feature.certificates.caption
import com.zoonk.android.feature.certificates.fileName
import com.zoonk.android.feature.certificates.languageWord
import com.zoonk.android.feature.certificates.pictureLabel
import com.zoonk.android.feature.certificates.pictureUrl
import com.zoonk.android.feature.certificates.rememberCertificateActions
import com.zoonk.android.feature.certificates.words
import com.zoonk.android.ui.components.FullScreenDialog
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.PendingLabel
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch
import kotlin.time.TimeSource

/**
 * Main's certificate award moment, full screen before any milestone ceremony: the certificates a
 * write earned ([awarded], oldest first, so the newest shows on top and Share and LinkedIn act on
 * it). Their words come with the result; the pictures, links and the learner's current name come
 * from the learner's list, which a completion leaves stale. Closing marks them shown; a guest's
 * [onCreateAccount] leaves them unshown, so the moment is still there on the way back.
 */
@Composable
fun CertificateCeremony(
    app: AppContainer,
    awarded: List<CertificateName>,
    onClose: () -> Unit,
    onCreateAccount: (() -> Unit)? = null,
    timeSource: TimeSource = TimeSource.Monotonic,
) {
    val open = remember(awarded) { awarded.filterNot { app.certificates.isClosed(it.code) } }
    if (open.isEmpty()) {
        LaunchedEffect(Unit) { onClose() }
        return
    }
    val codes = open.map { it.code }
    LaunchedEffect(codes) { app.certificates.awarded(codes) }

    val list by app.certificates.certificates.collectShown()
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val isGuest = (session as? SessionState.SignedIn)?.isGuest == true
    val owned = open.map { name -> list.value?.find { it.code == name.code } }
    val top = owned.lastOrNull()
    val shownAt = remember { timeSource.markNow() }
    var closing by remember { mutableStateOf(false) }

    fun close() {
        if (closing || shownAt.elapsedNow() < STEADY) return
        closing = true
        codes.forEach { code -> app.scope.launch { app.certificates.markShown(code) } }
        onClose()
    }

    FullScreenDialog(onDismissRequest = ::close) {
        Surface(Modifier.fillMaxSize()) {
            Column(
                Modifier
                    .fillMaxSize()
                    .statusBarsPadding()
                    .navigationBarsPadding()
                    .imePadding(),
            ) {
                Column(
                    modifier =
                        Modifier
                            .weight(1f)
                            .fillMaxWidth()
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Stage(app, owned)
                    Words(app, open, top, isGuest, onCreateAccount)
                }

                Button(
                    onClick = ::close,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
                ) { Text(stringResource(R.string.certificates_continue)) }
            }
        }
    }
}

/** The newest certificate settles in, once, with the one before it offset behind; reduced motion shows it still. */
@Composable
private fun Stage(
    app: AppContainer,
    owned: List<OwnedCertificate?>,
) {
    val play = celebrates()
    val scale = remember { Animatable(if (play) SETTLE_FROM else 1f) }
    val haptics = LocalHapticFeedback.current

    LaunchedEffect(Unit) {
        if (scale.value < 1f) {
            haptics.performHapticFeedback(HapticFeedbackType.Confirm)
            scale.animateTo(1f, tween(SETTLE_MILLIS, easing = ZoonkMotion.EaseSpring))
        }
    }

    Box(
        Modifier
            .widthIn(max = 600.dp)
            .fillMaxWidth()
            .padding(top = if (owned.size > 1) BEHIND_OFFSET else 0.dp, end = if (owned.size > 1) BEHIND_OFFSET else 0.dp)
            .graphicsLayer {
                scaleX = scale.value
                scaleY = scale.value
            },
    ) {
        if (owned.size > 1) {
            val behind = owned[owned.size - 2]
            CertificatePicture(
                url = behind?.pictureUrl,
                images = app.images,
                contentDescription = null,
                modifier = Modifier.fillMaxWidth().offset(x = BEHIND_OFFSET, y = -BEHIND_OFFSET),
            )
        }
        val top = owned.lastOrNull()
        CertificatePicture(
            url = top?.pictureUrl,
            images = app.images,
            contentDescription = top?.pictureLabel(),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun Words(
    app: AppContainer,
    awarded: List<CertificateName>,
    top: OwnedCertificate?,
    isGuest: Boolean,
    onCreateAccount: (() -> Unit)?,
) {
    val actions = rememberCertificateActions(app)
    var editing by rememberSaveable { mutableStateOf(false) }
    var linkedIn by rememberSaveable { mutableStateOf(false) }
    val recipient = top?.recipientName

    Column(
        Modifier.widthIn(max = 480.dp).fillMaxWidth().padding(top = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title(awarded),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
        )
        Text(
            text = if (isGuest) stringResource(R.string.certificates_guest_line) else line(awarded),
            modifier = Modifier.padding(top = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )

        when {
            isGuest -> {
                onCreateAccount?.let {
                    OutlinedButton(onClick = it, modifier = Modifier.padding(top = 24.dp)) {
                        Text(stringResource(R.string.certificates_create_account))
                    }
                }
            }

            // The list says whether the learner has a name; until it loads, nothing asks for one.
            top == null -> {}

            recipient == null || editing -> {
                CertificateNameField(
                    app = app,
                    current = recipient,
                    onSaved = { editing = false },
                    modifier = Modifier.padding(top = 24.dp),
                    onCancel = if (recipient == null) null else ({ editing = false }),
                )
            }

            else -> {
                NameRow(recipient) { editing = true }
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    val fileName = top.fileName()
                    val caption = top.caption()
                    OutlinedButton(
                        onClick = { actions.share(top, fileName, caption) },
                        modifier = Modifier.weight(1f),
                        enabled = actions.busy == null,
                    ) {
                        if (actions.busy != CertificateAction.Share) {
                            Icon(painterResource(R.drawable.ic_share), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                        }
                        PendingLabel(actions.busy == CertificateAction.Share, stringResource(R.string.certificates_share))
                    }
                    OutlinedButton(onClick = { linkedIn = true }, modifier = Modifier.weight(1f)) {
                        Icon(painterResource(R.drawable.ic_north_east), contentDescription = null, Modifier.size(ButtonDefaults.IconSize))
                        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
                        Text(stringResource(R.string.certificates_add_to_linkedin))
                    }
                }
            }
        }

        if (!isGuest) {
            Text(
                text = stringResource(if (awarded.size > 1) R.string.certificates_saved_several else R.string.certificates_saved_one),
                modifier = Modifier.padding(top = 14.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
                textAlign = TextAlign.Center,
            )
        }
    }

    if (linkedIn && top != null) {
        LinkedInSheet(top, onCopy = actions::copy, onDismiss = { linkedIn = false })
    }
}

/** "On your certificate: Ana Souza" with Change in the sentence, as main's link sits in it. */
@Composable
private fun NameRow(
    recipient: String,
    onChange: () -> Unit,
) {
    val changeLabel = stringResource(R.string.certificates_change_name)

    FlowRow(
        Modifier.padding(top = 16.dp),
        horizontalArrangement = Arrangement.Center,
        itemVerticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.certificates_on_your_certificate, recipient),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Normal),
        )
        TextButton(onClick = onChange, modifier = Modifier.semantics { contentDescription = changeLabel }) {
            Text(stringResource(R.string.certificates_change), Modifier.clearAndSetSemantics {})
        }
    }
}

@Composable
private fun title(awarded: List<CertificateName>): String {
    val only = awarded.singleOrNull() ?: return pluralStringResource(R.plurals.certificates_earned, awarded.size, awarded.size)
    return when (only.kind) {
        CertificateKind.Course -> stringResource(R.string.certificates_course_complete)
        CertificateKind.LanguageLevel -> stringResource(R.string.certificates_level_complete, only.level.orEmpty())
        CertificateKind.Placement -> stringResource(R.string.certificates_placement_row_title, only.languageWord(), only.level.orEmpty())
    }
}

@Composable
private fun line(awarded: List<CertificateName>): String {
    val only =
        awarded.singleOrNull()
            ?: return stringResource(
                R.string.certificates_several_ready,
                formatList(awarded.reversed().map { it.words() }, currentLocale()),
            )
    return when (only.kind) {
        CertificateKind.Course -> stringResource(R.string.certificates_course_ready, only.title.orEmpty())
        else -> stringResource(R.string.certificates_language_ready, only.languageWord(), only.level.orEmpty())
    }
}

private const val SETTLE_FROM = 0.92f
private const val SETTLE_MILLIS = 650
private val BEHIND_OFFSET = 12.dp
