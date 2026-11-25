package com.zoonk.android.feature.account

import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.foundation.text.input.setTextAndPlaceCursorAtEnd
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.text.TextRange
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.android.data.Visit
import com.zoonk.api.models.MeUser
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

enum class UsernameStatus { Idle, Checking, Available, Taken, Invalid }

/**
 * A name and a username, as main's profile setup and profile page edit them: the username is
 * checked as it's typed, and saving has the last word.
 */
@OptIn(SavedStateHandleSaveableApi::class)
class ProfileFormViewModel(
    private val account: AccountStore,
    user: MeUser,
    handle: SavedStateHandle,
) : ViewModel() {
    private var savedName = user.name.trim()
    private var savedUsername = user.username.orEmpty()

    val nameField = handle.saveable(key = "nameField", saver = TextFieldState.Saver) { TextFieldState(user.name, TextRange.Zero) }
    val name get() = nameField.text.toString()
    val usernameField = handle.saveable(key = "usernameField", saver = TextFieldState.Saver) { TextFieldState(savedUsername) }

    /** What the field holds as core keeps it (`normalizeUsername`), so the field never rewrites the learner's typing. */
    val username get() =
        usernameField.text
            .trim()
            .toString()
            .lowercase()
    var usernameStatus by mutableStateOf(UsernameStatus.Idle)
        private set
    var isSaving by mutableStateOf(false)
        private set

    /** The last save went through and nothing changed since. */
    var isSaved by mutableStateOf(false)
        private set

    val visit = Visit()

    private val saveFailure = visit.outcome<AccountFailure>()

    /** Why the save didn't go through, on this visit. */
    val failure get() = saveFailure.value

    /** A save that went through on this visit, which the page says once in the app's snackbars. */
    val saved = visit.outcome<Unit>()

    private var check: Job? = null

    val isChanged: Boolean
        get() = name.trim() != savedName || username != savedUsername

    val isNameTooLong: Boolean
        get() = isNameChangeTooLong(name, savedName)

    private var submitted by mutableStateOf(false)
    val showNameRequired: Boolean get() = submitted && name.isBlank()
    val showUsernameRequired: Boolean get() = submitted && username.isBlank()
    val canContinue: Boolean get() = !isSaving

    fun continueSetup() {
        submitted = true
        save()
    }

    val canSave: Boolean
        get() =
            !isSaving && name.isNotBlank() && !isNameTooLong && isUsernameSyntaxValid(username) &&
                usernameStatus != UsernameStatus.Taken && usernameStatus != UsernameStatus.Checking

    init {
        viewModelScope.launch(start = CoroutineStart.UNDISPATCHED) {
            snapshotFlow { name }.drop(1).collect {
                saveFailure.clear()
                isSaved = false
            }
        }
        viewModelScope.launch(start = CoroutineStart.UNDISPATCHED) {
            snapshotFlow { username }.collect(::checkUsername)
        }
        if (username.isEmpty()) {
            viewModelScope.launch {
                val suggestion = account.usernameSuggestion() ?: return@launch
                if (username.isEmpty()) usernameField.setTextAndPlaceCursorAtEnd(suggestion)
            }
        }
    }

    private fun checkUsername(normalized: String) {
        saveFailure.clear()
        isSaved = false
        check?.cancel()
        usernameStatus =
            when {
                normalized == savedUsername -> UsernameStatus.Idle
                !isUsernameSyntaxValid(normalized) -> if (normalized.isEmpty()) UsernameStatus.Idle else UsernameStatus.Invalid
                else -> UsernameStatus.Checking
            }
        if (usernameStatus != UsernameStatus.Checking) return
        check =
            viewModelScope.launch {
                delay(USERNAME_CHECK_DELAY_MS)
                usernameStatus =
                    when (account.isUsernameAvailable(normalized)) {
                        true -> UsernameStatus.Available
                        false -> UsernameStatus.Taken
                        null -> UsernameStatus.Idle
                    }
            }
    }

    fun save() {
        if (!canSave) return
        isSaving = true
        val trimmedName = name.trim()
        val submittedUsername = username
        val started = visit.number
        viewModelScope.launch {
            try {
                val failure = account.saveProfile(trimmedName.takeIf { it != savedName }, submittedUsername)
                if (failure == AccountFailure.UsernameTaken) usernameStatus = UsernameStatus.Taken
                if (failure == null) saveFailure.clear() else saveFailure.send(started, failure)
                if (failure == null) {
                    savedName = trimmedName
                    savedUsername = submittedUsername
                    usernameStatus = UsernameStatus.Idle
                    isSaved = true
                    saved.send(started, Unit)
                }
            } finally {
                isSaving = false
            }
        }
    }

    private companion object {
        const val USERNAME_CHECK_DELAY_MS = 300L
    }
}

/** `@zoonk/auth/username-rules`: 3 to 30 letters, numbers or underscores. */
internal fun isUsernameSyntaxValid(username: String): Boolean =
    username.length in 3..USERNAME_MAX_LENGTH && username.all { it in 'a'..'z' || it in '0'..'9' || it == '_' }

internal const val USERNAME_MAX_LENGTH = 30
