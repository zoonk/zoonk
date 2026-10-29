package com.zoonk.android.feature.account

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.annotation.DrawableRes
import androidx.browser.auth.AuthTabIntent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.zoonk.android.BuildConfig
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.SessionState
import com.zoonk.android.navigation.AppLink
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.scaffold.TaskScaffold
import kotlinx.coroutines.launch
import kotlin.coroutines.cancellation.CancellationException

/**
 * Main's central login as a task: Google, Apple and an email code, then profile setup for a new
 * account. A guest signing in keeps its plan. It closes once an account is signed in and set up.
 */
@Composable
fun LoginScreen(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val session by app.sessions.state.collectAsStateWithLifecycle()
    val signedIn = (session as? SessionState.SignedIn)?.takeUnless { it.isGuest }

    LaunchedEffect(signedIn?.session, signedIn?.account?.user?.needsProfileSetup) {
        if (signedIn != null && !signedIn.account.user.needsProfileSetup) navigator.closeTask()
    }

    TaskScaffold(onClose = navigator::closeTask) { padding ->
        AuthColumn(padding) {
            when {
                signedIn == null -> SignIn(app, navigator)
                signedIn.account.user.needsProfileSetup -> ProfileSetup(app, signedIn)
            }
        }
    }
}

@Composable
private fun SignIn(
    app: AppContainer,
    navigator: AppNavigator,
) {
    val signIn = viewModel { SignInViewModel(app.account, app.sessions, createSavedStateHandle()) }
    val sentTo = signIn.codeSentTo

    BackHandler(enabled = sentTo != null, onBack = signIn::changeEmail)

    if (sentTo == null) Methods(signIn, navigator) else CodeEntry(signIn, sentTo)
}

@Composable
internal fun Methods(
    signIn: SignInViewModel,
    navigator: AppNavigator,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val work = signIn.work
    val apple =
        rememberLauncherForActivityResult(AuthTabIntent.AuthenticateUserResultContract()) { result ->
            val url = result.resultUri?.takeIf { result.resultCode == AuthTabIntent.RESULT_OK }?.toString()
            signIn.finishApple(url?.let(AppLink::appleCallback))
        }

    Title(stringResource(R.string.account_sign_in_title))
    if (signIn.appleExpired) Description(stringResource(R.string.account_sign_in_expired))

    if (BuildConfig.GOOGLE_SERVER_CLIENT_ID.isNotEmpty()) {
        ProviderButton(
            text = stringResource(R.string.account_continue_with_google),
            icon = R.drawable.ic_google_logo,
            tinted = false,
            isWorking = work == SignInWork.Google,
            enabled = work == null,
        ) {
            signIn.startGoogle()
            scope.launch {
                // Recreation cancels the sheet with this screen; the view model outlives it, so it's told.
                val token =
                    try {
                        requestGoogleIdToken(context, BuildConfig.GOOGLE_SERVER_CLIENT_ID)
                    } catch (e: CancellationException) {
                        signIn.finishGoogle(GoogleIdToken.Canceled)
                        throw e
                    }
                signIn.finishGoogle(token)
            }
        }
    }

    // Apple accepts only registered https return pages, so builds without a Services ID can't offer it.
    if (BuildConfig.APPLE_CLIENT_ID.isNotEmpty()) {
        ProviderButton(
            text = stringResource(R.string.account_continue_with_apple),
            icon = R.drawable.ic_apple_logo,
            tinted = true,
            isWorking = work == SignInWork.Apple,
            enabled = work == null,
        ) {
            scope.launch {
                val url = signIn.startApple() ?: return@launch
                AuthTabIntent.Builder().build().launch(apple, url.toUri(), APPLE_RETURN_HOST, APPLE_RETURN_PATH)
            }
        }
    }

    if (BuildConfig.GOOGLE_SERVER_CLIENT_ID.isNotEmpty() || BuildConfig.APPLE_CLIENT_ID.isNotEmpty()) {
        OrDivider()
    }

    OutlinedTextField(
        value = signIn.email,
        onValueChange = signIn::onEmailChange,
        modifier =
            Modifier
                .fillMaxWidth()
                .semantics { contentType = ContentType.EmailAddress },
        label = { Text(stringResource(R.string.account_email)) },
        placeholder = { Text(stringResource(R.string.account_email_placeholder)) },
        isError = signIn.failure == AccountFailure.InvalidEmail || signIn.failure == AccountFailure.DisposableEmail,
        singleLine = true,
        readOnly = work == SignInWork.SendCode,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, autoCorrectEnabled = false, imeAction = ImeAction.Go),
        keyboardActions = KeyboardActions(onGo = { signIn.sendCode() }),
    )

    signIn.failure?.let { FailureText(failureMessage(it)) }

    WorkingButton(stringResource(R.string.account_continue), isWorking = work == SignInWork.SendCode, onClick = signIn::sendCode)

    Agreement(navigator)
}

