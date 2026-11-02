package com.zoonk.android.ui.format

import org.junit.Assert.assertEquals
import org.junit.Test

class SentencesTest {
    @Test
    fun japaneseSentencesJoinWithoutASpace() {
        assertEquals(
            "1日30分がおすすめです。学習できる日を増やすと、余裕が生まれます。",
            joinSentences("1日30分がおすすめです。", "学習できる日を増やすと、余裕が生まれます。"),
        )
        assertEquals("勝利です！次へ進みますか？準備OK", listOf("勝利です！", "次へ進みますか？", "準備OK").joinSentences())
    }

    @Test
    fun otherLanguagesJoinWithASpace() {
        assertEquals(
            "We suggest 30 min a day. More study days would help.",
            joinSentences("We suggest 30 min a day.", "More study days would help."),
        )
        assertEquals("하루 30분을 추천해요. 학습일을 늘리면 도움이 돼요.", joinSentences("하루 30분을 추천해요.", "학습일을 늘리면 도움이 돼요."))
    }

    @Test
    fun mixedSentencesSpaceOnlyAfterAHalfWidthStop() {
        assertEquals(
            "x² + 1 = 2. 答えは1です。Try again.",
            listOf("x² + 1 = 2.", "答えは1です。", "Try again.").joinSentences(),
        )
        assertEquals("", emptyList<String>().joinSentences())
        assertEquals("Only one.", joinSentences("Only one."))
    }

    @Test
    fun theSpaceBeforeALinkFollowsTheSameRule() {
        assertEquals("", spaceAfterSentence("まだ迷っていますか？"))
        assertEquals(" ", spaceAfterSentence("Still unsure?"))
    }
}
