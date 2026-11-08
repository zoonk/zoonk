package com.zoonk.android.feature.ceremonies

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.certificates.CertificateAction
import com.zoonk.android.feature.certificates.CertificateActions
import com.zoonk.android.feature.certificates.CertificateName
import com.zoonk.android.feature.certificates.CertificateNameField
import com.zoonk.android.feature.certificates.CertificateNameModel
import com.zoonk.android.feature.certificates.CertificatePicture
import com.zoonk.android.feature.certificates.CertificatesPlusNotice
import com.zoonk.android.feature.certificates.LinkedInSheet
import com.zoonk.android.feature.certificates.LockedCertificate
import com.zoonk.android.feature.certificates.caption
import com.zoonk.android.feature.certificates.certificateLevelName
import com.zoonk.android.feature.certificates.certificateNameModel
import com.zoonk.android.feature.certificates.fileName
import com.zoonk.android.feature.certificates.naming
import com.zoonk.android.feature.certificates.pictureLabel
import com.zoonk.android.feature.certificates.pictureUrl
import com.zoonk.android.feature.certificates.rememberCertificateActions
import com.zoonk.android.feature.certificates.words
import com.zoonk.android.ui.components.Button
import com.zoonk.android.ui.components.ButtonIcon
import com.zoonk.android.ui.components.FullScreenDialog
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SnackbarHost
import com.zoonk.android.ui.components.TextButton
import com.zoonk.android.ui.components.celebrates
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.scaffold.PageWithSupportingPane
import com.zoonk.android.ui.theme.ZoonkMotion
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.OwnedCertificate
import kotlinx.coroutines.launch
import kotlin.time.TimeSource

/**
 * Main's certificate award moment, full screen before any milestone ceremony: the certificates a
 * write earned ([awarded], oldest first, so the newest shows on top and Share and LinkedIn act on
 * it). Their words come with the result; the pictures, links and the learner's current name come
 * from the learner's list, which a completion leaves stale. Closing marks them shown. One earned
 * without Plus shows locked, with the Plus notice: See Plus leaves without marking it shown, so it
 * plays again after the next task, unlocked once they subscribe. On an open book the certificate
 * takes the page before the fold, and the words and Continue the page after it.
 */
@Composable
fun CertificateCeremony(
    app: AppContainer,
    awarded: List<CertificateName>,
    onClose: () -> Unit,
    onSeePlus: () -> Unit,
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
    val owned = open.map { name -> list.value?.find { it.code == name.code } }
    // The list is newer than the result: the learner may have subscribed since.
    val names = open.zip(owned) { name, certificate -> certificate?.naming ?: name }
    val top = owned.lastOrNull()
    val shownAt = remember { timeSource.markNow() }
    var closing by remember { mutableStateOf(false) }
    // Above both layouts: folding moves the words between the one column and the page after the fold, and each keeps its scroll.
    val actions = rememberCertificateActions(app)
    val name = certificateNameModel(app, key = "certificate-name:${codes.joinToString()}")
    var linkedIn by rememberSaveable { mutableStateOf(false) }
    val columnScroll = rememberScrollState()
    val stageScroll = rememberScrollState()
    val wordsScroll = rememberScrollState()

    fun leave(seePlus: Boolean) {
        if (closing || shownAt.elapsedNow() < STEADY) return
        closing = true
        if (!seePlus) codes.forEach { code -> app.scope.launch { app.certificates.markShown(code) } }
        onClose()
        if (seePlus) onSeePlus()
    }

    fun close() = leave(seePlus = false)

    val wordsAndActions =
        @Composable { Words(names, top, actions, name, onSeePlus = { leave(seePlus = true) }) { linkedIn = true } }

    val continueButton =
        @Composable {
            Button(
                onClick = ::close,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
            ) { Text(stringResource(R.string.certificates_continue)) }
        }

    FullScreenDialog(onDismissRequest = ::close) {
        Surface(Modifier.fillMaxSize()) {
            PageWithSupportingPane(
                supportingPane = {
                    StagePage(wordsScroll, footer = continueButton) { wordsAndActions() }
                },
                modifier =
                    Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding()
                        .imePadding(),
                panesTouch = true,
                atFoldOnly = true,
            ) { wordsBeside ->
                if (wordsBeside) {
                    StagePage(stageScroll) { Stage(app, names, owned) }
                } else {
                    StagePage(columnScroll, footer = continueButton) {
                        Stage(app, names, owned)
                        Spacer(Modifier.height(32.dp))
                        wordsAndActions()
                    }
                }
            }
        }

        if (linkedIn && top != null && !top.locked) {
            LinkedInSheet(top, onCopy = actions::copy, onDismiss = { linkedIn = false })
        }
    }
}

/**
 * A page of the moment, its [content] centered and scrolling, with [footer] pinned under it and the
 * window's snackbars above the footer.
 */
