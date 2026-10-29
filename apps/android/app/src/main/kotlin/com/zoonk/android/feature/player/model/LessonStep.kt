package com.zoonk.android.feature.player.model

import androidx.compose.runtime.Immutable
import com.zoonk.api.models.LessonStepAnswerOneOf3Answer
import com.zoonk.api.models.PlayableLibraryStepAnyOf1Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentEndingsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentNodesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentNodesInnerChoicesInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf2Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf2ContentBasis
import com.zoonk.api.models.PlayableLibraryStepAnyOf2ContentOptionsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf2ContentVisual
import com.zoonk.api.models.PlayableLibraryStepAnyOf3Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOf1
import com.zoonk.api.models.PlayableLibraryStepAnyOf4ContentOneOfOptionsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOf5Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf6Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf7Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf8Content
import com.zoonk.api.models.PlayableLibraryStepAnyOf9Exercise
import com.zoonk.api.models.PlayableLibraryStepAnyOf9WordHints
import com.zoonk.api.models.PlayableLibraryStepAnyOfCitation
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheck
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOf
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOf1
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfCheckOneOf2
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfData
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOfImage
import com.zoonk.api.models.PlayableLibraryStepAnyOfMinTolerance

// The contract's names for each screen's content, so code reads by meaning, not by union position.
typealias ActivityStepContent = PlayableLibraryStepAnyOfContent
typealias ActivityCheck = PlayableLibraryStepAnyOfContentOneOfCheck
typealias ActivityData = PlayableLibraryStepAnyOfContentOneOfData
typealias ActivityAnswer = LessonStepAnswerOneOf3Answer
typealias ActivityTolerance = PlayableLibraryStepAnyOfMinTolerance
typealias ChoiceCheck = PlayableLibraryStepAnyOfContentOneOfCheckOneOf
typealias InteractionCheck = PlayableLibraryStepAnyOfContentOneOfCheckOneOf1
typealias NumericCheck = PlayableLibraryStepAnyOfContentOneOfCheckOneOf2
typealias ChallengeStepContent = PlayableLibraryStepAnyOf1Content
typealias ChallengeNode = PlayableLibraryStepAnyOf1ContentNodesInner
typealias ChallengeChoice = PlayableLibraryStepAnyOf1ContentNodesInnerChoicesInner
typealias ChallengeEnding = PlayableLibraryStepAnyOf1ContentEndingsInner
typealias CheckStepContent = PlayableLibraryStepAnyOf2Content
typealias CheckOption = PlayableLibraryStepAnyOf2ContentOptionsInner
typealias ExplanationStepContent = PlayableLibraryStepAnyOf3Content
typealias GuessHook = PlayableLibraryStepAnyOf4ContentOneOf
typealias GuessOption = PlayableLibraryStepAnyOf4ContentOneOfOptionsInner
typealias TextHook = PlayableLibraryStepAnyOf4ContentOneOf1
typealias SpokenAnswerStepContent = PlayableLibraryStepAnyOf5Content
typealias SummaryStepContent = PlayableLibraryStepAnyOf6Content
typealias TypedAnswerStepContent = PlayableLibraryStepAnyOf7Content
typealias WorkedExampleStepContent = PlayableLibraryStepAnyOf8Content
typealias LanguageExercise = PlayableLibraryStepAnyOf9Exercise
typealias WordHints = PlayableLibraryStepAnyOf9WordHints
typealias StepCitation = PlayableLibraryStepAnyOfCitation
typealias StepVisual = PlayableLibraryStepAnyOf2ContentVisual
typealias StepBasis = PlayableLibraryStepAnyOf2ContentBasis
typealias PictureDescription = PlayableLibraryStepAnyOfContentOneOfImage

enum class StepKind {
    Activity,
    Challenge,
    Check,
    Explanation,
    Hook,
    SpokenAnswer,
    Summary,
    TypedAnswer,
    WorkedExample,
    Alphabet,
    FillBlank,
    Listening,
    MatchColumns,
    MultipleChoice,
    Reading,
    Translation,
    Vocabulary,
}

@Immutable
data class StepImage(
    val id: String,
    val url: String,
    val alt: String,
    val width: Long?,
    val height: Long?,
)

@Immutable
sealed interface StepContent {
    val kind: StepKind

    /** [frame] is what every template shares; [content] is the template's own, for its renderer. */
    data class Activity(
        val content: ActivityStepContent,
        val frame: ActivityFrame,
        val minTolerance: ActivityTolerance?,
    ) : StepContent {
        override val kind get() = StepKind.Activity
    }

    data class Challenge(
        val content: ChallengeStepContent,
    ) : StepContent {
        override val kind get() = StepKind.Challenge
    }

    data class Check(
        val content: CheckStepContent,
    ) : StepContent {
        override val kind get() = StepKind.Check
    }

    data class Explanation(
        val content: ExplanationStepContent,
    ) : StepContent {
        override val kind get() = StepKind.Explanation
    }

    data class Guess(
        val content: GuessHook,
    ) : StepContent {
        override val kind get() = StepKind.Hook
    }

    data class Fact(
        val content: TextHook,
    ) : StepContent {
        override val kind get() = StepKind.Hook
    }

    /** [listening] is the same sentence as a listening exercise, for "I can't talk now"; null when there's none. */
    data class SpokenAnswer(
        val content: SpokenAnswerStepContent,
        val listening: LanguageExercise?,
    ) : StepContent {
        override val kind get() = StepKind.SpokenAnswer
    }

    data class Summary(
        val content: SummaryStepContent,
    ) : StepContent {
        override val kind get() = StepKind.Summary
    }

    data class TypedAnswer(
        val content: TypedAnswerStepContent,
    ) : StepContent {
        override val kind get() = StepKind.TypedAnswer
    }

    data class WorkedExample(
        val content: WorkedExampleStepContent,
    ) : StepContent {
        override val kind get() = StepKind.WorkedExample
    }

    data class Language(
        override val kind: StepKind,
        val exercise: LanguageExercise,
        val wordHints: WordHints?,
    ) : StepContent
}

/**
 * [imagePending] while the screen's picture is still being drawn; its wait started at
 * [pictureWaitStartedAt] (epoch milliseconds), so reopening the lesson doesn't restart it.
 */
@Immutable
data class LessonStep(
    val id: String,
    val skillId: String?,
    val content: StepContent,
    val image: StepImage? = null,
    val imagePending: Boolean = false,
    val pictureWaitStartedAt: Long? = null,
    val optionPictures: Map<String, StepImage> = emptyMap(),
    val citation: StepCitation? = null,
) {
    val kind: StepKind get() = content.kind
}

/** What every activity template shares: the frame draws it, the template's renderer the rest. */
@Immutable
@kotlinx.serialization.Serializable
data class ActivityFrame(
    val template: String,
    val prompt: String,
    val check: ActivityCheck,
    val data: ActivityData? = null,
)
