package com.zoonk.android.feature.account

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.SavedStateHandleSaveableApi
import androidx.lifecycle.viewmodel.compose.saveable
import com.zoonk.api.models.MeUser
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
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
    private val savedUsername = user.username.orEmpty()

    var name by handle.saveable { mutableStateOf(user.name) }
        private set
    var username by handle.saveable { mutableStateOf(savedUsername) }
        private set
    var usernameStatus by mutableStateOf(UsernameStatus.Idle)
        private set
    var isSaving by mutableStateOf(false)
        private set
    var failure by mutableStateOf<AccountFailure?>(null)
        private set

    private var check: Job? = null

    val canSave: Boolean
        get() =
            !isSaving && name.isNotBlank() && isUsernameSyntaxValid(username) &&
                usernameStatus != UsernameStatus.Taken && usernameStatus != UsernameStatus.Checking

    init {
        if (username.isEmpty()) {
            viewModelScope.launch {
                val suggestion = account.usernameSuggestion() ?: return@launch
                if (username.isEmpty()) onUsernameChange(suggestion)
            }
        }
    }

    fun onNameChange(value: String) {
        name = value
        failure = null
    }

    fun onUsernameChange(value: String) {
        val normalized = value.trim().lowercase()
        if (normalized == username) return
        username = normalized
        failure = null
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

    fun save(onSaved: () -> Unit = {}) {
        if (!canSave) return
        isSaving = true
        viewModelScope.launch {
            try {
                failure = account.saveProfile(name.trim(), username)
                if (failure == AccountFailure.UsernameTaken) usernameStatus = UsernameStatus.Taken
                if (failure == null) onSaved()
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
    username.length in 3..30 && username.all { it in 'a'..'z' || it in '0'..'9' || it == '_' }