@Composable
private fun StagePage(
    scroll: ScrollState,
    footer: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Box(Modifier.weight(1f).fillMaxWidth()) {
            Column(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(scroll)
                        .padding(horizontal = 16.dp, vertical = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                content = content,
            )
            if (footer != null) SnackbarHost(LocalSnackbarHostState.current, Modifier.align(Alignment.BottomCenter))
        }
        footer?.invoke()
    }
}

/** The newest certificate settles in, once, with the one before it offset behind; reduced motion shows it still. */
@Composable
private fun Stage(
    app: AppContainer,
    names: List<CertificateName>,
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
            Sheet(
                app,
                names[names.size - 2],
                owned[owned.size - 2],
                behind = true,
                Modifier.offset(x = BEHIND_OFFSET, y = -BEHIND_OFFSET),
            )
        }
        Sheet(app, names.last(), owned.last(), behind = false)
    }
}

/** The certificate's picture, or its locked card; the one [behind] is only seen. */
@Composable
private fun Sheet(
    app: AppContainer,
    name: CertificateName,
    certificate: OwnedCertificate?,
    behind: Boolean,
    modifier: Modifier = Modifier,
) {
    if (name.locked) {
        LockedCertificate(name, modifier.fillMaxWidth().then(if (behind) Modifier.clearAndSetSemantics {} else Modifier))
    } else {
        CertificatePicture(
            url = certificate?.pictureUrl,
            images = app.images,
            contentDescription = if (behind) null else certificate?.pictureLabel(),
            modifier = modifier.fillMaxWidth(),
        )
    }
}

@Composable
private fun Words(
    awarded: List<CertificateName>,
    top: OwnedCertificate?,
    actions: CertificateActions,
    name: CertificateNameModel,
    onSeePlus: () -> Unit,
    onAddToLinkedIn: () -> Unit,
) {
    val recipient = top?.recipientName

    Column(
        Modifier.widthIn(max = 480.dp).fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title(awarded),
            modifier = Modifier.semantics { heading() },
            style = MaterialTheme.typography.headlineMedium,
            textAlign = TextAlign.Center,
        )
        if (awarded.last().locked) {
            CertificatesPlusNotice(onSeePlus, Modifier.padding(top = 24.dp))
            return@Column
        }

        Text(
            text = line(awarded),
            modifier = Modifier.padding(top = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )

        when {
            // The list says whether the learner has a name; until it loads, nothing asks for one.
            top == null -> {}

            recipient == null || name.changing -> {
                CertificateNameField(recipient, name, Modifier.padding(top = 24.dp))
            }

            else -> {
                NameRow(recipient) { name.change(recipient) }
                Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    val fileName = top.fileName()
                    val caption = top.caption()
                    OutlinedButton(
                        busy = actions.busy == CertificateAction.Share,
                        onClick = { actions.share(top, fileName, caption) },
                        modifier = Modifier.weight(1f),
                        enabled = actions.busy == null,
                        leadingIcon = { ButtonIcon(R.drawable.ic_share) },
                    ) {
                        Text(stringResource(R.string.certificates_share))
                    }
                    OutlinedButton(
                        onClick = onAddToLinkedIn,
                        modifier = Modifier.weight(1f),
                        leadingIcon = { ButtonIcon(R.drawable.ic_north_east) },
                    ) {
                        Text(stringResource(R.string.certificates_add_to_linkedin))
                    }
                }
            }
        }

        Text(
            text = stringResource(if (awarded.size > 1) R.string.certificates_saved_several else R.string.certificates_saved_one),
            modifier = Modifier.padding(top = 14.dp),
            color = MaterialTheme.zoonk.faint,
            style = MaterialTheme.typography.bodySmall,
            textAlign = TextAlign.Center,
        )
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
            style = MaterialTheme.typography.bodyMedium,
        )
        TextButton(onClick = onChange, modifier = Modifier.semantics { contentDescription = changeLabel }) {
            Text(stringResource(R.string.certificates_change), Modifier.clearAndSetSemantics {})
        }
    }
}

@Composable
private fun title(awarded: List<CertificateName>): String {
    val only = awarded.singleOrNull() ?: return pluralStringResource(R.plurals.certificates_earned, awarded.size, awarded.size)
    return only.courseLevel?.let {
        stringResource(R.string.certificates_level_complete, certificateLevelName(it, only.cefrRange))
    }
        ?: stringResource(R.string.certificates_course_complete)
}

@Composable
private fun line(awarded: List<CertificateName>): String {
    val only =
        awarded.singleOrNull()
            ?: return stringResource(
                R.string.certificates_several_ready,
                formatList(awarded.reversed().map { it.words() }, currentLocale()),
            )
    return stringResource(R.string.certificates_course_ready, only.words())
}

private const val SETTLE_FROM = 0.92f
private const val SETTLE_MILLIS = 650
private val BEHIND_OFFSET = 12.dp
