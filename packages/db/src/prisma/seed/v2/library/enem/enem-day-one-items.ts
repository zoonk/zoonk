import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/**
 * Languages and Humanities questions in ENEM's format, the areas of the exam's first day. With the
 * course's other items, a seeded learner's mock of that day asks 30 of them, enough for an
 * estimated score on the exam's scale.
 */
export const enemDayOneItems: SeedItem[] = [
  {
    content: {
      context: t(
        "Mug cake: in a mug, mix 4 spoonfuls of flour, 2 of sugar and 1 egg. Add 3 spoonfuls of milk and stir until smooth. Microwave for 3 minutes and let it cool before eating.",
        "Bolo de caneca: misture numa caneca 4 colheres de farinha, 2 de açúcar e 1 ovo. Acrescente 3 colheres de leite e mexa até ficar liso. Leve ao micro-ondas por 3 minutos e espere esfriar antes de comer.",
      ),
      options: [
        bankOption(
          t(
            "Instructional, which uses verbs in the imperative to tell the reader what to do",
            "Injuntiva, que orienta o leitor a agir por meio de verbos no imperativo",
          ),
          t(
            "Mix, add, microwave, let: verbs in the imperative guide actions in order, which is what instructions do.",
            "Misture, acrescente, leve, espere: os verbos no imperativo guiam ações em ordem, o que define a injunção.",
          ),
        ),
        bankOption(
          t(
            "Narrative, because it tells events in time order",
            "Narrativa, porque conta fatos em sequência no tempo",
          ),
          t(
            "There is an order, but no characters and nothing that happened: the text tells the reader what to do.",
            "Há uma ordem, mas não há personagens nem fatos acontecidos: o texto manda fazer, não conta o que aconteceu.",
          ),
          t(
            "Confuses steps in order with a narration",
            "Confunde passos em ordem com uma narração",
          ),
        ),
        bankOption(
          t(
            "Descriptive, because it portrays the finished cake",
            "Descritiva, porque caracteriza o bolo pronto",
          ),
          t(
            "The text barely describes the cake; it says how to make it.",
            "O texto quase não descreve o bolo; ele diz como prepará-lo.",
          ),
          t(
            "Takes a recipe for a description of the product",
            "Toma uma receita por uma descrição do produto",
          ),
        ),
        bankOption(
          t(
            "Argumentative, because it argues that a mug cake is practical",
            "Argumentativa, porque defende que o bolo de caneca é prático",
          ),
          t(
            "No opinion is defended. The text doesn't try to convince anyone; it only guides.",
            "Nenhuma opinião é defendida. O texto não tenta convencer, só orienta.",
          ),
          t("Sees a thesis where there are only instructions", "Vê uma tese onde só há instruções"),
        ),
        bankOption(
          t(
            "Expository, because it explains why the cake rises in the microwave",
            "Expositiva, porque explica por que o bolo cresce no micro-ondas",
          ),
          t(
            "The text explains no cause at all; it says what to do, not why.",
            "O texto não explica causa nenhuma; diz o que fazer, não por quê.",
          ),
          t(
            "Credits the text with an explanation it doesn't give",
            "Atribui ao texto uma explicação que ele não dá",
          ),
        ),
      ],
      question: t(
        "The discourse sequence that dominates this text is:",
        "A sequência discursiva que predomina nesse texto é a:",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "sequence-recipe-instructions",
    skill: "discourse-sequences",
  },
  {
    content: {
      context: t(
        'Text message received on a phone: "BANK NOTICE: your account has been blocked. To unblock it, click the link and confirm your password within 1 hour."',
        'Mensagem recebida por SMS: "BANCO INFORMA: sua conta foi bloqueada. Para desbloquear, clique no link e confirme sua senha em até 1 hora."',
      ),
      options: [
        bankOption(
          t(
            "It imitates the language of an official notice but asks for the password and rushes the reader, as scams do",
            "Imita a linguagem de um aviso oficial, mas pede a senha e impõe pressa, como fazem os golpes",
          ),
          t(
            "Banks don't ask for passwords through links. The short deadline is there so the reader acts without thinking.",
            "Bancos não pedem senha por link. O prazo curto serve para o leitor agir sem pensar.",
          ),
        ),
        bankOption(
          t(
            "It starts in capital letters, which no bank uses",
            "Começa em letras maiúsculas, que nenhum banco usa",
          ),
          t(
            "Capital letters show up in many real notices. What gives the scam away is the rushed request for a password.",
            "Maiúsculas aparecem em muitos avisos legítimos. O que denuncia o golpe é o pedido de senha com pressa.",
          ),
          t(
            "Judges the text by its lettering, not by what it asks for",
            "Julga o texto pela forma das letras, e não pelo que ele pede",
          ),
        ),
        bankOption(
          t(
            "It is too short to be a message from a bank",
            "É curto demais para ser uma comunicação bancária",
          ),
          t(
            "Real bank messages are short too. Length doesn't tell a scam from a notice.",
            "Mensagens bancárias legítimas também são curtas. O tamanho não diz se é golpe.",
          ),
          t(
            "Takes the text's length as proof of fraud",
            "Toma o tamanho do texto como prova de fraude",
          ),
        ),
        bankOption(
          t(
            "It doesn't give the customer's name, which the law requires",
            "Não informa o nome do cliente, o que é obrigatório por lei",
          ),
          t(
            "No law requires a customer's name in a text message. The warning signs are the password and the rush.",
            "Nenhuma lei exige o nome do cliente num SMS. O alerta vem do pedido de senha e da pressa.",
          ),
          t(
            "Makes up a legal requirement to justify the suspicion",
            "Inventa uma exigência legal para justificar a desconfiança",
          ),
        ),
        bankOption(
          t(
            "Banks are banned from sending text messages",
            "Os bancos são proibidos de enviar mensagens por SMS",
          ),
          t(
            "Banks send text messages for notices and codes. The problem is a link that asks for the password.",
            "Bancos usam SMS para avisos e códigos. O problema é o link que pede a senha.",
          ),
          t(
            "Thinks the channel, not the content, makes the text suspicious",
            "Acha que o meio, e não o conteúdo, torna o texto suspeito",
          ),
        ),
      ],
      question: t(
        "Given where it circulates, this text should be read with suspicion because:",
        "Considerando o contexto em que circula, esse texto deve ser lido com desconfiança porque:",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "context-bank-message",
    skill: "texts-in-context",
  },
  {
    content: {
      context: t(
        'In a short story set in rural Minas Gerais, a character asks his neighbor: "Uai, sô, ocê num vai na festa da padroeira não?" (roughly, "Well now, aren\'t you going to the patron saint\'s festival?")',
        'Num conto ambientado no interior de Minas Gerais, um personagem pergunta à vizinha: "Uai, sô, ocê num vai na festa da padroeira não?"',
      ),
      options: [
        bankOption(
          t(
            "Uses a regional variety to make the character and the place believable",
            "Usa uma variedade regional para dar verossimilhança ao personagem e ao lugar",
          ),
          t(
            '"Uai", "sô" and "ocê" mark the speech of Minas Gerais and place the character in his community.',
            '"Uai", "sô" e "ocê" marcam o falar mineiro e situam o personagem na sua comunidade.',
          ),
        ),
        bankOption(
          t(
            "Makes Portuguese mistakes the book's editors should have fixed",
            "Comete erros de português que a revisão do livro deveria ter corrigido",
          ),
          t(
            "In a character's speech, a regional variety is an expressive choice, not a mistake.",
            "Na fala de um personagem, a variedade regional é uma escolha expressiva, não um erro.",
          ),
          t("Treats linguistic variation as error", "Trata variação linguística como erro"),
        ),
        bankOption(
          t(
            "Shows that the character can't communicate",
            "Mostra que o personagem não sabe se comunicar",
          ),
          t(
            "The question is perfectly clear. Speaking another variety isn't failing to communicate.",
            "A pergunta é perfeitamente compreensível. Falar outra variedade não é falta de comunicação.",
          ),
          t(
            "Confuses a nonstandard variety with failing to communicate",
            "Confunde variedade não padrão com falha de comunicação",
          ),
        ),
        bankOption(
          t(
            "Imitates the formal language of religious ceremonies",
            "Imita a linguagem formal usada em cerimônias religiosas",
          ),
          t(
            "The line is informal and everyday. The patron saint's festival is only its topic.",
            "A fala é informal e cotidiana. A festa da padroeira é só o assunto.",
          ),
          t(
            "Takes the religious topic for the register of the speech",
            "Toma o tema religioso pelo registro da fala",
          ),
        ),
        bankOption(
          t(
            "Uses internet slang to attract young readers",
            "Usa gírias da internet para atrair leitores jovens",
          ),
          t(
            "These forms come from how people speak in a region, not from the internet.",
            "Essas formas vêm da fala de uma região, não da internet.",
          ),
          t(
            "Confuses regional variation with a group's slang",
            "Confunde variação regional com gíria de um grupo",
          ),
        ),
      ],
      question: t(
        "By writing the character's line this way, the author:",
        "Ao reproduzir assim a fala do personagem, o autor:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "variation-rural-dialogue",
    skill: "language-variation",
  },
  {
    content: {
      context: t(
        'A sign on a bakery door reads: "Passe aqui e tome um cafezinho com a gente!" ("Stop by and have a little coffee with us!")',
        'Na porta de uma padaria, um cartaz diz: "Passe aqui e tome um cafezinho com a gente!"',
      ),
      options: [
        bankOption(
          t(
            "Warmth and closeness, making the invitation welcoming",
            "Cordialidade e intimidade, tornando o convite acolhedor",
          ),
          t(
            'In "cafezinho", the diminutive isn\'t mainly about size: it sets a warm tone, like an invitation between friends.',
            'Em "cafezinho", o diminutivo não fala principalmente de tamanho: cria um tom afetivo, de convite entre amigos.',
          ),
        ),
        bankOption(
          t(
            "That the coffee served is smaller than usual",
            "Que o café servido é menor que o comum",
          ),
          t(
            "The sign says nothing about size. Here the diminutive is affectionate.",
            "O cartaz não fala de tamanho. O diminutivo aqui tem valor afetivo.",
          ),
          t(
            "Reads the diminutive only as small size",
            "Lê o diminutivo só como indicação de tamanho",
          ),
        ),
        bankOption(
          t("Contempt for the competitors' coffee", "Desprezo pelo café da concorrência"),
          t(
            "The sign compares itself to no one. Its tone is an invitation.",
            "O cartaz não se compara a ninguém. O tom é de convite.",
          ),
          t(
            "Gives the diminutive a pejorative sense the context doesn't support",
            "Atribui ao diminutivo um sentido pejorativo que o contexto não tem",
          ),
        ),
        bankOption(
          t("That the coffee is free", "Que o café é gratuito"),
          t(
            "The sign invites people in but doesn't say the coffee costs nothing.",
            "O cartaz convida, mas não diz que o café é de graça.",
          ),
          t(
            "Draws information the text doesn't give",
            "Tira do texto uma informação que ele não dá",
          ),
        ),
        bankOption(
          t(
            "Technical precision, like baristas' jargon",
            "Precisão técnica, como no jargão de baristas",
          ),
          t(
            '"Cafezinho" is an everyday word, nothing technical.',
            '"Cafezinho" é uma palavra do dia a dia, nada técnica.',
          ),
          t(
            "Confuses an everyday affectionate word with a technical term",
            "Confunde uma palavra afetiva do cotidiano com um termo técnico",
          ),
        ),
      ],
      question: t(
        'On the sign, the diminutive in "cafezinho" mainly expresses:',
        'No cartaz, o diminutivo em "cafezinho" expressa principalmente:',
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "word-choice-diminutive",
    skill: "word-choice-effects",
  },
  {
    content: {
      context: t(
        "The number of shared bikes in the city doubled in two years. However, the bike lanes are still concentrated in the central neighborhoods.",
        "O número de bicicletas compartilhadas na cidade dobrou em dois anos. No entanto, as ciclovias continuam concentradas nos bairros centrais.",
      ),
      options: [
        bankOption(
          t(
            "Contrast, since the second fact goes against what the first one leads us to expect",
            "Oposição, pois a segunda informação contraria a expectativa criada pela primeira",
          ),
          t(
            "If bikes doubled, you'd expect bike lanes all over the city. The second sentence goes against that.",
            "Se as bicicletas dobraram, espera-se ciclovias por toda a cidade. A segunda frase contraria essa expectativa.",
          ),
        ),
        bankOption(
          t(
            "Cause, since the lanes being concentrated explains the rise in bikes",
            "Causa, pois a concentração das ciclovias explica o aumento das bicicletas",
          ),
          t(
            "The connective doesn't introduce a cause, and the text never says one fact led to the other.",
            '"No entanto" não introduz causa, e o texto não diz que um fato provocou o outro.',
          ),
          t(
            "Confuses a contrast connective with a causal one",
            "Confunde conectivo adversativo com causal",
          ),
        ),
        bankOption(
          t(
            "Conclusion, since the second sentence sums up the first",
            "Conclusão, pois a segunda frase resume a primeira",
          ),
          t(
            "The second sentence brings a new, opposing fact, not a summary.",
            "A segunda frase traz um fato novo e contrário, não um resumo.",
          ),
          t(
            "Confuses a contrast connective with a concluding one",
            "Confunde conectivo adversativo com conclusivo",
          ),
        ),
        bankOption(
          t(
            "Addition, since it just adds one more favorable fact",
            "Adição, pois apenas acrescenta mais um dado favorável",
          ),
          t(
            "The new fact isn't favorable: it shows a limit to the progress.",
            "O dado novo não é favorável: mostra um limite do avanço.",
          ),
          t(
            "Ignores the contrast and reads the connective as adding",
            "Ignora o contraste e lê o conectivo como soma",
          ),
        ),
        bankOption(
          t(
            "Time, since it shows the lanes came after the bikes",
            "Tempo, pois indica que as ciclovias vieram depois das bicicletas",
          ),
          t(
            "The connective doesn't mark an order in time.",
            '"No entanto" não marca sequência no tempo.',
          ),
          t(
            "Confuses a contrast connective with a time one",
            "Confunde conectivo adversativo com temporal",
          ),
        ),
      ],
      question: t(
        'The relation that "However" sets up between the two sentences is one of:',
        'A expressão "No entanto" estabelece entre as duas frases uma relação de:',
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "cohesion-however",
    skill: "cohesion",
  },
  {
    content: {
      context: t(
        "A candidate sent this email to a company: \"Hey guys! Saw your job opening and I'm in. Send me the info and I'll swing by tomorrow.\"",
        'Um candidato enviou este e-mail a uma empresa: "E aí, galera! Vi a vaga de vocês e tô dentro. Manda as infos aí que eu passo lá amanhã."',
      ),
      options: [
        bankOption(
          t(
            "Doesn't fit, because a job application calls for a formal register and the text uses the language of a chat between friends",
            "É inadequada, porque uma candidatura pede registro formal e o texto usa linguagem de conversa entre amigos",
          ),
          t(
            'Words like "guys", "I\'m in" and "swing by" work among friends, not with a possible employer.',
            'Termos como "galera", "tô dentro" e "infos" funcionam entre amigos, mas não com um possível empregador.',
          ),
        ),
        bankOption(
          t(
            "Is wrong, because informal language is always a mistake",
            "Está errada, porque a linguagem informal é sempre um erro",
          ),
          t(
            "Informal language fits many situations, such as talking with friends. The problem is using it in this one.",
            "A linguagem informal é adequada em muitas situações, como entre amigos. O problema é usá-la nesta.",
          ),
          t(
            "Thinks informal language is wrong in any situation",
            "Acha que o informal é errado em qualquer situação",
          ),
        ),
        bankOption(
          t(
            "Fits, because it shows enthusiasm, which is what companies value",
            "É adequada, porque mostra entusiasmo, que é o que as empresas valorizam",
          ),
          t(
            "Enthusiasm can come through in a formal register. Here, the casual tone counts against the candidate.",
            "O entusiasmo pode aparecer num registro formal. Aqui, o tom informal pesa contra o candidato.",
          ),
          t(
            "Values the tone without weighing the situation",
            "Valoriza o tom sem considerar a situação",
          ),
        ),
        bankOption(
          t(
            "Fits, because emails never need any formality",
            "É adequada, porque e-mails dispensam qualquer formalidade",
          ),
          t(
            "Formality depends on who is writing to whom, not on the channel. An email to a company calls for a formal register.",
            "A formalidade depende de quem fala com quem, não do meio. Um e-mail a uma empresa pede registro formal.",
          ),
          t(
            "Thinks the channel, not the situation, sets the register",
            "Acha que o meio, e não a situação, define o registro",
          ),
        ),
        bankOption(
          t(
            "Doesn't fit only because the email is too short",
            "É inadequada só porque o e-mail é curto demais",
          ),
          t(
            "A short, formal email would be fine. The problem is the register, not the length.",
            "Um e-mail curto e formal seria adequado. O problema é o registro, não o tamanho.",
          ),
          t("Confuses length with fitting the situation", "Confunde extensão com adequação"),
        ),
      ],
      question: t(
        "Given the situation, the language of the email:",
        "Considerando a situação de comunicação, a linguagem do e-mail:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "norm-job-email",
    skill: "standard-norm",
  },
  {
    content: {
      context: t(
        "Banning phones in classrooms isn't backward, it's care. Studies in several countries link using the device during class to more distraction and lower grades. Besides, without phones, students start talking to each other at recess again. That doesn't mean giving up technology: computers and tablets can be used in activities the teacher plans.",
        "Proibir o celular nas salas de aula não é atraso, é cuidado. Pesquisas em vários países associam o uso do aparelho durante a aula a mais distração e a notas menores. Além disso, sem o celular, os alunos voltam a conversar no recreio. Isso não significa abandonar a tecnologia: computadores e tablets podem ser usados em atividades planejadas pelo professor.",
      ),
      options: [
        bankOption(
          t(
            "Banning phones in class is a way of caring for students",
            "Proibir o celular em sala de aula é uma medida de cuidado com os alunos",
          ),
          t(
            "It's the claim that opens the text, and the other points (distraction, grades, talking at recess) support it.",
            "É a ideia que abre o texto, e os outros argumentos (distração, notas, convivência no recreio) a sustentam.",
          ),
        ),
        bankOption(
          t(
            "Students should give up technology at school",
            "Os alunos devem abandonar a tecnologia na escola",
          ),
          t(
            "The author says the opposite: computers and tablets are still useful in planned activities.",
            "O autor diz o contrário: computadores e tablets seguem úteis em atividades planejadas.",
          ),
          t("Reads one of the text's caveats backwards", "Lê uma ressalva do texto ao contrário"),
        ),
        bankOption(
          t(
            "Studies link using phones in class to lower grades",
            "Pesquisas associam o uso do celular em aula a notas menores",
          ),
          t(
            "That's evidence the text uses as an argument, not the position it defends.",
            "Isso é um dado usado como argumento, não a posição que o texto defende.",
          ),
          t("Takes an argument for the thesis", "Toma um argumento pela tese"),
        ),
        bankOption(
          t(
            "Students talk more at recess when they have phones",
            "Os alunos conversam mais no recreio quando têm celular",
          ),
          t(
            "The text says the opposite: without phones, they start talking again.",
            "O texto diz o oposto: sem o celular, eles voltam a conversar.",
          ),
          t("Reverses something the text says", "Inverte uma informação do texto"),
        ),
        bankOption(
          t(
            "Teachers don't know how to use technology in class",
            "Os professores não sabem usar a tecnologia em aula",
          ),
          t(
            "The text doesn't criticize teachers; it has them plan how computers and tablets are used.",
            "O texto não critica os professores; propõe que eles planejem o uso de computadores e tablets.",
          ),
          t(
            "Credits the author with a criticism the text doesn't make",
            "Atribui ao autor uma crítica que o texto não faz",
          ),
        ),
      ],
      question: t("The author's thesis is that:", "A tese defendida pelo autor é a de que:"),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "thesis-school-phones",
    skill: "thesis-arguments",
  },
  {
    content: {
      context: t(
        'An online store ad: "LAST UNITS LEFT! The sneakers everyone is wearing, 40% off. The offer ends at midnight."',
        'Anúncio de uma loja virtual: "ÚLTIMAS UNIDADES! O tênis que todo mundo está usando, com 40% de desconto. A oferta acaba à meia-noite."',
      ),
      options: [
        bankOption(
          t(
            "Urgency and the idea that everyone has already joined in, so the reader decides fast",
            "Urgência e à ideia de que todos já aderiram, para que o leitor decida rápido",
          ),
          t(
            '"Last units" and "ends at midnight" create pressure; "everyone is wearing" appeals to wanting to belong.',
            '"Últimas unidades" e "acaba à meia-noite" criam pressa; "todo mundo está usando" apela ao desejo de pertencer.',
          ),
        ),
        bankOption(
          t(
            "A technical comparison of several sneakers' quality",
            "Comparação técnica entre a qualidade de vários tênis",
          ),
          t(
            "The ad compares no products and gives no technical data.",
            "O anúncio não compara nenhum produto nem dá dado técnico.",
          ),
          t("Sees information the ad doesn't give", "Vê no anúncio informações que ele não traz"),
        ),
        bankOption(
          t("The opinion of footwear experts", "Opinião de especialistas em calçados"),
          t(
            "No expert is quoted. The ad leans on what everyone does, not on an authority.",
            "Nenhum especialista é citado. O apoio é o que todo mundo faz, não uma autoridade.",
          ),
          t(
            "Confuses an appeal to the crowd with an appeal to authority",
            "Confunde apelo à maioria com apelo à autoridade",
          ),
        ),
        bankOption(
          t(
            "A detailed explanation of how the discount is worked out",
            "Explicação detalhada de como o desconto é calculado",
          ),
          t(
            "The ad only gives the percentage and explains nothing.",
            "O anúncio só dá o percentual, sem explicar nada.",
          ),
          t(
            "Credits the text with an explanation it doesn't have",
            "Atribui ao texto um conteúdo explicativo que ele não tem",
          ),
        ),
        bankOption(
          t("Irony, to criticize consumerism", "Ironia, para criticar o consumismo"),
          t(
            "The ad wants to sell, not to criticize buying. There's no irony in it.",
            "O anúncio quer vender, não criticar o consumo. Não há ironia nele.",
          ),
          t("Reads criticism where there is only persuasion", "Lê crítica onde há só persuasão"),
        ),
      ],
      question: t(
        "To get the reader to buy, the ad relies mainly on:",
        "Para convencer o leitor a comprar, o anúncio recorre principalmente à:",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "persuasion-last-units",
    skill: "persuasion",
  },
  {
    content: {
      context: t(
        'A father, annoyed, says to his son: "I\'ve explained this to you a million times!"',
        'Um pai, irritado, diz ao filho: "Já te expliquei isso um milhão de vezes!"',
      ),
      options: [
        bankOption(
          t(
            "Hyperbole, a deliberate exaggeration that stresses the father's irritation",
            "Hipérbole, um exagero intencional que reforça a irritação do pai",
          ),
          t(
            "Nobody explains something a million times. The exaggeration shows how tired he is of repeating himself.",
            "Ninguém explica algo um milhão de vezes. O exagero mostra como ele está cansado de repetir.",
          ),
        ),
        bankOption(
          t(
            "Metaphor, because it compares the explanation to a number",
            "Metáfora, porque compara a explicação a um número",
          ),
          t(
            "Nothing is compared to anything else; a number is blown up on purpose.",
            "Não há comparação entre duas coisas; há um número exagerado de propósito.",
          ),
          t(
            "Calls any figurative meaning a metaphor",
            "Chama de metáfora qualquer sentido figurado",
          ),
        ),
        bankOption(
          t(
            "Irony, because the father means he never explained it",
            "Ironia, porque o pai quer dizer que nunca explicou",
          ),
          t(
            "The father did explain it, several times; he inflates the number instead of saying the opposite of what he means.",
            "O pai explicou várias vezes; ele aumenta o número, em vez de dizer o contrário do que pensa.",
          ),
          t(
            "Confuses exaggeration with saying the opposite",
            "Confunde exagero com dizer o contrário",
          ),
        ),
        bankOption(
          t("Euphemism, because it softens a scolding", "Eufemismo, porque suaviza uma bronca"),
          t(
            "The expression makes the scolding stronger, not softer.",
            "A expressão aumenta a bronca em vez de suavizá-la.",
          ),
          t("Reverses the figure's effect", "Inverte o efeito da figura"),
        ),
        bankOption(
          t(
            "Personification, because it gives a number human actions",
            "Personificação, porque atribui ações humanas a um número",
          ),
          t(
            "The one explaining is the father, not the number. Nothing lifeless takes on human traits.",
            "Quem explica é o pai, não o número. Nada inanimado ganha traços humanos.",
          ),
          t(
            "Sees personification where nothing lifeless acts",
            "Vê personificação onde não há ser inanimado agindo",
          ),
        ),
      ],
      question: t(
        'In the father\'s line, "a million times" is an example of:',
        'Na fala do pai, a expressão "um milhão de vezes" é um exemplo de:',
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "figures-hyperbole",
    skill: "figures-of-speech",
  },
  {
    content: {
      context: t(
        'In 1843, Gonçalves Dias wrote in "Canção do exílio" ("Song of Exile"): "My land has palm trees, / Where the thrush sings". A contemporary poem takes up these lines: "My land has palm trees / where the chainsaw sings; / the thrush has flown away / to look for other lands."',
        'Em 1843, Gonçalves Dias escreveu, em "Canção do exílio": "Minha terra tem palmeiras, / Onde canta o Sabiá". Um poema contemporâneo retoma esses versos: "Minha terra tem palmeiras / onde canta a motosserra; / o sabiá foi embora / procurar uma outra terra."',
      ),
      options: [
        bankOption(
          t(
            "Parodies the praise of Brazil's nature to denounce its destruction",
            "Parodia a exaltação da natureza brasileira para denunciar sua destruição",
          ),
          t(
            "The famous structure stays, but the thrush's song becomes the chainsaw's noise: the idealized homeland gives way to deforestation.",
            "A estrutura famosa é mantida, mas o canto do sabiá vira o barulho da motosserra: a pátria idealizada dá lugar ao desmatamento.",
          ),
        ),
        bankOption(
          t(
            "Repeats the Romantic tribute to the landscape without changing its meaning",
            "Repete a homenagem romântica à paisagem, sem mudar seu sentido",
          ),
          t(
            "The chainsaw and the thrush's flight change the meaning: the tone is critical, not one of praise.",
            "A motosserra e a fuga do sabiá mudam o sentido: o tom é crítico, não de exaltação.",
          ),
          t(
            "Spots the reference but misses the change in meaning",
            "Reconhece a referência, mas não a mudança de sentido",
          ),
        ),
        bankOption(
          t(
            "Copies the original poem, which makes it plagiarism",
            "Copia o poema original, o que caracteriza plágio",
          ),
          t(
            "The borrowing is open and transforms the text. Parody is a legitimate way to create.",
            "A retomada é explícita e transforma o texto. A paródia é um recurso legítimo de criação.",
          ),
          t(
            "Confuses open intertextuality with plagiarism",
            "Confunde intertextualidade assumida com plágio",
          ),
        ),
        bankOption(
          t(
            "Mourns the homesickness of a poet living in exile",
            "Lamenta a saudade de um poeta que vive no exílio",
          ),
          t(
            "The one who leaves is the thrush. The poem is about the land being destroyed, not the poet's exile.",
            "Quem vai embora é o sabiá. O poema fala da destruição da terra, não do exílio do poeta.",
          ),
          t(
            "Gives the new poem the original's theme",
            "Atribui ao novo poema o tema do texto original",
          ),
        ),
        bankOption(
          t(
            "Praises the chainsaw as a symbol of progress",
            "Defende a motosserra como símbolo de progresso",
          ),
          t(
            "The thrush flying away shows a loss, not progress.",
            "A fuga do sabiá mostra perda, não progresso.",
          ),
          t("Reads a critical image as praise", "Lê como elogio uma imagem de crítica"),
        ),
      ],
      question: t(
        "By taking up Gonçalves Dias's lines, the contemporary poem:",
        "Ao retomar os versos de Gonçalves Dias, o poema contemporâneo:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "intertext-song-of-exile",
    skill: "intertextuality",
  },
  {
    content: {
      context: t(
        "Created by enslaved Africans and their descendants in Brazil, capoeira brings together fighting, dance, music and song. For a long time the police persecuted it, and the Penal Code of 1890 made it a crime. In 2008, the capoeira circle was registered as part of Brazil's cultural heritage and, in 2014, UNESCO recognized it as intangible cultural heritage of humanity.",
        "Criada por africanos escravizados e seus descendentes no Brasil, a capoeira reúne luta, dança, música e canto. Por muito tempo foi perseguida pela polícia, e o Código Penal de 1890 a tornou crime. Em 2008, a roda de capoeira foi registrada como patrimônio cultural do Brasil e, em 2014, reconhecida pela Unesco como patrimônio cultural imaterial da humanidade.",
      ),
      options: [
        bankOption(
          t(
            "Went from a repressed practice to a recognized symbol of Afro-Brazilian identity",
            "Passou de prática reprimida a símbolo reconhecido da identidade afro-brasileira",
          ),
          t(
            "The text moves from persecution and a ban to recognition as heritage, of Brazil and of humanity.",
            "O texto vai da perseguição e da criminalização ao reconhecimento como patrimônio, do Brasil e da humanidade.",
          ),
        ),
        bankOption(
          t(
            "Was always encouraged by the Brazilian state",
            "Sempre foi incentivada pelo Estado brasileiro",
          ),
          t(
            "The state itself persecuted it and made it a crime in 1890.",
            "O próprio Estado a perseguiu e a tornou crime em 1890.",
          ),
          t("Ignores the persecution the text reports", "Ignora a perseguição que o texto relata"),
        ),
        bankOption(
          t(
            "Is just a competitive sport, unrelated to culture",
            "É apenas um esporte de competição, sem relação com a cultura",
          ),
          t(
            "The text stresses music, song and history: capoeira was recognized precisely as cultural heritage.",
            "O texto destaca música, canto e história: a capoeira foi reconhecida justamente como patrimônio cultural.",
          ),
          t("Reduces the body practice to sport", "Reduz a prática corporal ao aspecto esportivo"),
        ),
        bankOption(
          t(
            "Was brought ready-made from Africa by Portuguese colonizers",
            "Foi trazida pronta da África pelos colonizadores portugueses",
          ),
          t(
            "It was created in Brazil by enslaved Africans and their descendants, not by the colonizers.",
            "Ela foi criada no Brasil por africanos escravizados e seus descendentes, não pelos colonizadores.",
          ),
          t("Confuses who created the practice and where", "Confunde quem criou a prática e onde"),
        ),
        bankOption(
          t(
            "Stopped being practiced after it was banned",
            "Deixou de ser praticada depois de ser proibida",
          ),
          t(
            "It outlasted the ban and came to be recognized as heritage.",
            "Ela resistiu à proibição e chegou a ser reconhecida como patrimônio.",
          ),
          t("Thinks the ban ended the practice", "Acha que a proibição encerrou a prática"),
        ),
      ],
      question: t(
        "The history of capoeira the text describes shows that this body practice:",
        "A trajetória da capoeira descrita no texto mostra que essa prática corporal:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "body-capoeira-heritage",
    skill: "body-practices",
  },
  {
    content: {
      context: t(
        "In February 1922, at the Municipal Theater of São Paulo, artists and writers such as Mário de Andrade, Oswald de Andrade and Anita Malfatti held the Modern Art Week. They rejected academic models imported from Europe, such as the strict form of Parnassian poetry, and called for art tied to spoken language and Brazilian reality.",
        "Em fevereiro de 1922, no Theatro Municipal de São Paulo, artistas e escritores como Mário de Andrade, Oswald de Andrade e Anita Malfatti realizaram a Semana de Arte Moderna. Eles recusavam os modelos acadêmicos importados da Europa, como o rigor formal do Parnasianismo, e defendiam uma arte ligada à língua falada e à realidade brasileira.",
      ),
      options: [
        bankOption(
          t(
            "It sought a national artistic voice in a country marking a hundred years of independence, with São Paulo industrializing fast",
            "Buscava uma expressão artística nacional num país que completava cem anos de independência, com São Paulo em rápida industrialização",
          ),
          t(
            "1922 was the centennial of Independence, and São Paulo was growing with industry. The modernists wanted art that spoke for that Brazil.",
            "1922 era o centenário da Independência, e São Paulo crescia com a indústria. Os modernistas queriam uma arte que dissesse esse Brasil.",
          ),
        ),
        bankOption(
          t(
            "It called for a return to the classical forms of Parnassianism",
            "Defendia a volta às formas clássicas do Parnasianismo",
          ),
          t(
            "The modernists attacked Parnassianism; they didn't want to go back to it.",
            "Os modernistas atacavam o Parnasianismo; não queriam voltar a ele.",
          ),
          t("Reverses the modernists' position", "Inverte a posição dos modernistas"),
        ),
        bankOption(
          t(
            "It wanted to copy the European avant-gardes faithfully, without adapting them",
            "Queria copiar fielmente as vanguardas europeias, sem adaptá-las",
          ),
          t(
            "They knew the avant-gardes but used them to create Brazilian art, not to imitate them.",
            "Eles conheciam as vanguardas, mas as usavam para criar uma arte brasileira, não para imitá-las.",
          ),
          t(
            "Confuses engaging with the avant-gardes and copying them",
            "Confunde dialogar com as vanguardas e copiá-las",
          ),
        ),
        bankOption(
          t(
            "It celebrated the Proclamation of the Republic, a hundred years earlier",
            "Comemorava a Proclamação da República, ocorrida cem anos antes",
          ),
          t(
            "A hundred years earlier, in 1822, came Independence. The Republic was proclaimed in 1889.",
            "Cem anos antes, em 1822, veio a Independência. A República foi proclamada em 1889.",
          ),
          t(
            "Confuses Independence with the Proclamation of the Republic",
            "Confunde a Independência com a Proclamação da República",
          ),
        ),
        bankOption(
          t(
            "It rejected the language spoken in Brazil as wrong",
            "Rejeitava a língua falada no Brasil, considerada errada",
          ),
          t(
            "It was the other way around: the modernists valued the language Brazilians actually spoke.",
            "Era o contrário: os modernistas valorizavam a língua falada pelos brasileiros.",
          ),
          t(
            "Credits the modernists with the view they fought",
            "Atribui aos modernistas a visão que eles combatiam",
          ),
        ),
      ],
      question: t(
        "The 1922 modernists' project relates to the social context of its time because:",
        "O projeto dos modernistas de 1922 relaciona-se ao contexto social da época porque:",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "literature-modernism-1922",
    skill: "literature-society",
  },
  {
    content: {
      context: t(
        "In the 16th and 17th centuries, the coast of Brazil's Northeast was organized around sugar mills: large estates that grew a single crop, used the labor of enslaved Africans and sold their output to Europe.",
        "Nos séculos XVI e XVII, o litoral do Nordeste brasileiro se organizou em torno dos engenhos de açúcar: grandes propriedades que cultivavam um único produto, usavam o trabalho de africanos escravizados e vendiam a produção para a Europa.",
      ),
      options: [
        bankOption(
          t(
            "The interests of the mother country and European merchants, with the colony producing for export",
            "Aos interesses da metrópole e dos comerciantes europeus, com a colônia produzindo para exportação",
          ),
          t(
            "A single crop, large estates, enslaved labor and sales to Europe: the colony existed to make profit for others.",
            "Monocultura, latifúndio, trabalho escravizado e venda para a Europa: a colônia existia para gerar lucro fora dela.",
          ),
        ),
        bankOption(
          t(
            "The local population's need for food",
            "Às necessidades de alimentação da população local",
          ),
          t(
            "The sugar went to Europe. Growing food for the colony came second.",
            "O açúcar ia para a Europa. A produção de alimentos para a colônia era secundária.",
          ),
          t(
            "Confuses export production with subsistence",
            "Confunde produção para exportação com subsistência",
          ),
        ),
        bankOption(
          t("The creation of small family farms", "À formação de pequenas propriedades familiares"),
          t(
            "A sugar estate was a vast landholding, not a small farm.",
            "O engenho era uma grande propriedade, o latifúndio, não uma pequena propriedade.",
          ),
          t(
            "Ignores the model's concentration of land",
            "Ignora a concentração de terras do modelo",
          ),
        ),
        bankOption(
          t(
            "The colony's industrialization, which began exporting machines",
            "À industrialização da colônia, que passou a exportar máquinas",
          ),
          t(
            "The colony exported farm goods. The mother country restricted manufacturing.",
            "A colônia exportava produtos agrícolas. As manufaturas eram restringidas pela metrópole.",
          ),
          t(
            "Projects industrialization onto an agrarian colonial period",
            "Projeta a industrialização num período colonial agrário",
          ),
        ),
        bankOption(
          t(
            "The employment of European immigrants for wages",
            "Ao emprego de imigrantes europeus assalariados",
          ),
          t(
            "The labor came from enslaved Africans. Mass European immigration came in the 19th century.",
            "A mão de obra era de africanos escravizados. A imigração europeia em massa veio no século XIX.",
          ),
          t(
            "Confuses labor on the sugar estates with labor on 19th-century coffee farms",
            "Confunde o trabalho nos engenhos com o dos cafezais do século XIX",
          ),
        ),
      ],
      question: t(
        "This model, known as the plantation, mainly served:",
        "Esse modelo, conhecido como plantation, atendia principalmente:",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "colonial-sugar-plantation",
    skill: "colonial-relations",
  },
  {
    content: {
      context: t(
        "Barred from practicing their religions freely, many enslaved Africans and their descendants in Brazil linked their orishas to Catholic saints. In Salvador, for example, the Washing of Bonfim brings together Catholics and followers of African-rooted religions, who link the Lord of Bonfim to Oxalá.",
        "Proibidos de praticar livremente suas religiões, muitos africanos escravizados e seus descendentes no Brasil associaram seus orixás a santos católicos. Em Salvador, por exemplo, a Lavagem do Bonfim reúne católicos e fiéis de religiões de matriz africana, que associam o Senhor do Bonfim a Oxalá.",
      ),
      options: [
        bankOption(
          t(
            "Religious syncretism, which blends traditions and expresses cultural resistance",
            "Sincretismo religioso, que mistura tradições e expressa resistência cultural",
          ),
          t(
            "Linking orishas to saints let African beliefs survive under Catholic watch, and the blend is still alive.",
            "Associar orixás a santos permitiu manter crenças africanas sob a vigilância católica, e essa mistura segue viva.",
          ),
        ),
        bankOption(
          t(
            "Enslaved people completely abandoning African religions",
            "Abandono completo das religiões africanas pelos escravizados",
          ),
          t(
            "African beliefs were kept, disguised and recreated, not abandoned.",
            "As crenças africanas foram mantidas, disfarçadas e recriadas, não abandonadas.",
          ),
          t("Reads adaptation as disappearance", "Lê adaptação como desaparecimento"),
        ),
        bankOption(
          t(
            "African religion being imposed on Portuguese colonizers",
            "Imposição da religião africana aos colonizadores portugueses",
          ),
          t(
            "The colonizers had the power to impose a religion. The blend was a strategy of those they ruled.",
            "Quem tinha poder para impor a religião era o colonizador. A mistura foi uma estratégia dos dominados.",
          ),
          t(
            "Reverses who held power in the colonial relation",
            "Inverte quem tinha poder na relação colonial",
          ),
        ),
        bankOption(
          t(
            "A strict separation between Catholics and followers of Afro-Brazilian religions",
            "Separação rígida entre católicos e fiéis de religiões afro-brasileiras",
          ),
          t(
            "The Washing of Bonfim shows the opposite: both groups celebrate together.",
            "A Lavagem do Bonfim mostra o contrário: os dois grupos celebram juntos.",
          ),
          t("Contradicts the text's example", "Contradiz o exemplo dado no texto"),
        ),
        bankOption(
          t(
            "A recent phenomenon that began with the internet",
            "Um fenômeno recente, surgido com a internet",
          ),
          t(
            "Linking orishas to saints goes back to colonial times.",
            "A associação entre orixás e santos vem do período colonial.",
          ),
          t("Ignores the process's historical roots", "Ignora a origem histórica do processo"),
        ),
      ],
      question: t(
        "The process the text describes is an example of:",
        "O processo descrito no texto é um exemplo de:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "identity-religious-syncretism",
    skill: "cultural-identities",
  },
  {
    content: {
      context: t(
        "App delivery workers use their own motorbike or bicycle, are paid per delivery and usually have no paid vacation or thirteenth-month salary. The platforms say they are independent partners; many workers say the app controls their prices, routes and penalties.",
        "Entregadores de aplicativo trabalham com a própria moto ou bicicleta, recebem por entrega e, em geral, não têm férias remuneradas nem 13º salário. As plataformas afirmam que eles são parceiros autônomos; muitos entregadores dizem que o aplicativo controla seus preços, rotas e punições.",
      ),
      options: [
        bankOption(
          t(
            "More precarious work, with risks and costs shifted to workers who lack the protections of formal employment",
            "A precarização, com riscos e custos transferidos ao trabalhador sem as proteções do emprego formal",
          ),
          t(
            "The worker pays for the vehicle, earns per task and lacks the rights of formal employment, while the platform controls the work.",
            "O entregador paga o veículo, ganha por tarefa e não tem os direitos do emprego formal, enquanto a plataforma controla o trabalho.",
          ),
        ),
        bankOption(
          t(
            "Stronger unions and labor rights",
            "O fortalecimento dos sindicatos e dos direitos trabalhistas",
          ),
          t(
            "The text shows workers without paid vacation or a thirteenth-month salary, that is, with fewer rights.",
            "O texto mostra trabalhadores sem férias nem 13º, isto é, com menos direitos.",
          ),
          t("Reverses the trend described", "Inverte a tendência descrita"),
        ),
        bankOption(
          t(
            "A return of slavery, since there is no pay",
            "A volta da escravidão, já que não há pagamento",
          ),
          t(
            "The workers are paid per delivery. This is precarious work, not unpaid labor or people held as property.",
            "Os entregadores recebem por entrega. Há precarização, não ausência de pagamento nem posse de pessoas.",
          ),
          t("Confuses precarious work with slavery", "Confunde trabalho precário com escravidão"),
        ),
        bankOption(
          t(
            "Complete independence for the worker, who decides everything about the job",
            "A autonomia total do trabalhador, que decide tudo sobre o serviço",
          ),
          t(
            "According to the workers, the app controls prices, routes and penalties.",
            "Segundo os entregadores, o aplicativo controla preços, rotas e punições.",
          ),
          t(
            "Takes the platforms' claim at face value, ignoring the control the workers report",
            "Aceita o discurso das plataformas sem considerar o controle relatado",
          ),
        ),
        bankOption(
          t(
            "The end of human work, replaced by robots",
            "O fim do trabalho humano, substituído por robôs",
          ),
          t(
            "People still make the deliveries. Technology organizes the work; it doesn't eliminate it.",
            "As entregas ainda são feitas por pessoas. A tecnologia organiza o trabalho, não o elimina.",
          ),
          t("Confuses platform work with automation", "Confunde plataformização com automação"),
        ),
      ],
      question: t(
        "The situation described shows a trend in today's world of work:",
        "A situação descrita evidencia uma tendência do mundo do trabalho atual:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "labor-app-delivery",
    skill: "production-and-labor",
  },
  {
    content: {
      context: t(
        "Found only in Brazil, it covers much of the Northeast. It has a semi-arid climate, scarce and irregular rain, and rivers that dry up for part of the year. In the dry season, many plants shed their leaves; others, such as cacti, store water.",
        "Domínio exclusivamente brasileiro, ocupa boa parte do Nordeste. Tem clima semiárido, chuvas escassas e irregulares e rios que secam em parte do ano. Na estiagem, muitas plantas perdem as folhas; outras, como os cactos, armazenam água.",
      ),
      options: [
        bankOption(
          t("The Caatinga", "A Caatinga"),
          t(
            "A semi-arid climate, seasonal rivers, plants that shed their leaves and cacti: it's the Caatinga, found only in Brazil.",
            "Semiárido, rios intermitentes, plantas que perdem as folhas e cactos: é a Caatinga, que só existe no Brasil.",
          ),
        ),
        bankOption(
          t("The Amazon", "A Amazônia"),
          t(
            "The Amazon is hot and very rainy, with a dense forest that stays green.",
            "A Amazônia é quente e muito chuvosa, com floresta densa sempre verde.",
          ),
          t("Ignores the dry-climate clues", "Ignora as pistas de clima seco"),
        ),
        bankOption(
          t("The Pantanal", "O Pantanal"),
          t(
            "The Pantanal is a plain in the Center-West that floods in the wet season.",
            "O Pantanal é uma planície do Centro-Oeste que alaga na cheia.",
          ),
          t(
            "Confuses the Caatinga's dry season with the Pantanal's floods and dry spells",
            "Confunde a seca da Caatinga com a alternância de cheia e vazante do Pantanal",
          ),
        ),
        bankOption(
          t("The Atlantic Forest", "A Mata Atlântica"),
          t(
            "The Atlantic Forest is humid and lies along the coast, with dense forest.",
            "A Mata Atlântica é úmida e fica no litoral, com floresta densa.",
          ),
          t(
            "Links the domain to the Northeast without weighing its climate",
            "Liga o domínio ao Nordeste sem considerar o clima",
          ),
        ),
        bankOption(
          t("The Pampas", "O Pampa"),
          t(
            "The Pampas are grasslands in the far South, with a subtropical climate and rain all year.",
            "O Pampa é formado por campos do extremo Sul, com clima subtropical e chuvas bem distribuídas.",
          ),
          t(
            "Confuses low vegetation with dry-climate vegetation",
            "Confunde vegetação baixa com vegetação de clima seco",
          ),
        ),
      ],
      question: t("The natural domain described is:", "O domínio natural descrito é:"),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "domain-caatinga",
    skill: "natural-domains",
  },
  {
    content: {
      context: t(
        "On a road atlas page at a scale of 1:500,000, two towns are 6 cm apart in a straight line.",
        "Num mapa rodoviário na escala 1:500.000, duas cidades estão a 6 cm uma da outra, em linha reta.",
      ),
      options: [
        bankOption(
          t("30 km", "30 km"),
          t(
            "Each centimeter stands for 500,000 cm, which is 5 km. So 6 cm stand for 6 × 5 km = 30 km.",
            "Cada centímetro vale 500.000 cm, ou seja, 5 km. Então 6 cm valem 6 × 5 km = 30 km.",
          ),
        ),
        bankOption(
          t("3 km", "3 km"),
          t(
            "That takes 1 cm as 0.5 km, but 500,000 cm are 5 km.",
            "Isso usa 1 cm = 0,5 km, mas 500.000 cm são 5 km.",
          ),
          t(
            "Gets the centimeters-to-kilometers conversion wrong",
            "Erra a conversão de centímetros para quilômetros",
          ),
        ),
        bankOption(
          t("300 km", "300 km"),
          t(
            "That takes 1 cm as 50 km, but 500,000 cm are 5 km.",
            "Isso usa 1 cm = 50 km, mas 500.000 cm são 5 km.",
          ),
          t(
            "Moves the decimal point one place too far in the conversion",
            "Erra a conversão em uma casa decimal para mais",
          ),
        ),
        bankOption(
          t("5 km", "5 km"),
          t(
            "5 km is what each centimeter stands for. The towns are 6 cm apart.",
            "5 km é o que vale cada centímetro. As cidades estão a 6 cm.",
          ),
          t(
            "Stops at what 1 cm stands for and forgets to multiply",
            "Para no valor de 1 cm e esquece de multiplicar",
          ),
        ),
        bankOption(
          t("11 km", "11 km"),
          t(
            "A scale multiplies: 6 cm stand for 6 × 5 km.",
            "A escala multiplica: 6 cm valem 6 × 5 km.",
          ),
          t("Adds 6 and 5 instead of multiplying", "Soma 6 e 5 em vez de multiplicar"),
        ),
      ],
      question: t(
        "The real straight-line distance between the two towns is:",
        "A distância real, em linha reta, entre as duas cidades é de:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "scale-two-towns",
    skill: "map-scale-coordinates",
  },
  {
    content: {
      context: t(
        "In the 17th century, in the Serra da Barriga, in today's state of Alagoas, the Quilombo dos Palmares took shape. It gathered thousands of people and held out against military expeditions for almost a century. Its last leader, Zumbi, was killed on November 20, 1695, a date that now marks the National Day of Zumbi and Black Awareness.",
        "No século XVII, na Serra da Barriga, atual Alagoas, formou-se o Quilombo dos Palmares, que reuniu milhares de pessoas e resistiu por quase um século a expedições militares. Seu último líder, Zumbi, foi morto em 20 de novembro de 1695, data que hoje marca o Dia Nacional de Zumbi e da Consciência Negra.",
      ),
      options: [
        bankOption(
          t("Passively accepted slavery", "Aceitaram passivamente a escravidão"),
          t(
            "Escaping, building a community and holding out against military attacks for decades are active ways of fighting slavery.",
            "Fugir, organizar uma comunidade e resistir por décadas a ataques militares são formas ativas de luta contra a escravidão.",
          ),
        ),
        bankOption(
          t("Were brought from Africa by force", "Foram trazidos à força da África"),
          t(
            "That's true, and Palmares doesn't challenge it: the quilombo was a response to that violence.",
            "Isso é verdade, e Palmares não o contraria: o quilombo foi uma resposta a essa violência.",
          ),
          t(
            "Picks a true fact the text doesn't challenge",
            "Escolhe um fato verdadeiro que o texto não contesta",
          ),
        ),
        bankOption(
          t(
            "Worked on the Northeast's sugar estates",
            "Trabalharam nos engenhos de açúcar do Nordeste",
          ),
          t(
            "That's also true; many who went to Palmares had fled those very estates.",
            "Isso também é verdade; muitos dos que foram para Palmares fugiram justamente dos engenhos.",
          ),
          t(
            "Picks a fact tied to Palmares's history instead of the view it challenges",
            "Escolhe um fato ligado à história de Palmares, e não a visão que ela contraria",
          ),
        ),
        bankOption(
          t(
            "Built their own ways of organizing society",
            "Construíram formas próprias de organização social",
          ),
          t(
            "Palmares confirms this idea; it doesn't challenge it.",
            "Palmares confirma essa ideia, não a contraria.",
          ),
          t("Reverses what the question asks", "Inverte o sentido da pergunta"),
        ),
        bankOption(
          t(
            "Have been honored by the Brazilian state",
            "Foram homenageados pelo Estado brasileiro",
          ),
          t(
            "The text confirms a tribute, the day on November 20. There's nothing to challenge there.",
            "O texto confirma uma homenagem, o 20 de novembro. Não há o que contrariar aí.",
          ),
          t("Reads as challenged what the text states", "Lê como contestado o que o texto afirma"),
        ),
      ],
      question: t(
        "Palmares's history challenges the view that enslaved Africans in Brazil:",
        "A história de Palmares contraria a visão de que os africanos escravizados no Brasil:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "palmares-resistance",
    skill: "indigenous-afro-brazilian",
  },
  {
    content: {
      context: t(
        "For the philosopher Montesquieu, in The Spirit of the Laws (1748), all would be lost if the same person or the same group made the laws, carried them out and judged disputes.",
        "Para o filósofo Montesquieu, em O espírito das leis (1748), tudo estaria perdido se a mesma pessoa ou o mesmo grupo fizesse as leis, as executasse e julgasse os conflitos.",
      ),
      options: [
        bankOption(
          t(
            "Separation of powers into legislative, executive and judicial branches that check one another",
            "Separação dos poderes em Legislativo, Executivo e Judiciário, que se limitam uns aos outros",
          ),
          t(
            "Splitting these functions keeps any one person or group from holding all power and abusing it.",
            "Dividir essas funções impede que uma só pessoa ou grupo concentre todo o poder e abuse dele.",
          ),
        ),
        bankOption(
          t(
            "Absolute sovereignty of the king, who holds every decision",
            "Soberania absoluta do rei, que concentra as decisões",
          ),
          t(
            "Montesquieu criticizes exactly that: all powers in the hands of one.",
            "Montesquieu critica justamente a concentração dos poderes nas mãos de um só.",
          ),
          t(
            "Confuses the Enlightenment with the absolutism it criticized",
            "Confunde o Iluminismo com o absolutismo que ele criticava",
          ),
        ),
        bankOption(
          t(
            "Direct democracy, in which the people vote on every law",
            "Democracia direta, em que o povo vota todas as leis",
          ),
          t(
            "The idea is to divide functions among powers, not to have the people decide everything directly.",
            "A ideia é dividir funções entre poderes, não fazer o povo decidir tudo diretamente.",
          ),
          t(
            "Confuses dividing powers with direct participation",
            "Confunde divisão de poderes com participação direta",
          ),
        ),
        bankOption(
          t(
            "Federalism, which divides the country into states",
            "Federalismo, que divide o país em estados",
          ),
          t(
            "Federalism splits power among levels of government. Montesquieu is talking about making, carrying out and judging the laws.",
            "O federalismo divide o poder entre níveis de governo. Montesquieu fala das funções de fazer, executar e julgar as leis.",
          ),
          t(
            "Confuses splitting power by function with splitting it by territory",
            "Confunde divisão funcional com divisão territorial do poder",
          ),
        ),
        bankOption(
          t("Compulsory voting for all citizens", "Voto obrigatório para todos os cidadãos"),
          t(
            "The text isn't about voting but about who holds each power.",
            "O texto não trata do voto, e sim de quem exerce cada poder.",
          ),
          t(
            "Ties the idea to a topic the text doesn't address",
            "Liga a ideia a um tema que o texto não aborda",
          ),
        ),
      ],
      question: t(
        "In today's democratic states, this idea underlies the principle of:",
        "Nos Estados democráticos atuais, essa ideia fundamenta o princípio de:",
      ),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "montesquieu-separation",
    skill: "political-ideas",
  },
  {
    content: {
      context: t(
        "Enacted in 1988, after 21 years of military dictatorship, Brazil's current Constitution became known as the Citizen Constitution. It guaranteed the vote, as an option, to people who can't read and to 16- and 17-year-olds, created the Unified Health System (SUS) and made health everyone's right and the state's duty.",
        "Promulgada em 1988, depois de 21 anos de ditadura militar, a atual Constituição brasileira ficou conhecida como Constituição Cidadã. Ela garantiu o voto, facultativo, aos analfabetos e aos jovens de 16 e 17 anos, criou o Sistema Único de Saúde (SUS) e definiu a saúde como direito de todos e dever do Estado.",
      ),
      options: [
        bankOption(
          t(
            "Broadened political and social rights after an authoritarian period",
            "Ampliou direitos políticos e sociais depois de um período autoritário",
          ),
          t(
            "The vote for more people and health as everyone's right: the Constitution broadened citizenship after the dictatorship.",
            "Voto para mais gente e saúde como direito de todos: a Constituição ampliou a cidadania após a ditadura.",
          ),
        ),
        bankOption(
          t(
            "Was written by the military to keep the regime going",
            "Foi escrita pelos militares para manter o regime",
          ),
          t(
            "It came after the dictatorship, written by an elected Constituent Assembly.",
            "Ela veio depois da ditadura, feita por uma Assembleia Constituinte eleita.",
          ),
          t(
            "Confuses the 1988 Constitution with those of the military regime",
            "Confunde a Constituição de 1988 com as do regime militar",
          ),
        ),
        bankOption(
          t(
            "Limited the vote to people who can read and write",
            "Restringiu o voto a quem sabe ler e escrever",
          ),
          t(
            "It did the opposite: it guaranteed the vote to people who can't read.",
            "Foi o contrário: ela garantiu o voto aos analfabetos.",
          ),
          t("Reverses something the text says", "Inverte uma informação do texto"),
        ),
        bankOption(
          t("Made health care a private service only", "Tornou a saúde um serviço apenas privado"),
          t(
            "It created the SUS and made health a duty of the state.",
            "Ela criou o SUS e fez da saúde um dever do Estado.",
          ),
          t(
            "Ignores the creation of the public health system",
            "Ignora a criação do sistema público de saúde",
          ),
        ),
        bankOption(
          t(
            "Was the first constitution in Brazil's history",
            "Foi a primeira Constituição da história do Brasil",
          ),
          t(
            "Brazil had others before it; the first dates from 1824.",
            "O Brasil teve outras antes dela; a primeira é de 1824.",
          ),
          t("Ignores the earlier constitutions", "Ignora as Constituições anteriores"),
        ),
      ],
      question: t(
        "The nickname Citizen Constitution is explained by the fact that the 1988 Constitution:",
        "O apelido Constituição Cidadã se explica porque a Constituição de 1988:",
      ),
    },
    difficulty: -1,
    exam: "enem",
    format: "multipleChoice",
    key: "constitution-1988-rights",
    skill: "democratic-institutions",
  },
  {
    content: {
      context: t(
        "In 1984, millions of Brazilians took to the streets at rallies across the country. At the largest, in São Paulo, more than a million people gathered in the Anhangabaú Valley. Even so, the Dante de Oliveira amendment was defeated in Congress.",
        "Em 1984, milhões de brasileiros foram às ruas em comícios por todo o país. No maior deles, em São Paulo, mais de um milhão de pessoas se reuniram no Vale do Anhangabaú. Mesmo assim, a emenda Dante de Oliveira foi derrotada no Congresso.",
      ),
      options: [
        bankOption(
          t(
            "Direct elections for president, while the military dictatorship still ruled",
            "Eleições diretas para presidente da República, ainda sob a ditadura militar",
          ),
          t(
            "The Dante de Oliveira amendment proposed a direct vote for president. Though it was defeated, the campaign hastened the regime's end.",
            "A emenda Dante de Oliveira propunha o voto direto para presidente. Mesmo derrotada, a campanha acelerou o fim do regime.",
          ),
        ),
        bankOption(
          t("The return of the monarchy", "A volta da monarquia"),
          t(
            "That was the question in the 1993 plebiscite; in 1984, the fight was for the direct vote.",
            "Esse foi o tema do plebiscito de 1993; em 1984, a luta era pelo voto direto.",
          ),
          t(
            "Confuses the movement with the 1993 plebiscite",
            "Confunde o movimento com o plebiscito de 1993",
          ),
        ),
        bankOption(
          t("Shutting down the National Congress", "O fechamento do Congresso Nacional"),
          t(
            "The movement wanted Congress to pass the amendment, not to close it.",
            "O movimento esperava que o Congresso aprovasse a emenda; não queria fechá-lo.",
          ),
          t(
            "Credits the movement with an authoritarian measure",
            "Atribui ao movimento uma medida típica do autoritarismo",
          ),
        ),
        bankOption(
          t("Votes for women, banned until then", "O voto feminino, até então proibido"),
          t(
            "Women won the right to vote in Brazil with the 1932 Electoral Code.",
            "As mulheres conquistaram o direito ao voto no Brasil com o Código Eleitoral de 1932.",
          ),
          t(
            "Confuses the demand with a right won in another era",
            "Confunde a pauta com uma conquista de outra época",
          ),
        ),
        bankOption(
          t(
            "Independence for the states of the Southeast",
            "A independência dos estados do Sudeste",
          ),
          t(
            "The rallies took place across the country for a national change, not a separatist one.",
            "Os comícios aconteceram em todo o país por uma mudança nacional, não separatista.",
          ),
          t("Reads separatism into a national movement", "Lê separatismo num movimento nacional"),
        ),
      ],
      question: t("The movement described demanded:", "O movimento descrito reivindicava:"),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "diretas-ja",
    skill: "social-movements",
  },
  {
    content: {
      context: t(
        "Between 1950 and 1980, the share of Brazil's population living in cities rose from about 36% to about 68%. Many families from the countryside settled on the outskirts of big cities, in irregular plots and favelas, far from jobs and with little access to sanitation and transport.",
        "Entre 1950 e 1980, a população urbana do Brasil passou de cerca de 36% para cerca de 68% do total. Muitas famílias vindas do campo foram morar nas periferias das grandes cidades, em loteamentos irregulares e favelas, longe do emprego e com pouco acesso a saneamento e transporte.",
      ),
      options: [
        bankOption(
          t(
            "Socio-spatial segregation, with the poorest living in areas with less infrastructure",
            "A segregação socioespacial, em que os mais pobres ocupam áreas com menos infraestrutura",
          ),
          t(
            "Cities grew faster than their services, and those who arrived with less income ended up on poorly served outskirts.",
            "As cidades cresceram mais rápido que os serviços, e quem chegou com menos renda ficou nas periferias mal atendidas.",
          ),
        ),
        bankOption(
          t(
            "Big cities emptying out in that period",
            "O esvaziamento das grandes cidades no período",
          ),
          t(
            "The cities grew a lot; it was the countryside that emptied.",
            "As cidades cresceram muito; o que se esvaziou foi o campo.",
          ),
          t("Reverses the direction of the rural exodus", "Inverte o sentido do êxodo rural"),
        ),
        bankOption(
          t(
            "Public services spread evenly across the city",
            "A distribuição igual dos serviços públicos pela cidade",
          ),
          t(
            "The text shows the opposite: outskirts with little sanitation and transport.",
            "O texto mostra o contrário: periferias com pouco saneamento e transporte.",
          ),
          t("Contradicts what the text describes", "Contradiz o que o texto descreve"),
        ),
        bankOption(
          t(
            "A land reform that kept families in the countryside",
            "Uma reforma agrária que fixou as famílias no campo",
          ),
          t(
            "The families left the countryside; the text says nothing about land reform.",
            "As famílias saíram do campo; o texto não fala de reforma agrária.",
          ),
          t(
            "Credits the period with a policy the text doesn't mention",
            "Atribui ao período uma política que o texto não menciona",
          ),
        ),
        bankOption(
          t(
            "Migrants preferring to live far from work",
            "A preferência dos migrantes por morar longe do trabalho",
          ),
          t(
            "Living far away came from the price of land, not from preference.",
            "Morar longe foi falta de opção, pelo preço da terra, não preferência.",
          ),
          t(
            "Takes an economic constraint for a personal choice",
            "Toma uma imposição econômica por escolha pessoal",
          ),
        ),
      ],
      question: t("The process described helps explain:", "O processo descrito ajuda a explicar:"),
    },
    difficulty: 0,
    exam: "enem",
    format: "multipleChoice",
    key: "urbanization-rural-exodus",
    skill: "urbanization",
  },
  {
    content: {
      context: t(
        "In December 1968, the military government issued Institutional Act No. 5 (AI-5). It let the president close Congress, strip politicians of their mandates and suspend political rights, and it suspended habeas corpus for political crimes. Prior censorship of the press and the arts grew stronger.",
        "Em dezembro de 1968, o governo militar baixou o Ato Institucional nº 5 (AI-5). Ele permitia ao presidente fechar o Congresso, cassar mandatos e suspender direitos políticos, e suspendia o habeas corpus nos casos de crimes políticos. A censura prévia à imprensa e às artes se intensificou.",
      ),
      options: [
        bankOption(
          t(
            "They concentrated power in the executive and removed the checks on it, such as the legislature, the courts and a free press",
            "Concentravam o poder no Executivo e eliminavam os controles sobre ele, como o Legislativo, a Justiça e a imprensa livre",
          ),
          t(
            "With no working Congress, no habeas corpus and censorship, no one could limit or scrutinize the government.",
            "Sem Congresso atuante, sem habeas corpus e com censura, ninguém podia limitar ou fiscalizar o governo.",
          ),
        ),
        bankOption(
          t(
            "They increased popular participation in government decisions",
            "Aumentavam a participação popular nas decisões do governo",
          ),
          t(
            "Stripping mandates and suspending political rights reduces participation.",
            "Cassar mandatos e suspender direitos políticos reduz a participação.",
          ),
          t("Reverses the measures' effect", "Inverte o efeito das medidas"),
        ),
        bankOption(
          t(
            "They strengthened the courts' independence",
            "Fortaleciam a independência do Judiciário",
          ),
          t(
            "Suspending habeas corpus takes away the courts' protection against arbitrary arrest.",
            "Suspender o habeas corpus tira do Judiciário um instrumento de proteção contra prisões arbitrárias.",
          ),
          t(
            "Ignores what suspending habeas corpus does",
            "Ignora o efeito da suspensão do habeas corpus",
          ),
        ),
        bankOption(
          t(
            "Most of the population approved them in a plebiscite",
            "Foram aprovadas em plebiscito pela maioria da população",
          ),
          t(
            "The government issued AI-5 with no popular vote.",
            "O AI-5 foi baixado pelo governo, sem consulta popular.",
          ),
          t(
            "Gives popular legitimacy to an imposed act",
            "Atribui legitimidade popular a um ato imposto",
          ),
        ),
        bankOption(
          t(
            "They guaranteed press freedom as a check on the government",
            "Garantiam a liberdade de imprensa como forma de controle do governo",
          ),
          t(
            "Prior censorship grew stronger: the press lost its freedom.",
            "A censura prévia se intensificou: a imprensa perdeu liberdade.",
          ),
          t(
            "Contradicts what the text says about censorship",
            "Contradiz a informação sobre a censura",
          ),
        ),
      ],
      question: t(
        "These measures mark an authoritarian regime because:",
        "Essas medidas caracterizam um regime autoritário porque:",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "ai5-measures",
    skill: "democracy-authoritarianism",
  },
  {
    content: {
      context: t(
        "In the 2015 Paris Agreement, countries committed to keeping global warming well below 2 °C above pre-industrial levels, while pursuing efforts to limit it to 1.5 °C. Each country sets its own emission-cutting targets, called nationally determined contributions, and must update them periodically, making them more ambitious.",
        "No Acordo de Paris, de 2015, os países se comprometeram a manter o aquecimento global bem abaixo de 2 °C em relação aos níveis pré-industriais, buscando limitá-lo a 1,5 °C. Cada país define as próprias metas de redução de emissões, as chamadas contribuições nacionalmente determinadas, e deve atualizá-las periodicamente, tornando-as mais ambiciosas.",
      ),
      options: [
        bankOption(
          t(
            "Each country sets its own targets and nothing penalizes a country that misses them, so the combined effort may fall short of the goal",
            "Cada país define as próprias metas e não há punição para quem não as cumpre, por isso o esforço somado pode ficar aquém do objetivo",
          ),
          t(
            "The contributions are set by each country and the agreement has no sanctions; added up, current targets still lead to more warming than the goal.",
            "As contribuições são definidas por cada país e o acordo não prevê sanções; somadas, as metas atuais ainda levam a um aquecimento acima do objetivo.",
          ),
        ),
        bankOption(
          t(
            "It imposes the same targets on every country, rich or poor",
            "Impõe as mesmas metas a todos os países, ricos ou pobres",
          ),
          t(
            "According to the text, each country sets its own targets.",
            "Pelo texto, cada país define as próprias metas.",
          ),
          t(
            "Confuses national targets with a single imposed target",
            "Confunde metas nacionais com uma meta única imposta",
          ),
        ),
        bankOption(
          t(
            "It immediately bans fossil fuels",
            "Proíbe imediatamente o uso de combustíveis fósseis",
          ),
          t(
            "The agreement bans no fuel; it asks for emission-cutting targets.",
            "O acordo não proíbe nenhum combustível; ele pede metas de redução.",
          ),
          t(
            "Credits the agreement with a ban it doesn't make",
            "Atribui ao acordo uma proibição que ele não faz",
          ),
        ),
        bankOption(
          t(
            "It has no temperature goal and deals only with deforestation",
            "Não tem meta de temperatura e trata só do desmatamento",
          ),
          t(
            "The temperature goal is at the agreement's core: well below 2 °C.",
            "A meta de temperatura é o centro do acordo: bem abaixo de 2 °C.",
          ),
          t("Ignores the agreement's central goal", "Ignora o objetivo central do acordo"),
        ),
        bankOption(
          t("Only European countries signed it", "Foi assinado apenas pelos países da Europa"),
          t(
            "Almost every country in the world joined, Brazil included.",
            "Quase todos os países do mundo aderiram, inclusive o Brasil.",
          ),
          t("Underestimates the agreement's reach", "Subestima o alcance do acordo"),
        ),
      ],
      question: t(
        "A common criticism of this kind of agreement is that:",
        "Uma crítica frequente a esse modelo de acordo é que:",
      ),
    },
    difficulty: 1,
    exam: "enem",
    format: "multipleChoice",
    key: "paris-agreement-ndc",
    skill: "climate-responses",
  },
];
