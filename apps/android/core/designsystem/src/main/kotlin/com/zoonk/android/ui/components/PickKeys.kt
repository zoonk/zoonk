package com.zoonk.android.ui.components

import androidx.compose.ui.input.key.Key

private val PICK_KEYS =
    listOf(Key.One, Key.Two, Key.Three, Key.Four, Key.Five, Key.Six, Key.Seven, Key.Eight, Key.Nine, Key.Zero)
private val NUMPAD_PICK_KEYS =
    listOf(
        Key.NumPad1,
        Key.NumPad2,
        Key.NumPad3,
        Key.NumPad4,
        Key.NumPad5,
        Key.NumPad6,
        Key.NumPad7,
        Key.NumPad8,
        Key.NumPad9,
        Key.NumPad0,
    )

/**
 * Main's `pickKey`: the option a number key picks. 1 to 9 pick the first nine and 0, the key after 9 on the number row,
 * the tenth; null for any other key.
 */
fun Key.pickIndex(): Int? = PICK_KEYS.indexOf(this).takeIf { it >= 0 } ?: NUMPAD_PICK_KEYS.indexOf(this).takeIf { it >= 0 }