@Composable
internal fun CodeEntry(
    signIn: SignInViewModel,
    email: String,
) {
    val focus = remember { FocusRequester() }
    val work = signIn.work
    val needsNewCode = signIn.needsNewCode

    LaunchedEffect(Unit) { focus.requestFocus() }

    Title(stringResource(R.string.account_check_email_title))
    Description(stringResource(R.string.account_check_email_description, email))

    OutlinedTextField(
        value = signIn.code,
        onValueChange = signIn::onCodeChange,
        modifier =
            Modifier
                .fillMaxWidth()
                .focusRequester(focus)
                .semantics { contentType = ContentType.SmsOtpCode },
        label = { Text(stringResource(R.string.account_code_label)) },
        isError = signIn.failure != null,
        enabled = !needsNewCode,
        readOnly = work == SignInWork.CheckCode,
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword, imeAction = ImeAction.Go),
        keyboardActions = KeyboardActions(onGo = { signIn.checkCode() }),
    )

    signIn.failure?.let { FailureText(failureMessage(it)) }

    when (signIn.resend) {
        ResendStatus.Sent -> {
            Description(stringResource(R.string.account_new_code_sent, email))
        }

        ResendStatus.RateLimited -> {
            FailureText(stringResource(R.string.account_new_code_wait))
        }

        ResendStatus.Failed -> {
            FailureText(stringResource(R.string.account_new_code_failed))
        }

        null -> {}
    }

    if (needsNewCode) {
        WorkingButton(stringResource(R.string.account_send_new_code), isWorking = work == SignInWork.Resend, onClick = signIn::resendCode)
    } else {
        WorkingButton(stringResource(R.string.account_continue), isWorking = work == SignInWork.CheckCode, onClick = signIn::checkCode)
    }

    FlowRow {
        if (!needsNewCode) {
            Text(
                text = stringResource(R.string.account_did_not_get_it),
                modifier = Modifier.align(Alignment.CenterVertically),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            // Not while a code is checked: its answer would land on the new code's empty box.
            TextButton(onClick = signIn::resendCode, enabled = work == null) { Text(stringResource(R.string.account_send_again)) }
        }
        TextButton(onClick = signIn::changeEmail, enabled = work != SignInWork.CheckCode) {
            Text(stringResource(R.string.account_change_email))
        }
    }
}

@Composable
private fun ProfileSetup(
    app: AppContainer,
    signedIn: SessionState.SignedIn,
) {
    val form =
        viewModel(
            key = "setup:${signedIn.session.localId}",
        ) { ProfileFormViewModel(app.account, signedIn.account.user, createSavedStateHandle()) }

    ProfileSetupForm(form)
}

@Composable
internal fun ProfileSetupForm(form: ProfileFormViewModel) {
    Title(stringResource(R.string.account_setup_title))
    Description(stringResource(R.string.account_setup_description))
    ProfileFields(form, isSetup = true)
    ProfileSaveFailure(form)
    WorkingButton(stringResource(R.string.account_continue), isWorking = form.isSaving, enabled = form.canSave, onClick = { form.save() })
}

