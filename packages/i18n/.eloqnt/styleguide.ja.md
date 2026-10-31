# `ja` styleguide

## Voice and locale

- Use Japanese for Japan. Sentences use です・ます.
- Leave out “あなた” and “あなたの” wherever Japanese drops them: “Your plan” is “学習計画”, not “あなたの学習計画”.
- Buttons, links, menu actions and mission names use a verb's dictionary form or a noun: “もう一度試す”, “新しい目標を始める”, “最初のレッスンを終える”. Never “〜してください” or “〜しましょう” on them.
- Lines saying what Zoonk is doing while it works use the polite progressive without a subject: “3ページ目を作成しています…”.
- The buddy speaks in です・ます too and calls itself “わたし”.
- Buddy names take no honorific. The learner's name and named people in calls and speaking exams take “さん” (“{name}さん”); roles such as “試験官” don't.
- Keep “Zoonk” and “Plus” in Latin letters.
- Localize an exam named only as an example, such as a goal suggestion, for Japan: the 大学入学共通テスト, 英検 and 公務員試験. Keep the exam when the screen shows its own scores, sections or questions, such as an SAT course.
- Use full-width “！”, “？”, “（）” and “：”, with no space after “。”. Write a number and its unit with no space between them: “30秒”, “77日”, “1時間30分”, “1〜2分”.
- Count with a counter that fits any number: “15分野”, “12スキル”, not “15つの分野”, since “つ” only counts one to nine.
- Write foreign cities and the people in examples in katakana: “ロンドン”, “アナさん”.
- When an English plural's one form has its own words (“Opens tomorrow”, “all of it”), keep them in an “=1” branch, since Japanese has only “other”.

## Glossary

