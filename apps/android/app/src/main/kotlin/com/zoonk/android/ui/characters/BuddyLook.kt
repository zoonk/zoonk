package com.zoonk.android.ui.characters

import androidx.compose.runtime.Immutable
import com.zoonk.android.ui.components.Belt
import com.zoonk.api.models.LearnerSummaryBuddy

enum class BuddyKind(
    val key: String,
) {
    Zu("zu"),
    Noodle("noodle"),
    Beep("beep"),
    Otto("otto"),
    ;

    companion object {
        fun of(key: String): BuddyKind = entries.first { it.key == key }
    }
}

enum class BuddyGlasses(
    val key: String,
) {
    Round("round"),
    Star("star"),
    Aviator("aviator"),
    CatEye("catEye"),
    Retro("retro"),
    Monocle("monocle"),
    ;

    companion object {
        fun of(key: String): BuddyGlasses = entries.first { it.key == key }
    }
}

/** Brain Power only goes up, so belts never regress and neither does the buddy. */
enum class BuddyStage(
    internal val scale: Float,
) {
    Baby(0.7f),
    Young(0.85f),
    Adult(1f),
    ;

    companion object {
        fun of(belt: Belt): BuddyStage =
            when (belt) {
                Belt.White, Belt.Yellow -> Baby
                Belt.Orange, Belt.Green -> Young
                Belt.Blue, Belt.Purple, Belt.Brown, Belt.Red, Belt.Gray, Belt.Black -> Adult
            }
    }
}

enum class BuddyEnergyState { Napping, Awake, Glowing }

/** Every buddy shares one face layout, so every expression and pair of glasses fits every buddy. */
enum class BuddyExpression { Neutral, Happy, Cheer, Proud, Wow, Think, Kind, Sleepy }

/**
 * Growth and glow come from the belt and Energy, so buddies never need an economy of their own.
 * The default is the buddy a learner has before picking one.
 */
@Immutable
data class BuddyLook(
    val kind: BuddyKind = BuddyKind.Zu,
    val glasses: BuddyGlasses = BuddyGlasses.Round,
    val belt: Belt = Belt.White,
    /** Null before the learner has any Energy: awake, without a glow. */
    val energy: Double? = null,
    /** Learning wakes the buddy: on a day with study it never naps, even while Energy is low. */
    val studiedToday: Boolean = false,
) {
    val stage: BuddyStage get() = BuddyStage.of(belt)

    val energyState: BuddyEnergyState
        get() =
            when {
                energy == null -> BuddyEnergyState.Awake
                energy >= GLOWING_FROM_ENERGY -> BuddyEnergyState.Glowing
                energy < AWAKE_FROM_ENERGY && !studiedToday -> BuddyEnergyState.Napping
                else -> BuddyEnergyState.Awake
            }

    val everydayExpression: BuddyExpression
        get() =
            when (energyState) {
                BuddyEnergyState.Napping -> BuddyExpression.Sleepy
                BuddyEnergyState.Awake -> BuddyExpression.Happy
                BuddyEnergyState.Glowing -> BuddyExpression.Cheer
            }

    internal val glow: Float get() = ((energy ?: 0.0) / MAX_ENERGY).coerceIn(0.0, 1.0).toFloat()
}

fun LearnerSummaryBuddy.look(): BuddyLook =
    BuddyLook(
        kind = BuddyKind.of(kind.value),
        glasses = BuddyGlasses.of(glasses.value),
        belt = Belt.entries.first { it.name.equals(beltColor.value, ignoreCase = true) },
        energy = energy,
        studiedToday = studiedToday,
    )

private const val MAX_ENERGY = 100.0
private const val AWAKE_FROM_ENERGY = 30.0
private const val GLOWING_FROM_ENERGY = 80.0
