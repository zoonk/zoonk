package com.zoonk.android.feature.profile

import com.zoonk.api.ApiJson
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
import com.zoonk.api.models.ProfileQuestionViewOptionsInner
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

val OnboardingStep.profileQuestion: ProfileQuestion?
    get() = ProfileQuestion.entries.find { it.value == value }

/**
 * One question's answer while the learner edits it. For tools, [typed] holds the tools they added by name and
 * [text] what is still in the field, which Continue adds as Add does.
 */
@Serializable
data class ProfileDraft(
    val picks: List<String> = emptyList(),
    val text: String = "",
    val subjects: Map<String, String> = emptyMap(),
    val declined: Boolean = false,
    val typed: List<String> = emptyList(),
) {
    fun valid(
        question: ProfileQuestion,
        memoryEnabled: Boolean = true,
    ): Boolean =
        (declined && question != ProfileQuestion.CONDITIONS) ||
            when (question) {
                ProfileQuestion.WORK, ProfileQuestion.ADDRESS_FORM -> {
                    picks.isNotEmpty()
                }

                ProfileQuestion.STUDIES -> {
                    picks.isNotEmpty() && ("other" !in picks || !subjects["other"].isNullOrBlank())
                }

                ProfileQuestion.CONDITIONS -> {
                    picks.isNotEmpty() && ("other" !in picks || text.isNotBlank())
                }

                else -> {
                    picks.isNotEmpty() || typed.isNotEmpty() ||
                        (text.isNotBlank() && (question != ProfileQuestion.LEARNING_SUPPORT || memoryEnabled))
                }
            }

    fun toggle(
        id: String,
        single: Boolean = false,
    ): ProfileDraft {
        val next =
            when {
                id in picks -> picks - id
                single -> listOf(id)
                else -> picks + id
            }
        return copy(picks = next, declined = false, subjects = subjects.filterKeys { it in next })
    }

    /** The typed tools as the server keeps them: joined with commas. */
    fun favorites(): String = typed.joinToString(", ")

    /**
     * The field's text as tools: a name an offered chip shows picks that chip, one already there is ignored,
     * and any other becomes a typed tool if it fits the server's limit. A name is added whole or stays in the field.
     */
    fun added(options: List<ProfileQuestionViewOptionsInner>): ProfileDraft {
        var nextPicks = picks
        var nextTyped = typed
        val left = mutableListOf<String>()
        splitProfileFavorites(text).forEach { name ->
            val offered = options.find { it.label.equals(name, ignoreCase = true) }
            when {
                offered != null -> if (offered.id !in nextPicks) nextPicks = nextPicks + offered.id
                nextTyped.any { it.equals(name, ignoreCase = true) } -> Unit
                fitsFavorites(nextTyped + name) -> nextTyped = nextTyped + name
                else -> left += name
            }
        }
        return copy(picks = nextPicks, typed = nextTyped, text = left.joinToString(", "), declined = false)
    }

    /**
     * What the tools field shows as the learner types: a separator adds what came before it. A key typed past the
     * limit is refused; a paste lands whole, and what of it doesn't fit stays in the field.
     */
    fun typing(
        value: String,
        options: List<ProfileQuestionViewOptionsInner>,
    ): ProfileDraft {
        val edited = copy(text = value, declined = false)
        val next = if (PROFILE_FAVORITES_SEPARATORS.containsMatchIn(value)) edited.added(options) else edited
        val keyPastLimit = value.length == text.length + 1 && !fitsFavorites(next.typed + splitProfileFavorites(next.text))
        return if (keyPastLimit) this else next
    }

    fun removing(tool: String): ProfileDraft = copy(typed = typed - tool)

    /** The answer as sent: for tools, what is still in the field counts as added. */
    fun submitted(question: ProfileQuestionView): ProfileDraft = if (question.id == ProfileQuestion.TOOLS) added(question.options) else this

    fun empty(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
    ): Boolean =
        when (question) {
            ProfileQuestion.WORK, ProfileQuestion.STUDIES, ProfileQuestion.CONDITIONS, ProfileQuestion.ADDRESS_FORM -> {
                picks.isEmpty()
            }

            else -> {
                picks.isEmpty() && typed.isEmpty() &&
                    (text.isBlank() || (question == ProfileQuestion.LEARNING_SUPPORT && !memoryEnabled))
            }
        }

    fun input(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
    ): ProfileAnswerInput = ApiJson.decodeFromJsonElement(body(question, memoryEnabled))

    fun onboardingInput(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
    ): OnboardingAnswerInput = ApiJson.decodeFromJsonElement(body(question, memoryEnabled))

    fun body(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
    ): JsonObject =
        buildJsonObject {
            put("question", question.value)
            putJsonObject("answer") {
                val decline = declined || (question == ProfileQuestion.CONDITIONS && picks.isEmpty())
                put("declined", decline)
                if (question == ProfileQuestion.LEARNING_SUPPORT) put("soundEffects", "noSoundEffects" !in picks)
                if (question == ProfileQuestion.ADDRESS_FORM) put("form", picks.firstOrNull()?.takeUnless { decline })
                if (!decline) {
                    when (question) {
                        ProfileQuestion.WORK -> {
                            put("status", picks.firstOrNull())
                            if (picks.firstOrNull() in listOf("work", "workAndStudy")) put("job", text.trim().ifEmpty { null })
                        }

                        ProfileQuestion.STUDIES -> {
                            putJsonArray("studies") {
                                picks.forEach { field ->
                                    add(
                                        buildJsonObject {
                                            put("field", field)
                                            put("subject", subjects[field]?.trim()?.ifEmpty { null })
                                        },
                                    )
                                }
                            }
                        }

                        ProfileQuestion.CONDITIONS -> {
                            put("consented", true)
                            putJsonArray("conditions") {
                                picks.forEach { condition ->
                                    add(
                                        buildJsonObject {
                                            put("condition", condition)
                                            if (condition == "other") put("note", text.trim())
                                        },
                                    )
                                }
                            }
                        }

                        ProfileQuestion.LEARNING_SUPPORT -> {
                            put("needs", buildJsonArray { picks.filterNot { it == "noSoundEffects" }.forEach { add(JsonPrimitive(it)) } })
                            if (memoryEnabled) put("note", text.trim().ifEmpty { null })
                        }

                        ProfileQuestion.ADDRESS_FORM -> {}

                        else -> {
                            put("picks", buildJsonArray { picks.forEach { add(JsonPrimitive(it)) } })
                            put("favorites", if (question == ProfileQuestion.TOOLS) favorites() else text.trim())
                        }
                    }
                }
            }
        }

    companion object {
        fun from(
            question: ProfileQuestionView,
            role: String? = null,
        ): ProfileDraft {
            val tools = question.id == ProfileQuestion.TOOLS
            return ProfileDraft(
                picks = if (question.id == ProfileQuestion.STUDIES) question.saved.studies.map { it.field } else question.saved.picks,
                text =
                    if (tools) {
                        ""
                    } else {
                        question.saved.text.ifEmpty { profileJobPrefill(role).takeIf { question.id == ProfileQuestion.WORK }.orEmpty() }
                    },
                subjects = question.saved.studies.associate { it.field to it.subject.orEmpty() },
                declined =
                    question.status == ProfileQuestionView.Status.DECLINED &&
                        question.saved.picks.isEmpty() && question.saved.text.isEmpty() && question.saved.studies.isEmpty(),
                typed = if (tools) splitProfileFavorites(question.saved.text) else emptyList(),
            )
        }
    }
}