@Composable
internal fun AuthColumn(
    padding: PaddingValues,
    content: @Composable ColumnScope.() -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(padding)
                .consumeWindowInsets(padding)
                .imePadding()
                .verticalScroll(rememberScrollState()),
        contentAlignment = Alignment.TopCenter,
    ) {
        Column(
            modifier =
                Modifier
                    .widthIn(max = 480.dp)
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            content = content,
        )
    }
}

@Composable
private fun Title(text: String) {
    Text(text = text, modifier = Modifier.semantics { heading() }, style = MaterialTheme.typography.headlineSmall)
}

@Composable
private fun Description(text: String) {
    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
}

@Composable
private fun ProviderButton(
    text: String,
    @DrawableRes icon: Int,
    tinted: Boolean,
    isWorking: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.onSurface),
        contentPadding = ButtonDefaults.ButtonWithIconContentPadding,
    ) {
        if (isWorking) {
            CircularProgressIndicator(modifier = Modifier.size(ButtonDefaults.IconSize), strokeWidth = 2.dp)
        } else {
            Icon(
                painter = painterResource(icon),
                contentDescription = null,
                modifier = Modifier.size(ButtonDefaults.IconSize),
                tint = if (tinted) LocalContentColor.current else Color.Unspecified,
            )
        }
        Spacer(Modifier.size(ButtonDefaults.IconSpacing))
        Text(text)
    }
}

@Composable
private fun WorkingButton(
    text: String,
    isWorking: Boolean,
    onClick: () -> Unit,
    enabled: Boolean = true,
) {
    Button(onClick = onClick, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
        Text(text)
        if (isWorking) {
            Spacer(Modifier.size(ButtonDefaults.IconSpacing))
            CircularProgressIndicator(
                modifier = Modifier.size(ButtonDefaults.IconSize),
                color = LocalContentColor.current,
                strokeWidth = 2.dp,
            )
        }
    }
}

@Composable
private fun OrDivider() {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider(Modifier.weight(1f))
        Text(
            text = stringResource(R.string.account_or),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
        HorizontalDivider(Modifier.weight(1f))
    }
}

/** Main's footer, with its two links opening on the web. */
@Composable
private fun Agreement(navigator: AppNavigator) {
    val terms = stringResource(R.string.account_terms)
    val privacy = stringResource(R.string.account_privacy)
    val sentence = stringResource(R.string.account_agreement, terms, privacy)
    val linkStyle = TextLinkStyles(SpanStyle(textDecoration = TextDecoration.Underline))
    val text =
        buildAnnotatedString {
            append(sentence)
            listOf(terms to AppRoute.Terms, privacy to AppRoute.Privacy).forEach { (label, page) ->
                val start = sentence.indexOf(label)
                if (start >= 0) {
                    addLink(LinkAnnotation.Clickable(label, linkStyle) { navigator.open(page) }, start, start + label.length)
                }
            }
        }

    Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun failureMessage(failure: AccountFailure): String =
    stringResource(
        when (failure) {
            AccountFailure.InvalidEmail -> R.string.account_failure_invalid_email
            AccountFailure.DisposableEmail -> R.string.account_failure_disposable_email
            AccountFailure.BotDetected -> R.string.account_failure_bot_detected
            AccountFailure.Network -> R.string.account_failure_network
            AccountFailure.RateLimited -> R.string.account_failure_rate_limited
            AccountFailure.WrongCode -> R.string.account_failure_wrong_code
            AccountFailure.CodeExpired -> R.string.account_failure_code_expired
            AccountFailure.CodeLocked -> R.string.account_failure_code_locked
            else -> R.string.account_failure_sign_in
        },
    )

private const val APPLE_RETURN_HOST = "zoonk.com"
private const val APPLE_RETURN_PATH = "/auth/apple"
