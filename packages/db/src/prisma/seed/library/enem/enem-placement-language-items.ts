import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

export const enemPlacementLanguageItems: SeedItem[] = [
  {
    content: {
      pairs: [
        {
          left: t("She grabbed an umbrella.", "Ela pegou o guarda-chuva."),
          right: t("Rain looks likely", "Deve chover"),
        },
        {
          left: t("The shelves were empty.", "As prateleiras estavam vazias."),
          right: t("The stock sold out", "Os produtos esgotaram"),
        },
        {
          left: t("He yawned all class.", "Ele bocejou a aula toda."),
          right: t("He slept little", "Ele dormiu pouco"),
        },
        {
          left: t("The street was wet at dawn.", "A rua amanheceu molhada."),
          right: t("It rained overnight", "Choveu de madrugada"),
        },
      ],
      question: t(
        "Match each sentence to what it lets you infer.",
        "Ligue cada frase ao que ela permite inferir.",
      ),
      reason: t(
        "Each inference rests on a clue in the sentence: an umbrella points to rain, empty shelves to sold-out stock, yawning to little sleep and a wet street at dawn to rain in the night.",
        "Cada inferência se apoia numa pista da frase: o guarda-chuva indica chuva, as prateleiras vazias indicam produtos esgotados, o bocejo indica pouco sono e a rua molhada de manhã indica chuva na madrugada.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-inference-clues",
    skill: "inference",
  },
  {
    content: {
      question: t(
        '"When Lia got home, the cake was gone and the dog had frosting on its nose. The dog had spent the day in the yard. The kitchen door, which she had locked that morning, was open." Put the events in the order they must have happened.',
        '"Quando Lia chegou em casa, o bolo tinha sumido e o cachorro estava com cobertura no focinho. O cachorro tinha passado o dia no quintal. A porta da cozinha, que ela tinha trancado de manhã, estava aberta." Coloque os acontecimentos na ordem em que devem ter ocorrido.',
      ),
      reason: t(
        "The text only says the door was locked in the morning and open later, so someone opened it before the dog could get in, eat the cake and be found by Lia.",
        "O texto só diz que a porta estava trancada de manhã e aberta depois, então alguém a abriu antes de o cachorro entrar, comer o bolo e ser encontrado por Lia.",
      ),
      steps: [
        t("Lia locks the kitchen door", "Lia tranca a porta da cozinha"),
        t("The kitchen door is opened", "A porta da cozinha é aberta"),
        t("The dog gets into the kitchen", "O cachorro entra na cozinha"),
        t("The dog eats the cake", "O cachorro come o bolo"),
        t("Lia gets home", "Lia chega em casa"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-inference-cake-events",
    skill: "inference",
  },
  {
    content: {
      context: t(
        "Notice to residents: from Monday, the Block B elevator will stop only on even floors. Residents of odd floors should take the stairs or use the Block A elevator, reached through the garage.",
        "Aviso aos moradores: a partir de segunda-feira, o elevador do Bloco B vai parar só nos andares pares. Moradores dos andares ímpares devem usar a escada ou o elevador do Bloco A, pela garagem.",
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "Blocks A and B are connected through the garage",
            "Os blocos A e B se ligam pela garagem",
          ),
          t(
            "If odd-floor residents of Block B can reach the Block A elevator through the garage, the garage joins the two blocks.",
            "Se os moradores dos andares ímpares do Bloco B chegam ao elevador do Bloco A pela garagem, a garagem liga os dois blocos.",
          ),
        ),
        bankOption(
          t(
            "A resident of the 3rd floor of Block B will need another way up",
            "Um morador do 3º andar do Bloco B vai precisar de outro caminho para subir",
          ),
          t(
            "The 3rd floor is odd, and the Block B elevator will stop only on even floors.",
            "O 3º andar é ímpar, e o elevador do Bloco B só vai parar nos pares.",
          ),
        ),
        bankOption(
          t(
            "The Block B elevator will skip some floors",
            "O elevador do Bloco B vai deixar de parar em alguns andares",
          ),
          t(
            "Stopping only on even floors means passing the odd ones without stopping.",
            "Parar só nos andares pares significa passar pelos ímpares sem parar.",
          ),
        ),
        bankOption(
          t("The Block A elevator is broken", "O elevador do Bloco A está quebrado"),
          t(
            "The notice sends residents to the Block A elevator, so it must be working.",
            "O aviso manda os moradores usarem o elevador do Bloco A, então ele deve estar funcionando.",
          ),
          t("Infers something the text contradicts", "Infere algo que o texto contradiz"),
        ),
        bankOption(
          t("The change will last only one week", "A mudança vai durar só uma semana"),
          t(
            "The notice says when it starts, not when it ends.",
            "O aviso diz quando começa, não quando termina.",
          ),
          t("Infers a detail with no clue in the text", "Infere um detalhe sem pista no texto"),
        ),
        bankOption(
          t(
            "Residents of even floors must take the stairs",
            "Moradores dos andares pares devem usar a escada",
          ),
          t(
            "The stairs are for odd floors; the elevator still stops on the even ones.",
            "A escada é para os andares ímpares; o elevador continua parando nos pares.",
          ),
          t("Swaps even and odd floors", "Troca os andares pares pelos ímpares"),
        ),
      ],
      question: t(
        "Which of these can be inferred from the notice? Select all that apply.",
        "Quais afirmações se podem inferir do aviso? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-inference-elevator-notice",
    skill: "inference",
  },
  {
    content: {
      pairs: [
        {
          left: t("A brand's Instagram post", "Post de marca no Instagram"),
          right: t("Wants to sell something", "Quer vender algo"),
        },
        {
          left: t("A health ministry site", "Site do Ministério da Saúde"),
          right: t("Official guidance", "Orientação oficial"),
        },
        {
          left: t("A school textbook", "Livro didático"),
          right: t("Reviewed teaching content", "Conteúdo revisado para ensino"),
        },
        {
          left: t("A newspaper op-ed", "Coluna de opinião"),
          right: t("One author's view", "Ponto de vista do autor"),
        },
      ],
      question: t(
        "Match each place a text appears with what that tells you about it.",
        "Ligue cada lugar onde um texto circula ao que isso diz sobre ele.",
      ),
      reason: t(
        "Where a text circulates shows who speaks and why: a brand promotes itself, a ministry gives official guidance, a textbook is reviewed to teach and an opinion column signs one person's view.",
        "O lugar onde um texto circula mostra quem fala e por quê: a marca se promove, o ministério dá orientação oficial, o livro didático é revisado para ensinar e a coluna assina a opinião de uma pessoa.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-texts-in-context-places",
    skill: "texts-in-context",
  },
  {
    content: {
      question: t(
        "Put in order how a news story reaches the reader of a printed newspaper.",
        "Coloque em ordem como uma notícia chega ao leitor do jornal impresso.",
      ),
      reason: t(
        "A story is produced before it circulates: the fact happens, the reporter checks it, an editor revises it and places it on a page, and only then is the paper printed and read.",
        "Uma notícia é produzida antes de circular: o fato acontece, o repórter apura, o editor revisa e escolhe a página, e só então o jornal é impresso e lido.",
      ),
      steps: [
        t("Something happens in the city", "Algo acontece na cidade"),
        t("A reporter checks the facts with sources", "Um repórter apura os fatos com as fontes"),
        t("An editor revises it and picks its page", "Um editor revisa e escolhe a página"),
        t("The newspaper is printed", "O jornal é impresso"),
        t("A reader reads the story", "Um leitor lê a notícia"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-texts-in-context-news-path",
    skill: "texts-in-context",
  },
  {
    content: {
      context: t(
        'The sentence "The new bridge will cut travel time in half" appears in a paid ad from city hall, which built the bridge.',
        'A frase "A nova ponte vai reduzir o tempo de viagem pela metade" aparece num anúncio pago pela prefeitura, que construiu a ponte.',
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "City hall has an interest in praising the bridge",
            "A prefeitura tem interesse em elogiar a ponte",
          ),
          t(
            "Whoever built the bridge and paid for the ad benefits from good news about it.",
            "Quem construiu a ponte e pagou o anúncio se beneficia de boas notícias sobre ela.",
          ),
        ),
        bankOption(
          t(
            "The claim is worth checking in other sources",
            "Vale conferir a afirmação em outras fontes",
          ),
          t(
            "An interested source isn't proof; independent sources can confirm the number.",
            "Uma fonte interessada não é prova; fontes independentes podem confirmar o número.",
          ),
        ),
        bankOption(
          t(
            "Who paid for the text changes how it should be read",
            "Quem pagou pelo texto muda como ele deve ser lido",
          ),
          t(
            "The context of production is part of the meaning: an ad is written to convince.",
            "O contexto de produção faz parte do sentido: um anúncio é feito para convencer.",
          ),
        ),
        bankOption(
          t("Being in an ad makes the claim false", "Estar num anúncio torna a afirmação falsa"),
          t(
            "An ad calls for caution, but the claim can still be true.",
            "Um anúncio pede cautela, mas a afirmação ainda pode ser verdadeira.",
          ),
          t("Treats an interested source as a lie", "Trata uma fonte interessada como mentira"),
        ),
        bankOption(
          t(
            "The ad is the most neutral source on the bridge",
            "O anúncio é a fonte mais neutra sobre a ponte",
          ),
          t(
            "The party that built the bridge is the least neutral one to judge it.",
            "Quem construiu a ponte é a parte menos neutra para avaliá-la.",
          ),
          t("Ignores who is speaking", "Ignora quem está falando"),
        ),
        bankOption(
          t(
            "Where a text circulates doesn't change how it reads",
            "O lugar onde o texto circula não muda sua leitura",
          ),
          t(
            "The same sentence reads differently in a paid ad and in an independent report.",
            "A mesma frase se lê de outro jeito num anúncio pago e numa reportagem independente.",
          ),
          t("Ignores the context of circulation", "Ignora o contexto de circulação"),
        ),
      ],
      question: t(
        "Which statements about reading this sentence in the ad are right? Select all that apply.",
        "Quais afirmações sobre ler essa frase no anúncio estão corretas? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-texts-in-context-bridge-ad",
    skill: "texts-in-context",
  },
  {
    content: {
      pairs: [
        {
          left: t('"Invaded," of protesters', '"Invadiram", de manifestantes'),
          right: t("Casts them as aggressors", "Mostra-os como agressores"),
        },
        {
          left: t('"Occupied," of protesters', '"Ocuparam", de manifestantes'),
          right: t("Sounds more neutral", "Soa mais neutro"),
        },
        {
          left: t('"Chubby" instead of "fat"', '"Gordinho" em vez de "gordo"'),
          right: t("Softens the description", "Suaviza a descrição"),
        },
        {
          left: t('"Mansion" for a house', '"Mansão" para uma casa'),
          right: t("Stresses wealth", "Destaca a riqueza"),
        },
      ],
      question: t(
        "Match each word choice to the effect it has on the text.",
        "Ligue cada escolha de palavra ao efeito que ela tem no texto.",
      ),
      reason: t(
        'Words with close meanings carry different judgments: "invaded" accuses, "occupied" describes, "chubby" softens and "mansion" points to wealth.',
        'Palavras de sentido próximo carregam julgamentos diferentes: "invadiram" acusa, "ocuparam" descreve, o diminutivo suaviza e "mansão" aponta riqueza.',
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-word-choice-effects-pairs",
    skill: "word-choice-effects",
  },
  {
    content: {
      question: t(
        "A journalist can say a minister ___ the plan. Order these verbs from the mildest to the harshest.",
        "Um jornalista pode dizer que o ministro ___ o plano. Ordene estes verbos do mais leve ao mais duro.",
      ),
      reason: t(
        "Each verb raises the tone: a remark only mentions, criticizing judges, attacking goes after it and tearing it apart wipes it out.",
        "Cada verbo sobe o tom: comentar só menciona, criticar julga, atacar parte para cima e demolir destrói.",
      ),
      steps: [
        t("remarked on", "comentou"),
        t("criticized", "criticou"),
        t("attacked", "atacou"),
        t("tore apart", "demoliu"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-word-choice-effects-verb-scale",
    skill: "word-choice-effects",
  },
  {
    content: {
      context: t(
        'Headline 1: "Prices soar again at the market." Headline 2: "Prices rise 2% at the market."',
        'Manchete 1: "Preços disparam de novo na feira." Manchete 2: "Preços sobem 2% na feira."',
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t("Makes the rise feel bigger", "Faz a alta parecer maior"),
          t(
            '"Soar" suggests a fast, steep climb, while headline 2 gives a modest 2%.',
            '"Disparar" sugere uma subida rápida e forte, enquanto a manchete 2 informa só 2%.',
          ),
        ),
        bankOption(
          t("Conveys alarm about the rise", "Transmite alarme sobre a alta"),
          t(
            "The verb carries urgency, as if something were out of control.",
            "O verbo carrega urgência, como se algo estivesse fora de controle.",
          ),
        ),
        bankOption(
          t("Grabs the reader's attention", "Chama a atenção do leitor"),
          t(
            "A strong verb in a headline is a way to make people stop and read.",
            "Um verbo forte na manchete é um jeito de fazer o leitor parar e ler.",
          ),
        ),
        bankOption(
          t("Gives the exact size of the rise", "Informa o tamanho exato da alta"),
          t(
            "Only headline 2 gives a number; the verb in headline 1 gives an impression.",
            "Só a manchete 2 dá um número; o verbo da manchete 1 dá uma impressão.",
          ),
          t("Takes an evaluative word for data", "Confunde palavra avaliativa com dado"),
        ),
        bankOption(
          t("Makes the headline more neutral", "Deixa a manchete mais neutra"),
          t(
            '"Rise" is the neutral verb; "soar" adds a judgment.',
            '"Subir" é o verbo neutro; "disparar" acrescenta um julgamento.',
          ),
          t("Reads a charged word as neutral", "Lê uma palavra carregada como neutra"),
        ),
        bankOption(
          t("Says that prices went down", "Diz que os preços caíram"),
          t("Both headlines say prices went up.", "As duas manchetes dizem que os preços subiram."),
          t("Misreads the verb", "Entende o verbo ao contrário"),
        ),
      ],
      question: t(
        'What does the verb "soar" do in headline 1? Select all that apply.',
        'O que o verbo "disparam" faz na manchete 1? Marque todas as que se aplicam.',
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-word-choice-effects-headlines",
    skill: "word-choice-effects",
  },
  {
    content: {
      pairs: [
        {
          left: t("Capoeira", "Capoeira"),
          right: t("Enslaved Africans", "Africanos escravizados"),
        },
        {
          left: t("Cassava flour", "Farinha de mandioca"),
          right: t("Indigenous peoples", "Povos indígenas"),
        },
        {
          left: t("Festa junina", "Festa junina"),
          right: t("Portuguese Catholic feasts", "Festas católicas portuguesas"),
        },
        {
          left: t("Tanabata in São Paulo", "Tanabata em São Paulo"),
          right: t("Japanese immigration", "Imigração japonesa"),
        },
      ],
      question: t(
        "Match each Brazilian practice to the group whose history shaped it.",
        "Ligue cada prática brasileira ao grupo cuja história a formou.",
      ),
      reason: t(
        "Capoeira grew among enslaved Africans, cassava flour comes from Indigenous peoples, festa junina from Portuguese feasts for Catholic saints and São Paulo's Tanabata from Japanese immigrants.",
        "A capoeira surgiu entre africanos escravizados, a farinha de mandioca vem dos povos indígenas, a festa junina das festas portuguesas de santos católicos e o Tanabata de São Paulo dos imigrantes japoneses.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-cultural-identities-origins",
    skill: "cultural-identities",
  },
  {
    content: {
      question: t(
        "Put these moments that shaped Brazil's peoples in the order they happened.",
        "Coloque estes momentos que formaram os povos do Brasil na ordem em que aconteceram.",
      ),
      reason: t(
        "Indigenous peoples lived here before the Portuguese arrived in 1500; enslaved Africans were brought from the 1500s on; slavery was abolished in 1888 and the first Japanese immigrants arrived in 1908.",
        "Os povos indígenas já viviam aqui antes da chegada dos portugueses em 1500; africanos escravizados foram trazidos a partir do século 16; a escravidão foi abolida em 1888 e os primeiros imigrantes japoneses chegaram em 1908.",
      ),
      steps: [
        t("Indigenous peoples live here", "Povos indígenas vivem aqui"),
        t("The Portuguese arrive", "Os portugueses chegam"),
        t("Enslaved Africans are brought by force", "Africanos escravizados são trazidos à força"),
        t("Slavery is abolished", "A escravidão é abolida"),
        t("The first Japanese immigrants arrive", "Chegam os primeiros imigrantes japoneses"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-cultural-identities-timeline",
    skill: "cultural-identities",
  },
  {
    content: {
      context: t(
        "For centuries, while their religions were persecuted, followers of candomblé linked African orixás to Catholic saints, and that is how many rituals survived.",
        "Durante séculos, enquanto suas religiões eram perseguidas, adeptos do candomblé associaram orixás africanos a santos católicos, e assim muitos rituais sobreviveram.",
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "Persecution shaped how the practice survived",
            "A perseguição influenciou como a prática sobreviveu",
          ),
          t(
            "Linking orixás to saints was a way to keep the rituals while they were banned.",
            "Associar orixás a santos foi um jeito de manter os rituais enquanto eram proibidos.",
          ),
        ),
        bankOption(
          t("Different traditions mixed into something new", "Tradições diferentes se misturaram"),
          t(
            "African and Catholic elements came together, a process called syncretism.",
            "Elementos africanos e católicos se juntaram, num processo chamado sincretismo.",
          ),
        ),
        bankOption(
          t(
            "The identity formed under unequal power",
            "A identidade se formou sob relações desiguais de poder",
          ),
          t(
            "One side persecuted and the other adapted to survive.",
            "Um lado perseguia e o outro se adaptava para sobreviver.",
          ),
        ),
        bankOption(
          t(
            "Cultural identities stay fixed over time",
            "Identidades culturais não mudam com o tempo",
          ),
          t(
            "The text shows a practice changing under historical pressure.",
            "O texto mostra uma prática mudando sob pressão histórica.",
          ),
          t("Treats identity as fixed", "Trata a identidade como fixa"),
        ),
        bankOption(
          t(
            "The African religions disappeared when they mixed",
            "As religiões africanas desapareceram ao se misturar",
          ),
          t(
            "The text says the rituals survived, not that they disappeared.",
            "O texto diz que os rituais sobreviveram, não que desapareceram.",
          ),
          t("Takes mixing for erasure", "Confunde mistura com apagamento"),
        ),
      ],
      question: t(
        "Which statements fit the process the text describes? Select all that apply.",
        "Quais afirmações combinam com o processo descrito no texto? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-cultural-identities-candomble",
    skill: "cultural-identities",
  },
  {
    content: {
      pairs: [
        {
          left: t("Colonial sugar mill", "Engenho colonial"),
          right: t("Enslaved labor", "Trabalho escravizado"),
        },
        { left: t("Medieval manor", "Feudo medieval"), right: t("Serfdom", "Servidão") },
        {
          left: t("Ford's assembly line", "Linha de montagem de Ford"),
          right: t("Wages for one repeated task", "Salário por tarefa repetida"),
        },
        {
          left: t("Family farm", "Agricultura familiar"),
          right: t("The household works the land", "A família trabalha a terra"),
        },
      ],
      question: t(
        "Match each way of producing to the labor relation it relied on.",
        "Ligue cada forma de produzir à relação de trabalho em que se apoiava.",
      ),
      reason: t(
        "Sugar mills used enslaved people, manors bound serfs to the lord's land, Ford paid wages for one repeated task on the line and a family farm is worked mostly by the family itself.",
        "Os engenhos usavam pessoas escravizadas, os feudos prendiam os servos à terra do senhor, Ford pagava salário por uma tarefa repetida na linha e a agricultura familiar é feita principalmente pela própria família.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-production-and-labor-relations",
    skill: "production-and-labor",
  },
  {
    content: {
      question: t(
        "Put these ways of organizing work in the order they began.",
        "Coloque estas formas de organizar o trabalho na ordem em que surgiram.",
      ),
      reason: t(
        "Serfdom spread in medieval Europe; colonial plantations began in the 1500s; factories of the Industrial Revolution in the late 1700s; Ford's assembly line in 1913; and Toyota's flexible production spread from the 1970s.",
        "A servidão se espalhou na Europa medieval; as plantations coloniais começaram no século 16; as fábricas da Revolução Industrial no fim do século 18; a linha de montagem de Ford em 1913; e a produção flexível da Toyota se espalhou a partir dos anos 1970.",
      ),
      steps: [
        t("Serfdom on medieval manors", "Servidão nos feudos medievais"),
        t(
          "Colonial plantations with enslaved labor",
          "Plantations coloniais com trabalho escravizado",
        ),
        t("Industrial Revolution factories", "Fábricas da Revolução Industrial"),
        t("Ford's assembly line", "Linha de montagem de Ford"),
        t("Toyota's flexible production", "Produção flexível da Toyota"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-production-and-labor-timeline",
    skill: "production-and-labor",
  },
  {
    content: {
      context: t(
        "In Brazil's Center-West, large farms grow soybeans for export with heavy machinery and few workers per hectare.",
        "No Centro-Oeste brasileiro, grandes fazendas plantam soja para exportação com máquinas pesadas e poucos trabalhadores por hectare.",
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t("Large landholdings", "Grandes propriedades de terra"),
          t("The text describes large farms.", "O texto fala de grandes fazendas."),
        ),
        bankOption(
          t("Mechanized production", "Produção mecanizada"),
          t(
            "Heavy machinery does work that would need many people.",
            "Máquinas pesadas fazem o trabalho que exigiria muita gente.",
          ),
        ),
        bankOption(
          t("Output aimed at the foreign market", "Produção voltada ao mercado externo"),
          t("The soybeans are grown for export.", "A soja é plantada para exportação."),
        ),
        bankOption(
          t("A lot of manual labor per hectare", "Muito trabalho manual por hectare"),
          t(
            "The text says there are few workers per hectare.",
            "O texto diz que há poucos trabalhadores por hectare.",
          ),
          t(
            "Thinks large farms always need many workers",
            "Acha que fazenda grande sempre exige muitos trabalhadores",
          ),
        ),
        bankOption(
          t("Small family plots", "Pequenos lotes familiares"),
          t(
            "That describes family farming, not these large farms.",
            "Isso descreve a agricultura familiar, não essas grandes fazendas.",
          ),
          t(
            "Confuses agribusiness with family farming",
            "Confunde agronegócio com agricultura familiar",
          ),
        ),
        bankOption(
          t(
            "Food mainly for the farmer's family",
            "Alimento principalmente para a família do produtor",
          ),
          t(
            "The harvest is sold abroad, not kept for the family.",
            "A colheita é vendida para fora, não fica com a família.",
          ),
          t(
            "Mistakes commercial farming for subsistence",
            "Confunde agricultura comercial com subsistência",
          ),
        ),
      ],
      question: t(
        "Which features of this way of producing does the text show? Select all that apply.",
        "Quais características dessa forma de produzir o texto mostra? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-production-and-labor-agribusiness",
    skill: "production-and-labor",
  },
  {
    content: {
      pairs: [
        { left: t('"Keep off the grass"', '"Keep off the grass"'), right: t("A sign", "Placa") },
        {
          left: t('"Mix 2 cups of flour"', '"Mix 2 cups of flour"'),
          right: t("A recipe", "Receita"),
        },
        {
          left: t('"Dear Ana, thanks for…"', '"Dear Ana, thanks for…"'),
          right: t("A letter", "Carta"),
        },
        { left: t('"Sale! 50% off today"', '"Sale! 50% off today"'), right: t("An ad", "Anúncio") },
      ],
      question: t(
        "Match each piece of an English text to the genre it comes from.",
        "Ligue cada trecho em inglês ao gênero de onde ele vem.",
      ),
      reason: t(
        "The words give the genre away: an order to the public is a sign, measured ingredients are a recipe, a greeting to someone is a letter and a discount is an ad.",
        "As palavras revelam o gênero: uma ordem ao público é placa, ingredientes medidos são receita, um cumprimento a alguém é carta e um desconto é anúncio.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-english-reading-genres",
    skill: "english-reading",
  },
  {
    content: {
      question: t(
        "Put the parts of this English email in the order they appear.",
        "Coloque as partes deste e-mail em inglês na ordem em que aparecem.",
      ),
      reason: t(
        "An email starts with its subject, greets the reader, gives the message, closes and ends with the sender's name.",
        "Um e-mail começa pelo assunto, cumprimenta o leitor, dá a mensagem, se despede e termina com o nome de quem escreve.",
      ),
      steps: [
        t("Subject: Meeting moved", "Subject: Meeting moved"),
        t("Hi team,", "Hi team,"),
        t("The meeting is now on Friday at 3 p.m.", "The meeting is now on Friday at 3 p.m."),
        t("See you then,", "See you then,"),
        t("Paula", "Paula"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-english-reading-email-parts",
    skill: "english-reading",
  },
  {
    content: {
      context: t(
        "Volunteers wanted! The city library needs help on Saturdays to read stories to children aged 4 to 8. No experience needed. Sign up at the front desk by May 10.",
        "Volunteers wanted! The city library needs help on Saturdays to read stories to children aged 4 to 8. No experience needed. Sign up at the front desk by May 10.",
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t("The library is looking for volunteers", "A biblioteca procura voluntários"),
          t('"Volunteers wanted" opens the text.', '"Volunteers wanted" abre o texto.'),
        ),
        bankOption(
          t("The help is needed on Saturdays", "A ajuda é necessária aos sábados"),
          t('The text says "on Saturdays."', 'O texto diz "on Saturdays".'),
        ),
        bankOption(
          t("There's a deadline to sign up", "Há um prazo para se inscrever"),
          t('Sign-ups close "by May 10."', 'As inscrições vão "by May 10", até 10 de maio.'),
        ),
        bankOption(
          t("Volunteers must have experience", "Os voluntários precisam ter experiência"),
          t(
            '"No experience needed" says the opposite.',
            '"No experience needed" diz o contrário: não precisa de experiência.',
          ),
          t('Misreads "no experience needed"', 'Entendeu errado "no experience needed"'),
        ),
        bankOption(
          t("The stories are for teenagers", "As histórias são para adolescentes"),
          t("The children are 4 to 8 years old.", "As crianças têm de 4 a 8 anos."),
          t("Missed the age in the text", "Não viu a idade no texto"),
        ),
        bankOption(
          t("Volunteers will be paid", "Os voluntários vão receber pagamento"),
          t(
            "The text never mentions pay, and volunteers usually work for free.",
            "O texto não fala em pagamento, e voluntários costumam trabalhar de graça.",
          ),
          t("Added information that isn't there", "Acrescentou uma informação que não está lá"),
        ),
      ],
      question: t(
        "Which statements are true according to the text? Select all that apply.",
        "Quais afirmações são verdadeiras de acordo com o texto? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-english-reading-library-ad",
    skill: "english-reading",
  },
  {
    content: {
      pairs: [
        { left: t("Day 1 length", "Duração do 1º dia"), right: t("5 h 30 min", "5h30") },
        { left: t("Day 2 length", "Duração do 2º dia"), right: t("5 h", "5h") },
        { left: t("Questions each day", "Questões por dia"), right: t("90", "90") },
        { left: t("Most lines in the essay", "Máximo de linhas da redação"), right: t("30", "30") },
      ],
      question: t(
        "Match each part of the ENEM to its number.",
        "Ligue cada parte do ENEM ao seu número.",
      ),
      reason: t(
        "Day 1 has 90 questions and the essay in 5 h 30 min; day 2 has 90 questions in 5 h; the essay fits in at most 30 lines.",
        "O 1º dia tem 90 questões e a redação em 5h30; o 2º dia tem 90 questões em 5h; a redação cabe em no máximo 30 linhas.",
      ),
    },
    difficulty: -1,
    format: "matchPairs",
    key: "placement-exam-time-numbers",
    skill: "exam-time",
  },
  {
    content: {
      question: t(
        "Put these moments of the ENEM's first day in the order they happen.",
        "Coloque estes momentos do primeiro dia do ENEM na ordem em que acontecem.",
      ),
      reason: t(
        "The gates close at 1 p.m. and the exam starts at 1:30 p.m. (Brasília time); you may leave after two hours, take the question booklet only in the last 30 minutes, and the day ends at 7 p.m.",
        "Os portões fecham às 13h e a prova começa às 13h30 (horário de Brasília); dá para sair após duas horas, levar o caderno de questões só nos últimos 30 minutos, e o dia termina às 19h.",
      ),
      steps: [
        t("The gates close", "Os portões fecham"),
        t("The exam starts", "A prova começa"),
        t("You may leave without the booklet", "Pode sair sem o caderno de questões"),
        t("You may take the booklet home", "Pode levar o caderno de questões"),
        t("Time is up", "O tempo de prova acaba"),
      ],
    },
    difficulty: 0,
    format: "order",
    key: "placement-exam-time-day-one",
    skill: "exam-time",
  },
  {
    content: {
      context: t(
        "On day 2, Júlia has 5 hours for 90 questions. She plans 3 minutes per question and keeps the rest of the time to review.",
        "No 2º dia, Júlia tem 5 horas para 90 questões. Ela planeja 3 minutos por questão e guarda o resto do tempo para revisar.",
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t(
            "She'd get through every question in 4 h 30 min",
            "Ela passaria por todas as questões em 4h30",
          ),
          t("90 × 3 min = 270 min, which is 4 h 30 min.", "90 × 3 min = 270 min, ou seja, 4h30."),
        ),
        bankOption(
          t(
            "She'd have 30 minutes to review and fill in the answer sheet",
            "Sobrariam 30 minutos para revisar e passar para o cartão-resposta",
          ),
          t("5 h minus 4 h 30 min leaves 30 minutes.", "5h menos 4h30 deixa 30 minutos."),
        ),
        bankOption(
          t(
            "Skipping a hard question and coming back keeps her on plan",
            "Pular uma questão difícil e voltar depois mantém o plano",
          ),
          t(
            "Stuck on one question, she'd eat into the time of the others.",
            "Travada numa questão, ela gastaria o tempo das outras.",
          ),
        ),
        bankOption(
          t("She'd run out of time before the end", "O tempo acabaria antes do fim"),
          t(
            "At 3 minutes each, 90 questions take 4 h 30 min, less than 5 h.",
            "A 3 minutos cada, 90 questões levam 4h30, menos que 5h.",
          ),
          t("Got the multiplication wrong", "Errou a multiplicação"),
        ),
        bankOption(
          t(
            "3 minutes per question uses the whole 5 hours",
            "3 minutos por questão usam as 5 horas inteiras",
          ),
          t("It uses 4 h 30 min and leaves 30 minutes.", "Usa 4h30 e deixa 30 minutos."),
          t("Didn't work out the total", "Não calculou o total"),
        ),
        bankOption(
          t(
            "Filling in the answer sheet takes no time",
            "Passar as respostas para o cartão não leva tempo",
          ),
          t(
            "Marking 90 answers takes minutes, which is why time is kept for it.",
            "Marcar 90 respostas leva alguns minutos, por isso se guarda tempo para isso.",
          ),
          t("Forgets the answer sheet in the plan", "Esquece o cartão-resposta no planejamento"),
        ),
      ],
      question: t(
        "Which statements about Júlia's plan are right? Select all that apply.",
        "Quais afirmações sobre o plano de Júlia estão corretas? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-exam-time-julia-plan",
    skill: "exam-time",
  },
  {
    content: {
      pairs: [
        {
          left: t('"According to the text"', '"De acordo com o texto"'),
          right: t("What is written", "O que está escrito"),
        },
        {
          left: t('"It can be inferred"', '"Infere-se que"'),
          right: t("What the text implies", "O que o texto sugere"),
        },
        {
          left: t('"EXCEPT"', '"EXCETO"'),
          right: t("The one that doesn't fit", "A única que não vale"),
        },
        {
          left: t('"The text\'s purpose"', '"A finalidade do texto"'),
          right: t("Why it was written", "Para que foi escrito"),
        },
      ],
      question: t(
        "Match each command in an ENEM question to what it asks you to find.",
        "Ligue cada comando de questão do ENEM ao que ele pede para encontrar.",
      ),
      reason: t(
        'The command sets the task: "according to the text" asks for what is written, "it can be inferred" for what it implies, "except" for the odd one out and "purpose" for why the text exists.',
        'O comando define a tarefa: "de acordo com o texto" pede o que está escrito, "infere-se" o que ele sugere, "exceto" a que destoa e "finalidade" para que o texto existe.',
      ),
    },
    difficulty: 0,
    format: "matchPairs",
    key: "placement-choosing-answers-commands",
    skill: "choosing-answers",
  },
  {
    content: {
      question: t(
        "Put these steps for answering an ENEM question in order.",
        "Coloque estes passos para responder a uma questão do ENEM em ordem.",
      ),
      reason: t(
        "The command says what to look for, the text gives the evidence, and only then do you rule out options, compare what's left and mark one.",
        "O comando diz o que procurar, o texto dá a evidência, e só então você descarta alternativas, compara as que sobram e marca uma.",
      ),
      steps: [
        t("Read the command at the end", "Ler o comando no fim do enunciado"),
        t("Find the evidence in the text", "Achar a evidência no texto"),
        t("Rule out options the text contradicts", "Descartar as que o texto contradiz"),
        t("Compare the ones that are left", "Comparar as que sobraram"),
        t("Mark the answer", "Marcar a resposta"),
      ],
    },
    difficulty: -1,
    format: "order",
    key: "placement-choosing-answers-steps",
    skill: "choosing-answers",
  },
  {
    content: {
      context: t(
        'Text: "Since 2010, the city has planted 50,000 trees, and summer temperatures downtown have dropped by 1 °C." Question: "According to the text, the city…"',
        'Texto: "Desde 2010, a cidade plantou 50 mil árvores, e a temperatura no verão caiu 1 °C no centro." Comando: "De acordo com o texto, a cidade…"',
      ),
      fixedOrder: false,
      options: [
        bankOption(
          t("…banned cars downtown", "…proibiu carros no centro"),
          t(
            "The text never mentions cars, so this goes.",
            "O texto não fala de carros, então ela sai.",
          ),
        ),
        bankOption(
          t("…will plant 50,000 more trees", "…vai plantar mais 50 mil árvores"),
          t(
            "The text talks about trees already planted, not future ones.",
            "O texto fala das árvores já plantadas, não de novas.",
          ),
        ),
        bankOption(
          t("…got hotter in the summer", "…ficou mais quente no verão"),
          t(
            "The text says temperatures dropped, so this contradicts it.",
            "O texto diz que a temperatura caiu, então esta o contradiz.",
          ),
        ),
        bankOption(
          t("…has had cooler summers downtown", "…tem verões mais amenos no centro"),
          t(
            "The 1 °C drop supports this option, so it stays.",
            "A queda de 1 °C sustenta esta alternativa, então ela fica.",
          ),
          t(
            "Ruled out an option the text supports",
            "Descartou uma alternativa que o texto sustenta",
          ),
        ),
        bankOption(
          t("…has planted trees since 2010", "…planta árvores desde 2010"),
          t(
            "The text says exactly this, so it stays.",
            "O texto diz exatamente isso, então ela fica.",
          ),
          t("Ruled out what the text states", "Descartou o que o texto afirma"),
        ),
      ],
      question: t(
        "Which options can you rule out using the text's evidence? Select all that apply.",
        "Quais alternativas você pode descartar pelas evidências do texto? Marque todas as que se aplicam.",
      ),
      select: "all",
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "placement-choosing-answers-rule-out",
    skill: "choosing-answers",
  },
  {
    content: {
      context: t(
        "The festival, held every July, drew a record 40,000 visitors this year, most of them from other states.",
        "O festival, realizado todo mês de julho, recebeu um recorde de 40 mil visitantes neste ano, a maioria de outros estados.",
      ),
      options: [
        bankOption(
          t(
            "drew more visitors this year than ever before",
            "recebeu neste ano mais visitantes do que nunca",
          ),
          t(
            'A "record" means more than any earlier year.',
            'Um "recorde" significa mais do que em qualquer ano anterior.',
          ),
        ),
        bankOption(
          t("takes place twice a year", "acontece duas vezes por ano"),
          t(
            "The text says it's held every July, once a year.",
            "O texto diz que é todo julho, uma vez por ano.",
          ),
          t("Contradicts the text", "Contradiz o texto"),
        ),
        bankOption(
          t("is the biggest festival in Brazil", "é o maior festival do Brasil"),
          t(
            "A record for this festival says nothing about the others in Brazil.",
            "Um recorde desse festival não diz nada sobre os outros do Brasil.",
          ),
          t("Generalizes beyond the text", "Generaliza além do texto"),
        ),
        bankOption(
          t("had mostly local visitors", "teve público principalmente local"),
          t("Most visitors came from other states.", "A maioria veio de outros estados."),
          t("Reads the opposite of the text", "Lê o contrário do texto"),
        ),
      ],
      question: t(
        "Which option does the text support? The festival…",
        "Qual alternativa o texto sustenta? O festival…",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-choosing-answers-festival",
    skill: "choosing-answers",
  },
  {
    content: {
      context: t(
        '"Due to maintenance, the pool will be closed from Monday to Wednesday. Members may use the gym as usual."',
        '"Due to maintenance, the pool will be closed from Monday to Wednesday. Members may use the gym as usual."',
      ),
      options: [
        bankOption(
          t(
            "The pool closes for three days, but the gym stays open.",
            "A piscina fecha por três dias, mas a academia continua aberta.",
          ),
          t(
            '"Closed from Monday to Wednesday" is the pool; "as usual" keeps the gym open.',
            '"Closed from Monday to Wednesday" se refere à piscina; "as usual" mantém a academia aberta.',
          ),
        ),
        bankOption(
          t("The whole club closes on Monday.", "O clube inteiro fecha na segunda-feira."),
          t(
            "Only the pool closes; the gym is open as usual.",
            "Só a piscina fecha; a academia funciona normalmente.",
          ),
          t("Read the pool's closing as the club's", "Leu o fechamento da piscina como o do clube"),
        ),
        bankOption(
          t("Members must pay to use the gym.", "Os sócios precisam pagar para usar a academia."),
          t(
            '"May use" means they can use it; nothing says they pay.',
            '"May use" quer dizer que eles podem usar; nada fala em pagar.',
          ),
          t('Misread "may" as an obligation', 'Leu "may" como obrigação'),
        ),
        bankOption(
          t("The gym closes for maintenance.", "A academia fecha para manutenção."),
          t(
            "The maintenance is in the pool; the gym stays open.",
            "A manutenção é na piscina; a academia continua aberta.",
          ),
          t("Mixed up the pool and the gym", "Confundiu a piscina com a academia"),
        ),
      ],
      question: t(
        "What does this notice at a sports club say?",
        "O que diz este aviso de um clube esportivo?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "placement-english-reading-pool-notice",
    skill: "english-reading",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Skip it for now and come back to it at the end",
            "Pular por enquanto e voltar a ela no fim",
          ),
          t(
            "All questions share the same clock; easier ones later may be quick points.",
            "Todas as questões disputam o mesmo tempo; as mais fáceis adiante podem render pontos rápidos.",
          ),
        ),
        bankOption(
          t("Keep at it until you solve it", "Insistir até resolver"),
          t(
            "Ten minutes on one question takes the time of three or four others.",
            "Dez minutos em uma questão tiram o tempo de outras três ou quatro.",
          ),
          t(
            "Thinks each question must be finished in order",
            "Acha que precisa terminar cada questão na ordem",
          ),
        ),
        bankOption(
          t("Leave it blank for good", "Deixar em branco de vez"),
          t(
            "A blank scores nothing, and the ENEM takes no points off a wrong answer.",
            "Em branco não pontua, e o ENEM não tira pontos por resposta errada.",
          ),
          t("Thinks a wrong answer costs points", "Acha que errar tira pontos"),
        ),
        bankOption(
          t("Ask the proctor to explain it", "Pedir ao fiscal que explique"),
          t(
            "Proctors only run the room; they can't help with any question.",
            "Os fiscais só cuidam da sala; não podem ajudar em nenhuma questão.",
          ),
          t(
            "Thinks the proctor can explain a question",
            "Acha que o fiscal pode explicar uma questão",
          ),
        ),
      ],
      question: t(
        "You've spent ten minutes on one ENEM question and still can't solve it. What's the best move?",
        "Você já gastou dez minutos em uma questão do ENEM e ainda não conseguiu resolver. Qual é a melhor decisão?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "placement-exam-time-stuck",
    skill: "exam-time",
  },
];
