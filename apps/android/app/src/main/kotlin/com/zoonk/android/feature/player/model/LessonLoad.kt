package com.zoonk.android.feature.player.model

import androidx.compose.runtime.Immutable
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExplanationLesson
import com.zoonk.api.models.LessonTutorSuggestion
import com.zoonk.api.models.PlayableLibraryLessonResponse
import com.zoonk.api.models.PlayableLibraryLessonResponseOneOf1Lesson
import com.zoonk.api.models.PlayableLibraryStep
import com.zoonk.api.models.PlayableLibraryStepAnyOf4Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf5Listening
import com.zoonk.api.models.PlayableLibraryStepAnyOf9
import com.zoonk.api.models.PlayableLibraryStepAnyOf9Exercise
import com.zoonk.api.models.PlayableLibraryStepAnyOfImage
import com.zoonk.api.models.PlayableLibraryStepAnyOfOptionPicturesValue

/** What `/learn/{lessonId}` opens to: its screens, its outline waiting to be written, or a visitor's gate. */
@Immutable
sealed interface LessonLoad {
    data class Ready(
        val lesson: PlayableLesson,
    ) : LessonLoad

    data class NotGenerated(
        val outline: LessonOutline,
    ) : LessonLoad

    /** A visitor: screens load only with a session, a guest's included. */
    data class SessionRequired(
        val outline: LessonOutline,
    ) : LessonLoad
}

@Immutable
data class LessonOutline(
    val id: String,
    val title: String,
    val description: String,
    val estimatedMinutes: Long,
)

@Immutable
data class PlayableLesson(
    val id: String,
    val title: String,
    val description: String,
    val estimatedMinutes: Long,
    val language: String,
    val targetLanguage: String?,
    val chapterId: String?,
    val steps: List<LessonStep>,
    val summaryIdeas: List<String>,
    val tutorSuggestions: List<LessonTutorSuggestion>,
)

fun PlayableLibraryLessonResponse.toLessonLoad(): LessonLoad =
    when (this) {
        is PlayableLibraryLessonResponse.PlayableLibraryLessonResponseOneOfValue -> {
            val lesson = value.lesson
            LessonLoad.Ready(
                PlayableLesson(
                    id = lesson.id.toString(),
                    title = lesson.title,
                    description = lesson.description,
                    estimatedMinutes = lesson.estimatedMinutes,
                    language = lesson.language,
                    targetLanguage = lesson.targetLanguage,
                    chapterId = lesson.chapter?.id?.toString(),
                    steps = lesson.steps.map(PlayableLibraryStep::toLessonStep),
                    summaryIdeas = lesson.summaryIdeas,
                    tutorSuggestions = value.tutorSuggestions,
                ),
            )
        }

        is PlayableLibraryLessonResponse.PlayableLibraryLessonResponseOneOf1Value -> {
            LessonLoad.NotGenerated(value.lesson.toOutline())
        }

        is PlayableLibraryLessonResponse.PlayableLibraryLessonResponseOneOf2Value -> {
            LessonLoad.SessionRequired(value.lesson.toOutline())
        }
    }

/** A quick explanation's lesson, which comes with it already written. */
fun ExplanationLesson.toPlayableLesson(): PlayableLesson =
    PlayableLesson(
        id = id.toString(),
        title = title,
        description = description,
        estimatedMinutes = estimatedMinutes,
        language = language,
        targetLanguage = targetLanguage,
        chapterId = chapter?.id?.toString(),
        steps = steps.map(PlayableLibraryStep::toLessonStep),
        summaryIdeas = summaryIdeas,
        tutorSuggestions = emptyList(),
    )

private fun PlayableLibraryLessonResponseOneOf1Lesson.toOutline() =
    LessonOutline(id = id.toString(), title = title, description = description, estimatedMinutes = estimatedMinutes)

