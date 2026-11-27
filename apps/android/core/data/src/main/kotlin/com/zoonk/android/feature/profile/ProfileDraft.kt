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
    get() = ProfileQuestion.entries.find { it != ProfileQuestion.UNKNOWN_DEFAULT_OPEN_API && it.value == value }

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

                // Call it on the submitted draft: names left in the field didn't fit, and sending would drop them.
                ProfileQuestion.TOOLS -> {
                    (picks.isNotEmpty() || typed.isNotEmpty()) && text.isBlank()
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

    /** Whether Add changes anything: not for an empty field or names that can't fit. */
    fun canAdd(options: List<ProfileQuestionViewOptionsInner>): Boolean =
        added(options).text != splitProfileFavorites(text).joinToString(", ")

    /**
     * What the tools field shows as the learner types: a separator typed or pasted adds the names before it. The
     * field takes no more text once the name in it couldn't be added, and always lets text be deleted.
     */
    fun typing(
        value: String,
        options: List<ProfileQuestionViewOptionsInner>,
    ): ProfileDraft {
        if (separators(value) > separators(text)) return copy(text = value).added(options)
        val length = value.trim().characters()
        val grows = length > text.trim().characters()
        val room = PROFILE_FAVORITES_LIMIT - typed.sumOf { "$it, ".characters() }
        return if (grows && length > room) this else copy(text = value, declined = false)
    }

    fun removing(tool: String): ProfileDraft = copy(typed = typed - tool)

    /** The answer as sent: for tools, what is still in the field counts as added. */
    fun submitted(question: ProfileQuestionView): ProfileDraft =
        if (question.id == ProfileQuestion.TOOLS && text.isNotBlank()) added(question.options) else this

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

private fun fitsFavorites(names: List<String>): Boolean = names.joinToString(", ").characters() <= PROFILE_FAVORITES_LIMIT

/** The length the server's limit counts: code points, so an emoji counts as one. */
private fun String.characters(): Int = codePointCount(0, length)

private fun separators(text: String): Int = PROFILE_FAVORITES_SEPARATORS.findAll(text).count()

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
