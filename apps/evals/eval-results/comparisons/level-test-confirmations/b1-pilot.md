# B1 confirmation writer pilot

On November 23, 2026, three writers each ran once on `en-pt-b1`. Each produced two reading questions and two listening questions for a US English speaker learning Brazilian Portuguese. All three passed both structural checks. The writer calls cost $0.0129123 in total.

| Writer and output | Cost | Time | Reading | Listening |
| --- | ---: | ---: | --- | --- |
| [GPT-6 Luna](b1-pilot-luna/outputs/9a75acfbfc3282302f52b1827e0d6f8eec369822d442822d0f7799a89d9b2347) | $0.0024580 | 39.4 s | Both keys matched an independent solve. | Both keys matched. |
| [Claude Haiku 5.5](b1-pilot-haiku/outputs/e7f042aad177b20c2fd3813989e30f0499b161e1de15728f6bbf6b117256a2eb) | $0.0055613 | 42.6 s | Both keys matched, but two correct options in the travel guide restated the same recommendation to start the visit in Pelourinho. | Both keys matched. |
| [Gemini 3.5 Flash Lite](b1-pilot-flash-lite/outputs/d06d7d96240f91feae77076cb606f42db7c7ccae157ae6feb9e46e4babaca640) | $0.0048930 | 5.4 s | Both keys matched. | In the match report, the coach says the defense left space and praises the team's effort. The key requires the learner to select “Defensive errors ruined the final result of the game.” The passage never attributes the result to the defense. |

The interview question from Flash Lite also asks learners to endorse “It prevents the candidate from transmitting tranquility.” The speaker says the ideal timing projects calm and that arriving much too early shows anxiety. Whether arriving early *prevents* a calm impression is open to interpretation.

One reviewer solved the options before inspecting the saved keys. The B1 case now explicitly checks for duplicated correct ideas and unsupported claims about causes. Each sealed manifest preserves the original expectations.

This pilot measured writer cost and identified defects on one input. The [full comparison](writers.md) followed with repeated cases across levels, independent checks of the keys and blind comparisons. Measuring how well a B1 placement describes a learner requires separately assessed learners.