internal fun PlayableLibraryStep.toLessonStep(): LessonStep =
    when (this) {
        is PlayableLibraryStep.PlayableLibraryStepAnyOfValue -> {
            with(value) {
                teaching(
                    id = id.toString(),
                    skillId = skillId?.toString(),
                    content = StepContent.Activity(content, activityFrame(content), minTolerance),
                    image = image,
                    imagePending = imagePending,
                    pictureWaitStartedAt = pictureWaitStartedAt,
                    optionPictures = optionPictures,
                    citation = citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf1Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.Challenge(content),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf2Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.Check(content),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf3Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.Explanation(content),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf4Value -> {
            with(value) {
                val hook =
                    when (val hook = content) {
                        is PlayableLibraryStepAnyOf4Content.PlayableLibraryStepAnyOf4ContentOneOfValue -> StepContent.Guess(hook.value)
                        is PlayableLibraryStepAnyOf4Content.PlayableLibraryStepAnyOf4ContentOneOf1Value -> StepContent.Fact(hook.value)
                    }
                teaching(id.toString(), skillId?.toString(), hook, image, imagePending, pictureWaitStartedAt, optionPictures, citation)
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf5Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.SpokenAnswer(content, listening?.toExercise()),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf6Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.Summary(content),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf7Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.TypedAnswer(content),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf8Value -> {
            with(value) {
                teaching(
                    id.toString(),
                    skillId?.toString(),
                    StepContent.WorkedExample(content),
                    image,
                    imagePending,
                    pictureWaitStartedAt,
                    optionPictures,
                    citation,
                )
            }
        }

        is PlayableLibraryStep.PlayableLibraryStepAnyOf9Value -> {
            with(value) {
                LessonStep(
                    id = id.toString(),
                    skillId = skillId?.toString(),
                    content = StepContent.Language(kind.toStepKind(), exercise, wordHints),
                )
            }
        }
    }

@Suppress("LongParameterList")
private fun teaching(
    id: String,
    skillId: String?,
    content: StepContent,
    image: PlayableLibraryStepAnyOfImage?,
    imagePending: Boolean,
    pictureWaitStartedAt: Long?,
    optionPictures: Map<String, PlayableLibraryStepAnyOfOptionPicturesValue>?,
    citation: StepCitation?,
) = LessonStep(
    id = id,
    skillId = skillId,
    content = content,
    image = image?.let { StepImage(it.id.toString(), it.url, it.alt, it.width, it.height) },
    imagePending = imagePending,
    pictureWaitStartedAt = pictureWaitStartedAt,
    optionPictures =
        optionPictures.orEmpty().mapValues { (_, picture) ->
            StepImage(picture.id.toString(), picture.url, picture.alt, picture.width, picture.height)
        },
    citation = citation,
)

private fun activityFrame(content: ActivityStepContent): ActivityFrame =
    ApiJson.decodeFromJsonElement(
        ActivityFrame.serializer(),
        ApiJson.encodeToJsonElement(ActivityStepContent.serializer(), content),
    )

private fun PlayableLibraryStepAnyOf9.Kind.toStepKind() =
    when (this) {
        PlayableLibraryStepAnyOf9.Kind.ALPHABET -> StepKind.Alphabet
        PlayableLibraryStepAnyOf9.Kind.FILL_BLANK -> StepKind.FillBlank
        PlayableLibraryStepAnyOf9.Kind.LISTENING -> StepKind.Listening
        PlayableLibraryStepAnyOf9.Kind.MATCH_COLUMNS -> StepKind.MatchColumns
        PlayableLibraryStepAnyOf9.Kind.MULTIPLE_CHOICE -> StepKind.MultipleChoice
        PlayableLibraryStepAnyOf9.Kind.READING -> StepKind.Reading
        PlayableLibraryStepAnyOf9.Kind.TRANSLATION -> StepKind.Translation
        PlayableLibraryStepAnyOf9.Kind.VOCABULARY -> StepKind.Vocabulary
    }

/** The spoken screen's fallback and a language screen's exercise are one schema, generated twice. */
private fun PlayableLibraryStepAnyOf5Listening.toExercise(): LanguageExercise =
    when (this) {
        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOfValue -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOfValue(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf1Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf1Value(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf2Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf2Value(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf3Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf3Value(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf4Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf4Value(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf5Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf5Value(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf6Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf6Value(value)
        }

        is PlayableLibraryStepAnyOf5Listening.PlayableLibraryStepAnyOf5ListeningOneOf7Value -> {
            PlayableLibraryStepAnyOf9Exercise.PlayableLibraryStepAnyOf5ListeningOneOf7Value(value)
        }
    }