- “lesson”: “レッスン”, not “授業”; lessons are counted “#レッスン”, not with “件”, “回” or “つ”
- “goal” (the learner's goal): “目標”
- “plan” (study plan): “学習計画”, or “計画” where it's clear; subscription plan: “プラン”
- “Free” (subscription name): “無料プラン”
- “Get Plus”: “Plusに登録する”; the “Subscribe” button: “登録する”; “subscription”: “サブスクリプション”; to “cancel” it: “解約する”
- “session” (study): “学習” (“今日の学習”), not “セッション”, which is the sign-in session
- “subject” (of an exam or a plan): “科目”
- “topic”: “トピック”
- “area” (a weighted part of an exam or a goal): “分野”
- “material” (the learner's own files and notes): “資料”
- “notice” (an exam's official notice): “要項”
- “position” (the post an exam is for): “職種”, never “位置”
- “question”: one the learner asks: “質問”; one the learner answers, in a lesson, practice or exam: “問題”
- “check” (an answer): “答え合わせ”, not “確認”, which confirms
- “write” (Zoonk generating content): “作成する”; learner writing: “書く”
- “essay”: “小論文”, not “エッセイ”
- “case” (a situation the learner works through): “事例”, not “ケース”
- “the big day” (the exam or goal date): “本番” for an exam, otherwise “目標の日”, never “大切な日”
- the “objective” questions of a mock: “選択式の問題”
- “Got it” (closing a notice): “OK”, not “了解”; “Not quite” (a wrong answer): “少し違います”
- “guess” (a pick that doesn't count) and the learner's “estimate” before the answer shows: “予想”, never “回答”; an estimated score or band: “推定スコア” / “推定バンドスコア”
- “say” (aloud, in pronunciation practice): “声に出して言う”
- “share” (personal facts): “教える”, not “共有する”
- “task” (a speaking exam's task): “タスク”
- “hand in” (a mock or one of its parts): “提出する”
- “trap” (in a Trickster question): “ひっかけ”, as in “ひっかけ問題”, not “罠”
- “flag” (a mock question to come back to): “見直し”, never “マーク”, which means filling in the answer sheet
- “pattern” (a mistake that recurs): “ミスの傾向”
- “link” (between a cause and its effect): “つながり”, not “リンク”
- “score”: “スコア”; an exam's “band”: “バンドスコア”
- “memory” (what Zoonk remembers about the learner): “メモリ”; the learner remembering what they studied: “記憶”
- Language skills “Listening” / “Speaking” / “Reading” / “Writing” / “Words”: “リスニング” / “スピーキング” / “リーディング” / “ライティング” / “語彙”
- Speaking criteria “Fluency” / “Accuracy” / “Interaction” / “Range of language”: “流暢さ” / “正確さ” / “やり取り” / “表現の幅”
- “examiner” / “another candidate” (the AI's roles in a speaking exam): “試験官” / “ほかの受験者”
- “prerequisite”: “前提知識”, not “前提条件”
- “musicianship”: “音楽の基礎”
- “study time”, the daily amount: “学習時間”; the time of day the learner studies: “学習する時刻”
- “You've reached today's study time”: “今日の学習時間に達しました”, in every line that starts with it
- Ending a subscription “for an important reason”: “やむを得ない理由で”
- “Keep Plus” (turns a stopped renewal back on): “Plusを継続する”

## Feature names and states

- “Buddy”: “相棒”; “study buddy”: “学習の相棒”
- Buddy stages “Baby” / “Young” / “Adult”: “赤ちゃん” / “こども” / “おとな”, never “アダルト”
- “Brain Power”: “脳力” (a play on “能力”), never “能力” or “ブレインパワー”
- “mission”: “ミッション”
- “call” (speaking practice): “会話”, not “電話”; the verb: “会話練習をする”
- “Mistakes notebook”: “間違いノート”
- “Saved to your mistakes”: “間違いノートに保存しました”, in every line that starts with it
- “To fix” / “Fixed” (notebook tabs): “未克服” / “克服済み”
- “New” / “Learning” / “Solid” / “Mastered” (mastery): “新規” / “学習中” / “定着” / “習得済み”
- “Known before”: “もともと知っていた”; “Known” (progress legend): “知っていた”
- “Preparation”: “準備状況”
- “the Trickster”: “トリックスター”
- “Broken” / “Held” (shield): “壊れた” / “耐えた”
- “Phase challenge”: “フェーズチャレンジ”
- “Weekly challenge”: “週間チャレンジ”
- “Mock exam”, including speaking mocks: “模試”
- “Logbook”: “学習記録”
- “Fading” (needs review): “忘れかけ”
- “Overview” (course level and a plan's first phase): “概要”
- “Beginner” / “Intermediate” / “Advanced” (course levels and plan phases): “初級” / “中級” / “上級”
- “Quick lesson”: “クイックレッスン”
- “Focus test”: “重点診断”
- “Quick explanation”: “クイック解説”
- “Weekly summary”: “週間まとめ”
- “Full review”: “総復習”; spaced review: “復習”
- Belts: “白帯”, “黄帯”, “オレンジ帯”, “緑帯”, “青帯”, “紫帯”, “茶帯”, “赤帯”, “グレー帯”, “黒帯”

## Plan terminology

- “Pace”: “ペース”; the “On pace” / “Keeping pace” status: “順調”
- “Finished”: “完了”
- “Past date”: “期日を過ぎた”, not “期限切れ” or “終了”
- “Needs adjusting”: “調整が必要”
- “Too tight”: “詰め込みすぎ”
- “Even across skills”: “全スキル均等”
- “left out”: “入りきらない” (“計画に入りきらなかったレッスン”), not “外れた” or “スキップ”
- “Skip” (the learner's choice) and “skipped” (a test showed it's known): “スキップ”
- “Daily time”: “1日の学習時間”
- “rest day”: “休みの日”

## Buddy names

- “Zu”: “ズー”
- “Noodle”: “ミソ”
- “Beep”: “ピコ”
- “Otto”: “オクト”

## Formatting preferences

- Match the app's compact durations: “2 時間 30 分”, “30 秒”.
- Quote with 「」, and 『』 inside them.