/** The server's longest favorites text, counted after [splitProfileFavorites] and joined with commas. */
private const val PROFILE_FAVORITES_LIMIT = 120

private fun fitsFavorites(names: List<String>): Boolean = names.joinToString(", ").length <= PROFILE_FAVORITES_LIMIT

private val PROFILE_FAVORITES_SEPARATORS = Regex("[,;、，\r\n]")

/** Splits favorites text as core's `splitProfileFavorites` does: on its separators, trimmed, without repeats ignoring case. */
fun splitProfileFavorites(text: String): List<String> =
    text
        .split(PROFILE_FAVORITES_SEPARATORS)
        .map { it.trim() }
        .filter { it.isNotEmpty() }
        .distinctBy { it.lowercase() }

fun profileJobPrefill(role: String?): String? = role?.trim()?.take(80)?.ifEmpty { null }

fun suggestedSupports(conditions: List<String>): List<String> =
    conditions
        .flatMap {
            when (it) {
                "adhd" -> listOf("stepByStep", "shortAnswers", "shorterDays")
                "autism" -> listOf("plainWords", "stepByStep", "noSoundEffects")
                "dyslexia" -> listOf("shortAnswers")
                "dyscalculia" -> listOf("stepByStep", "examplesFirst")
                else -> emptyList()
            }
        }.distinct()

fun profileSkipAll(forever: Boolean): OnboardingAnswerInput =
    ApiJson.decodeFromJsonElement(
        buildJsonObject {
            put("question", "skipProfile")
            put("forever", forever)
        },
    )
