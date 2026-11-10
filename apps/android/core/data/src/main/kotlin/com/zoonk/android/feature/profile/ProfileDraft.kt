package com.zoonk.android.feature.profile

import com.zoonk.api.ApiJson
import com.zoonk.api.models.OnboardingAnswerInput
import com.zoonk.api.models.OnboardingStep
import com.zoonk.api.models.ProfileAnswerInput
import com.zoonk.api.models.ProfileQuestion
import com.zoonk.api.models.ProfileQuestionView
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

@Serializable
data class ProfileDraft(
    val picks: List<String> = emptyList(),
    val text: String = "",
    val subjects: Map<String, String> = emptyMap(),
    val declined: Boolean = false,
    val declineChoice: String = "none",
    val consented: Boolean = false,
) {
    fun valid(
        question: ProfileQuestion,
        memoryEnabled: Boolean = true,
    ): Boolean =
        declined ||
            when (question) {
                ProfileQuestion.WORK -> picks.isNotEmpty()
                ProfileQuestion.STUDIES -> picks.isNotEmpty() && ("other" !in picks || !subjects["other"].isNullOrBlank())
                ProfileQuestion.CONDITIONS -> "other" !in picks || text.isNotBlank()
                else -> picks.isNotEmpty() || (text.isNotBlank() && (question != ProfileQuestion.LEARNING_SUPPORT || memoryEnabled))
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

    fun decline(choice: String = "none"): ProfileDraft =
        ProfileDraft(declined = !declined || declineChoice != choice, declineChoice = choice)

    fun empty(
        question: ProfileQuestion,
        memoryEnabled: Boolean,
    ): Boolean =
        when (question) {
            ProfileQuestion.WORK, ProfileQuestion.STUDIES, ProfileQuestion.CONDITIONS -> picks.isEmpty()
            else -> picks.isEmpty() && (text.isBlank() || (question == ProfileQuestion.LEARNING_SUPPORT && !memoryEnabled))
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
                val decline = declined || (question == ProfileQuestion.CONDITIONS && (!consented || picks.isEmpty()))
                put("declined", decline)
                if (question == ProfileQuestion.LEARNING_SUPPORT) put("soundEffects", "noSoundEffects" !in picks)
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

                        else -> {
                            put("picks", buildJsonArray { picks.forEach { add(JsonPrimitive(it)) } })
                            put("favorites", text.trim())
                        }
                    }
                }
            }
        }

    companion object {
        fun from(
            question: ProfileQuestionView,
            role: String? = null,
        ): ProfileDraft =
            ProfileDraft(
                picks = if (question.id == ProfileQuestion.STUDIES) question.saved.studies.map { it.field } else question.saved.picks,
                text = question.saved.text.ifEmpty { role.takeIf { question.id == ProfileQuestion.WORK }.orEmpty() },
                subjects = question.saved.studies.associate { it.field to it.subject.orEmpty() },
                declined = question.status == ProfileQuestionView.Status.DECLINED,
                declineChoice = if (question.id in listOf(ProfileQuestion.WORK, ProfileQuestion.CONDITIONS)) "prefer" else "none",
                consented = question.id == ProfileQuestion.CONDITIONS && question.saved.picks.isNotEmpty(),
            )
    }
}

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

fun profileSkip(question: ProfileQuestion): OnboardingAnswerInput =
    ApiJson.decodeFromJsonElement(
        buildJsonObject {
            put("question", question.value)
            put("answer", kotlinx.serialization.json.JsonNull)
        },
    )

fun profileSkipAll(forever: Boolean): OnboardingAnswerInput =
    ApiJson.decodeFromJsonElement(
        buildJsonObject {
            put("question", "skipProfile")
            put("forever", forever)
        },
    )
