import { t } from "../../_utils/localize";
import { bankOption } from "../content";
import { type SeedItem } from "../types";

/**
 * Phase challenge questions on measurement, uncertainty, the wave function, entanglement and Bell tests. With the course's other
 * items, every phase on a seeded learner's plan has enough questions for its challenge, on any day of the plan.
 */
export const quantumSystemsChallengeItems: SeedItem[] = [
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Either up or down: one definite result",
            "Para cima ou para baixo: um resultado definido",
          ),
          t(
            "A measurement always gives one of the possible results. The superposition decides only how likely each one is.",
            "Uma medição sempre dá um dos resultados possíveis. A superposição só decide a chance de cada um.",
          ),
        ),
        bankOption(
          t(
            "A value halfway between up and down",
            "Um valor no meio do caminho entre cima e baixo",
          ),
          t(
            "No measurement of spin ever gives an in-between value. Each one comes out fully up or fully down.",
            "Nenhuma medição de spin dá um valor intermediário. Cada uma sai totalmente para cima ou totalmente para baixo.",
          ),
          t(
            "Thinks a measurement shows the blend of the possibilities",
            "Acha que a medição mostra a mistura das possibilidades",
          ),
        ),
        bankOption(
          t("Up and down at the same time", "Para cima e para baixo ao mesmo tempo"),
          t(
            "The superposition can't be seen directly. Measuring it always gives a single result.",
            "A superposição não pode ser vista diretamente. Medir sempre dá um único resultado.",
          ),
          t(
            "Thinks a measurement can show a superposition directly",
            "Acha que uma medição pode mostrar a superposição diretamente",
          ),
        ),
        bankOption(
          t(
            "Nothing, because measuring destroys the particle",
            "Nada, porque medir destrói a partícula",
          ),
          t(
            "Measuring changes the particle's state, but the particle is still there and can be measured again.",
            "Medir muda o estado da partícula, mas ela continua lá e pode ser medida de novo.",
          ),
          t("Thinks measuring destroys the particle", "Acha que medir destrói a partícula"),
        ),
      ],
      question: t(
        "An electron's spin is in a superposition of up and down. You measure it. What do you find?",
        "O spin de um elétron está numa superposição de para cima e para baixo. Você mede. O que encontra?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "measurement-one-result",
    skill: "measurement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Each electron is found on one side, and the counts follow the probabilities",
            "Cada elétron aparece de um lado, e as contagens seguem as probabilidades",
          ),
          t(
            "Every single measurement gives one side. The superposition shows up only in how often each side comes out over many electrons.",
            "Cada medição dá um lado só. A superposição aparece apenas na frequência de cada lado ao longo de muitos elétrons.",
          ),
        ),
        bankOption(
          t(
            "Every electron is found on both sides at once",
            "Cada elétron aparece dos dois lados ao mesmo tempo",
          ),
          t(
            "A detector never clicks for the same electron on both sides. Each one turns up in a single place.",
            "Um detector nunca registra o mesmo elétron dos dois lados. Cada um aparece num lugar só.",
          ),
          t(
            "Thinks a measurement can show a superposition directly",
            "Acha que uma medição pode mostrar a superposição diretamente",
          ),
        ),
        bankOption(
          t(
            "All of them land on the same side, since they were prepared the same way",
            "Todos caem do mesmo lado, já que foram preparados do mesmo jeito",
          ),
          t(
            "Identical preparation gives identical chances, not identical results. Each electron's result is random.",
            "Preparo idêntico dá chances idênticas, não resultados idênticos. O resultado de cada elétron é aleatório.",
          ),
          t(
            "Thinks the same preparation gives the same result every time",
            "Acha que o mesmo preparo dá sempre o mesmo resultado",
          ),
        ),
        bankOption(
          t(
            "Each electron shows up halfway between the sides",
            "Cada elétron aparece no meio, entre os dois lados",
          ),
          t(
            "A measurement doesn't average the possibilities. The electron is found on one side or the other.",
            "A medição não tira a média das possibilidades. O elétron aparece de um lado ou do outro.",
          ),
          t(
            "Thinks a measurement shows the average of the possibilities",
            "Acha que a medição mostra a média das possibilidades",
          ),
        ),
      ],
      question: t(
        "A lab prepares 1,000 electrons, each in the same superposition of being on the left and on the right, and then detects where each one is. What does it see?",
        "Um laboratório prepara 1.000 elétrons, cada um na mesma superposição de estar à esquerda e à direita, e depois detecta onde cada um está. O que ele vê?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "measurement-many-electrons",
    skill: "measurement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Up again, every time", "Para cima de novo, todas as vezes"),
          t(
            "The first measurement left the electron in the up state, so repeating the same measurement gives the same result.",
            "A primeira medição deixou o elétron no estado para cima, então repetir a mesma medição dá o mesmo resultado.",
          ),
        ),
        bankOption(
          t(
            "Up or down at random, half the time each",
            "Para cima ou para baixo ao acaso, metade das vezes cada",
          ),
          t(
            "The chances were 50/50 only before the first measurement. After it, the state is up, and nothing changed it since.",
            "As chances eram meio a meio só antes da primeira medição. Depois dela, o estado é para cima, e nada o mudou desde então.",
          ),
          t(
            "Thinks every measurement starts the odds over",
            "Acha que cada medição recomeça as chances do zero",
          ),
        ),
        bankOption(
          t("Down, because measuring flips the spin", "Para baixo, porque medir inverte o spin"),
          t(
            "A measurement doesn't flip the result it just gave. It leaves the system in that result.",
            "Uma medição não inverte o resultado que acabou de dar. Ela deixa o sistema nesse resultado.",
          ),
          t("Thinks measuring flips the result", "Acha que medir inverte o resultado"),
        ),
      ],
      question: t(
        "You measure an electron's spin and get up. Right away, you measure it again in the same direction. What do you get?",
        "Você mede o spin de um elétron e obtém para cima. Logo em seguida, mede de novo na mesma direção. O que obtém?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "measurement-repeat-same-result",
    skill: "measurement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Recording the path makes each electron take one definite slit, so there are no longer two paths to overlap",
            "Registrar o caminho faz cada elétron passar por uma fenda definida, então não há mais dois caminhos para se sobrepor",
          ),
          t(
            "Interference needs both paths to stay possible. Once the path is recorded, each electron has one, and the stripes vanish.",
            "A interferência precisa que os dois caminhos continuem possíveis. Quando o caminho é registrado, cada elétron tem um só, e as faixas somem.",
          ),
        ),
        bankOption(
          t(
            "The stripes vanish only once a person reads the detector's result",
            "As faixas só somem quando uma pessoa lê o resultado do detector",
          ),
          t(
            "The detector recording the path is enough, whether or not anyone ever looks at it.",
            "Basta o detector registrar o caminho, alguém olhando ou não para ele.",
          ),
          t(
            "Thinks a conscious observer is needed for a measurement",
            "Acha que é preciso uma pessoa consciente para haver medição",
          ),
        ),
        bankOption(
          t(
            "The electrons sense they're being watched and choose to act like particles",
            "Os elétrons percebem que estão sendo observados e escolhem agir como partículas",
          ),
          t(
            "Electrons have no intentions. The physical interaction with the detector changes their state.",
            "Elétrons não têm intenções. A interação física com o detector muda o estado deles.",
          ),
          t("Gives particles intentions", "Atribui intenções às partículas"),
        ),
        bankOption(
          t("The detector blocks one of the slits", "O detector bloqueia uma das fendas"),
          t(
            "Both slits stay open. Electrons still pass through either one, but now each passage is recorded.",
            "As duas fendas continuam abertas. Os elétrons ainda passam por qualquer uma, mas agora cada passagem fica registrada.",
          ),
          t("Thinks the detector closes a slit", "Acha que o detector fecha uma fenda"),
        ),
      ],
      question: t(
        "In a double-slit experiment, electrons build up a striped pattern on a screen. When a detector records which slit each electron goes through, the stripes disappear. Why?",
        "Num experimento de fenda dupla, os elétrons formam um padrão de faixas na tela. Quando um detector registra por qual fenda cada elétron passa, as faixas desaparecem. Por quê?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "measurement-which-slit",
    skill: "measurement",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks a superposition is hidden ignorance, like a covered coin",
        "Acha que a superposição é só desconhecimento, como uma moeda coberta",
      ),
      reason: t(
        "If the particle were secretly in one place, its two possibilities couldn't interfere. Interference experiments show that both count until the measurement picks one.",
        "Se a partícula estivesse secretamente num lugar só, as duas possibilidades não poderiam interferir. Experimentos de interferência mostram que as duas contam até a medição escolher uma.",
      ),
      statement: t(
        "A particle in a superposition of two places is secretly in one of them all along; measuring it just reveals which, like lifting your hand off a tossed coin.",
        "Uma partícula numa superposição de dois lugares está o tempo todo secretamente em um deles; medir só revela qual, como tirar a mão de cima de uma moeda lançada.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "measurement-not-a-covered-coin",
    skill: "measurement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The more precisely its position is defined, the less precisely its momentum can be",
            "Quanto mais precisa é a posição de uma partícula, menos precisa pode ser a quantidade de movimento dela",
          ),
          t(
            "Position and momentum trade off: sharpening one blurs the other, and their product can't drop below a tiny limit.",
            "Posição e quantidade de movimento se compensam: afinar uma borra a outra, e o produto das duas não cai abaixo de um limite minúsculo.",
          ),
        ),
        bankOption(
          t(
            "Our instruments are too clumsy to measure tiny things exactly",
            "Nossos instrumentos são grosseiros demais para medir coisas minúsculas com exatidão",
          ),
          t(
            "The limit isn't about instruments. A particle simply doesn't have a sharp position and a sharp momentum at once.",
            "O limite não tem a ver com instrumentos. A partícula simplesmente não tem posição e quantidade de movimento bem definidas ao mesmo tempo.",
          ),
          t(
            "Thinks uncertainty comes from imperfect instruments",
            "Acha que a incerteza vem de instrumentos imperfeitos",
          ),
        ),
        bankOption(
          t(
            "Nothing at all can be known about a particle",
            "Nada pode ser conhecido sobre uma partícula",
          ),
          t(
            "You can know a lot, even one of the two very precisely. The limit is only on knowing both sharply together.",
            "Dá para saber muita coisa, até uma das duas com muita precisão. O limite é só para saber as duas com precisão juntas.",
          ),
          t(
            "Thinks the principle forbids any knowledge of a particle",
            "Acha que o princípio proíbe qualquer conhecimento sobre a partícula",
          ),
        ),
        bankOption(
          t(
            "A particle's position is always fuzzy, but its speed is exact",
            "A posição de uma partícula é sempre borrada, mas a velocidade é exata",
          ),
          t(
            "Neither one is always the fuzzy one. Pin down the momentum and the position becomes the blurry one.",
            "Nenhuma das duas é sempre a borrada. Crave a quantidade de movimento e a posição é que fica borrada.",
          ),
          t("Thinks only position is uncertain", "Acha que só a posição é incerta"),
        ),
      ],
      question: t(
        "What does the uncertainty principle say about a particle?",
        "O que o princípio da incerteza diz sobre uma partícula?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "uncertainty-what-it-says",
    skill: "uncertainty",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks uncertainty comes from imperfect instruments",
        "Acha que a incerteza vem de instrumentos imperfeitos",
      ),
      reason: t(
        "The limit is in the particle itself: a state with a sharp position is made of a wide spread of momenta. No instrument can get around that.",
        "O limite está na própria partícula: um estado com posição bem definida é feito de uma grande variedade de quantidades de movimento. Nenhum instrumento contorna isso.",
      ),
      statement: t(
        "With good enough instruments, we could one day measure an electron's exact position and exact momentum at the same time.",
        "Com instrumentos bons o bastante, um dia poderemos medir a posição exata e a quantidade de movimento exata de um elétron ao mesmo tempo.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "uncertainty-better-instruments",
    skill: "uncertainty",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("They spread out over a wider area", "Eles se espalham por uma área maior"),
          t(
            "A narrower slit pins down where each electron crosses, so its sideways motion becomes less certain and the beam fans out more.",
            "Uma fenda mais estreita crava por onde cada elétron passa, então o movimento para os lados fica mais incerto e o feixe se abre mais.",
          ),
        ),
        bankOption(
          t(
            "They land on a narrower line, like sand through a funnel",
            "Eles caem numa linha mais fina, como areia num funil",
          ),
          t(
            "That's how sand grains behave. For electrons, a tighter position means a wider spread of directions.",
            "É assim que grãos de areia se comportam. Para elétrons, posição mais apertada significa mais variedade de direções.",
          ),
          t(
            "Expects electrons to behave like everyday grains",
            "Espera que elétrons se comportem como grãos do dia a dia",
          ),
        ),
        bankOption(
          t("They slow down", "Eles ficam mais lentos"),
          t(
            "The slit doesn't take away speed. What grows is the uncertainty in the direction they travel.",
            "A fenda não tira velocidade. O que aumenta é a incerteza na direção em que eles seguem.",
          ),
          t(
            "Confuses uncertainty in direction with losing speed",
            "Confunde incerteza na direção com perda de velocidade",
          ),
        ),
        bankOption(
          t(
            "Nothing changes, since only light spreads out",
            "Nada muda, já que só a luz se espalha",
          ),
          t(
            "Electrons spread through slits too. It's the same trade-off between position and momentum.",
            "Elétrons também se espalham ao passar por fendas. É a mesma troca entre posição e quantidade de movimento.",
          ),
          t("Thinks only light spreads through a slit", "Acha que só a luz se espalha numa fenda"),
        ),
      ],
      question: t(
        "A beam of electrons passes through a single slit and hits a screen. You make the slit narrower. What happens to the electrons on the screen?",
        "Um feixe de elétrons passa por uma fenda e atinge uma tela. Você deixa a fenda mais estreita. O que acontece com os elétrons na tela?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "uncertainty-narrow-slit",
    skill: "uncertainty",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Even with no measurement at all, a particle can't have a sharp position and a sharp momentum together",
            "Mesmo sem medição nenhuma, uma partícula não pode ter posição e quantidade de movimento bem definidas juntas",
          ),
          t(
            "The kick from light is real, but the principle goes deeper: it's a property of the particle's state, not of how we look at it.",
            "O empurrão da luz existe, mas o princípio vai além: é uma propriedade do estado da partícula, não de como olhamos para ela.",
          ),
        ),
        bankOption(
          t(
            "Nothing, the kick from the light is the whole story",
            "Nada, o empurrão da luz é a história toda",
          ),
          t(
            "If that were all, gentler measurements could beat the limit. None can, because the limit is in the particle's state.",
            "Se fosse só isso, medições mais delicadas venceriam o limite. Nenhuma vence, porque o limite está no estado da partícula.",
          ),
          t(
            "Thinks uncertainty is only the kick a measurement gives",
            "Acha que a incerteza é só o empurrão que a medição dá",
          ),
        ),
        bankOption(
          t(
            "The principle applies only to light, not to electrons",
            "O princípio vale só para a luz, não para elétrons",
          ),
          t(
            "It applies to every particle, electrons included. That's why electrons spread through narrow slits.",
            "Vale para toda partícula, inclusive elétrons. É por isso que elétrons se espalham ao passar por fendas estreitas.",
          ),
          t("Thinks the principle is only about light", "Acha que o princípio é só sobre a luz"),
        ),
        bankOption(
          t(
            "It's only true when the electron moves fast",
            "Só vale quando o elétron se move rápido",
          ),
          t(
            "Speed has nothing to do with it. A slow electron has the same trade-off between position and momentum.",
            "A velocidade não tem nada a ver. Um elétron lento tem a mesma troca entre posição e quantidade de movimento.",
          ),
          t("Thinks the principle depends on speed", "Acha que o princípio depende da velocidade"),
        ),
      ],
      question: t(
        'A friend says: "The uncertainty principle just means that shining light on an electron to see it knocks it around." What is missing from that idea?',
        'Um amigo diz: "O princípio da incerteza só quer dizer que iluminar um elétron para vê-lo dá um empurrão nele." O que falta nessa ideia?',
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "uncertainty-not-just-a-kick",
    skill: "uncertainty",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Its limit is so tiny compared with a ball's size and mass that it's far below anything we could notice",
            "O limite é tão minúsculo perto do tamanho e da massa de uma bola que fica muito abaixo de qualquer coisa perceptível",
          ),
          t(
            "The principle applies to everything, but its limit is set by an extremely small constant. Only for things as light as electrons does it matter.",
            "O princípio vale para tudo, mas o limite é dado por uma constante extremamente pequena. Só em coisas leves como elétrons ele faz diferença.",
          ),
        ),
        bankOption(
          t(
            "The principle applies to particles, not to objects made of them",
            "O princípio vale para partículas, não para objetos feitos delas",
          ),
          t(
            "Big objects aren't exempt. Their uncertainty exists; it's just far too small to see.",
            "Objetos grandes não estão isentos. A incerteza deles existe; só é pequena demais para ver.",
          ),
          t(
            "Thinks big objects are exempt from quantum rules",
            "Acha que objetos grandes estão isentos das regras quânticas",
          ),
        ),
        bankOption(
          t(
            "A tennis ball moves too slowly for it to apply",
            "Uma bola de tênis é lenta demais para ele valer",
          ),
          t(
            "Speed doesn't switch the principle on or off. What makes it invisible is the ball's large mass.",
            "A velocidade não liga nem desliga o princípio. O que o torna invisível é a massa grande da bola.",
          ),
          t("Thinks the principle depends on speed", "Acha que o princípio depende da velocidade"),
        ),
        bankOption(
          t(
            "We see the ball with light, which doesn't disturb it",
            "Vemos a bola com luz, que não a perturba",
          ),
          t(
            "The principle isn't about disturbing the object. It limits what the object's state can be, seen or not.",
            "O princípio não é sobre perturbar o objeto. Ele limita como o estado do objeto pode ser, visto ou não.",
          ),
          t(
            "Thinks uncertainty is only the disturbance of looking",
            "Acha que a incerteza é só a perturbação de olhar",
          ),
        ),
      ],
      question: t(
        "Why don't we notice the uncertainty principle when we follow a tennis ball during a match?",
        "Por que não notamos o princípio da incerteza quando acompanhamos uma bola de tênis numa partida?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "uncertainty-tennis-ball",
    skill: "uncertainty",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t("Down", "Para baixo"),
          t(
            "This pair always comes out opposite, so if Alice got up, Bob gets down when he measures in the same direction.",
            "Esse par sempre sai oposto, então se Alice obteve para cima, Bob obtém para baixo ao medir na mesma direção.",
          ),
        ),
        bankOption(
          t("Up, like Alice's", "Para cima, como o de Alice"),
          t(
            "Entangled doesn't mean identical. This pair was made so the two results are always opposite.",
            "Emaranhado não quer dizer idêntico. Esse par foi criado para que os dois resultados sejam sempre opostos.",
          ),
          t(
            "Thinks entangled particles always give the same result",
            "Acha que partículas emaranhadas sempre dão o mesmo resultado",
          ),
        ),
        bankOption(
          t(
            "Up or down at random, half the time each",
            "Para cima ou para baixo ao acaso, metade das vezes cada",
          ),
          t(
            "On its own Bob's result looks random, but given Alice's result it isn't: the pair's results are linked.",
            "Sozinho, o resultado de Bob parece aleatório, mas sabendo o de Alice não é: os resultados do par são ligados.",
          ),
          t(
            "Thinks the link between the pair is lost at a distance",
            "Acha que a ligação entre o par se perde com a distância",
          ),
        ),
        bankOption(
          t(
            "Nothing definite until Alice sends him a signal",
            "Nada definido até Alice mandar um sinal para ele",
          ),
          t(
            "Bob's measurement gives a result right away, with no signal. A signal is only needed to compare notes.",
            "A medição de Bob dá um resultado na hora, sem sinal nenhum. Um sinal só é preciso para comparar as anotações.",
          ),
          t(
            "Thinks a signal must travel for entanglement to work",
            "Acha que um sinal precisa viajar para o emaranhamento funcionar",
          ),
        ),
      ],
      question: t(
        "Alice and Bob share a pair of entangled electrons whose spins always come out opposite. Alice measures hers and gets up. What will Bob find when he measures his in the same direction?",
        "Alice e Bob compartilham um par de elétrons emaranhados cujos spins sempre saem opostos. Alice mede o dela e obtém para cima. O que Bob vai encontrar ao medir o dele na mesma direção?",
      ),
    },
    difficulty: -1,
    format: "multipleChoice",
    key: "entanglement-opposite-spins",
    skill: "entanglement",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks distance weakens entanglement",
        "Acha que a distância enfraquece o emaranhamento",
      ),
      reason: t(
        "Distance doesn't weaken it: photons sent from a satellite to ground stations more than 1,000 km apart still matched. What breaks entanglement is interacting with the surroundings.",
        "A distância não o enfraquece: fótons enviados de um satélite para estações a mais de 1.000 km uma da outra continuaram combinando. O que desfaz o emaranhamento é a interação com o ambiente.",
      ),
      statement: t(
        "Entangled particles stay linked only while they're close together; separate them by a few kilometers and the link breaks.",
        "Partículas emaranhadas só ficam ligadas enquanto estão perto; separe-as por alguns quilômetros e a ligação se rompe.",
      ),
    },
    difficulty: 0,
    format: "trueFalse",
    key: "entanglement-distance",
    skill: "entanglement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Each glove is left or right from the start; entangled particles have no set result before they're measured, yet their results still match",
            "Cada luva já é esquerda ou direita desde o início; partículas emaranhadas não têm resultado definido antes da medição, e mesmo assim os resultados combinam",
          ),
          t(
            "Gloves only hide an answer that was always there. Experiments show entangled results can't all be fixed in advance.",
            "As luvas só escondem uma resposta que sempre esteve lá. Experimentos mostram que os resultados emaranhados não podem estar todos fixados de antemão.",
          ),
        ),
        bankOption(
          t(
            "Nothing, entanglement works just like the gloves",
            "Nada, o emaranhamento funciona igual às luvas",
          ),
          t(
            "The gloves are the picture experiments ruled out: no set of answers fixed in advance matches what entangled pairs do.",
            "As luvas são justamente a imagem que os experimentos descartaram: nenhum conjunto de respostas fixado de antemão reproduz o que os pares emaranhados fazem.",
          ),
          t(
            "Thinks entanglement is answers fixed in advance",
            "Acha que o emaranhamento é ter respostas fixadas de antemão",
          ),
        ),
        bankOption(
          t(
            "Entangled particles send each other a signal when one is measured",
            "Partículas emaranhadas mandam um sinal uma para a outra quando uma é medida",
          ),
          t(
            "No signal travels between them, and none could be used: each side's results look random on their own.",
            "Nenhum sinal viaja entre elas, e nenhum poderia ser usado: os resultados de cada lado parecem aleatórios sozinhos.",
          ),
          t(
            "Thinks a signal passes between entangled particles",
            "Acha que um sinal passa entre partículas emaranhadas",
          ),
        ),
        bankOption(
          t(
            "Entangled particles must stay physically touching",
            "Partículas emaranhadas precisam ficar encostadas",
          ),
          t(
            "They can be kilometers apart. Nothing physical connects them.",
            "Elas podem estar a quilômetros de distância. Nada físico as conecta.",
          ),
          t(
            "Thinks entangled particles need a physical connection",
            "Acha que partículas emaranhadas precisam de uma ligação física",
          ),
        ),
      ],
      question: t(
        "Split a pair of gloves into two closed boxes and send them far apart: open one, and you know what's in the other. How is an entangled pair different?",
        "Separe um par de luvas em duas caixas fechadas e mande-as para longe: abra uma e você sabe o que tem na outra. Em que um par emaranhado é diferente?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "entanglement-not-gloves",
    skill: "entanglement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "The pair has one shared state, and neither particle has a definite result of its own",
            "O par tem um único estado compartilhado, e nenhuma das partículas tem um resultado definido só seu",
          ),
          t(
            "That's what entangled means: the state describes the pair as a whole, so only the relation between the results is fixed.",
            "É isso que emaranhado quer dizer: o estado descreve o par como um todo, então só a relação entre os resultados está fixada.",
          ),
        ),
        bankOption(
          t(
            "Each particle has its own state, and the two are exact copies",
            "Cada partícula tem seu próprio estado, e as duas são cópias exatas",
          ),
          t(
            "Copies would each carry their own result. An entangled pair's results only exist as a relation between the two.",
            "Cópias carregariam cada uma o seu resultado. Os resultados de um par emaranhado só existem como uma relação entre os dois.",
          ),
          t(
            "Thinks entangled particles are identical copies",
            "Acha que partículas emaranhadas são cópias idênticas",
          ),
        ),
        bankOption(
          t(
            "One particle controls the other, like a remote control",
            "Uma partícula controla a outra, como um controle remoto",
          ),
          t(
            "Neither side can steer the other. Each side's results are random; they only agree with each other.",
            "Nenhum lado consegue comandar o outro. Os resultados de cada lado são aleatórios; eles só concordam entre si.",
          ),
          t(
            "Thinks one entangled particle controls the other",
            "Acha que uma partícula emaranhada controla a outra",
          ),
        ),
        bankOption(
          t(
            "They are a single particle seen in two places",
            "São uma única partícula vista em dois lugares",
          ),
          t(
            "They are two particles, each detected in its own place. What they share is a state, not an identity.",
            "São duas partículas, cada uma detectada no seu lugar. O que elas compartilham é um estado, não uma identidade.",
          ),
          t(
            "Thinks an entangled pair is one particle in two places",
            "Acha que um par emaranhado é uma partícula em dois lugares",
          ),
        ),
      ],
      question: t(
        "Which sentence describes an entangled pair of particles correctly?",
        "Qual frase descreve corretamente um par de partículas emaranhadas?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "entanglement-shared-state",
    skill: "entanglement",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks entanglement is a mechanical link",
        "Acha que o emaranhamento é uma ligação mecânica",
      ),
      reason: t(
        "Entanglement links measurement results, not motion. Pushing one particle doesn't move its partner, and it usually ends the entanglement.",
        "O emaranhamento liga resultados de medição, não movimento. Empurrar uma partícula não move a parceira, e em geral acaba com o emaranhamento.",
      ),
      statement: t(
        "If you push one particle of an entangled pair, its partner moves too, however far away it is.",
        "Se você empurra uma partícula de um par emaranhado, a parceira se move junto, por mais longe que esteja.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "entanglement-push",
    skill: "entanglement",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "She can't choose her results, and Bob's results look random until they compare notes",
            "Ela não escolhe os resultados, e os de Bob parecem aleatórios até os dois compararem as anotações",
          ),
          t(
            "Alice gets up or down at random, so she can't encode anything. Bob sees a random list either way.",
            "Alice obtém para cima ou para baixo ao acaso, então não consegue codificar nada. Bob vê uma lista aleatória de qualquer jeito.",
          ),
        ),
        bankOption(
          t(
            "The link gets too weak over long distances",
            "A ligação fica fraca demais em longas distâncias",
          ),
          t(
            "Distance isn't the problem: the results stay linked. A message can't be sent even across a room.",
            "A distância não é o problema: os resultados continuam ligados. Não dá para mandar mensagem nem de um lado da sala para o outro.",
          ),
          t(
            "Thinks distance is what blocks the message",
            "Acha que a distância é o que impede a mensagem",
          ),
        ),
        bankOption(
          t("She can, but only at the speed of light", "Ela consegue, mas só na velocidade da luz"),
          t(
            "Entanglement carries no message at any speed. Messages need an ordinary channel, like light or radio.",
            "O emaranhamento não carrega mensagem em velocidade nenhuma. Mensagens precisam de um canal comum, como luz ou rádio.",
          ),
          t(
            "Thinks entanglement sends signals at light speed",
            "Acha que o emaranhamento manda sinais na velocidade da luz",
          ),
        ),
        bankOption(
          t(
            "She can, as long as she measures before Bob",
            "Ela consegue, desde que meça antes de Bob",
          ),
          t(
            "Measuring first changes nothing Bob can see. His results look random whoever measures first.",
            "Medir primeiro não muda nada que Bob consiga ver. Os resultados dele parecem aleatórios, não importa quem mede antes.",
          ),
          t(
            "Thinks measuring first turns the link into a message",
            "Acha que medir primeiro transforma a ligação em mensagem",
          ),
        ),
      ],
      question: t(
        "Alice and Bob share many entangled pairs, far apart. Alice wants to send Bob a yes or a no just by how she measures her particles. Why can't she?",
        "Alice e Bob compartilham muitos pares emaranhados, longe um do outro. Alice quer mandar a Bob um sim ou um não só pelo jeito de medir as partículas dela. Por que ela não consegue?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "no-signaling-yes-or-no",
    skill: "no-signaling",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks entanglement can carry information",
        "Acha que o emaranhamento pode carregar informação",
      ),
      reason: t(
        "Each side's results are random on their own. The link only shows when both lists are compared, and that needs an ordinary signal, no faster than light.",
        "Os resultados de cada lado são aleatórios sozinhos. A ligação só aparece quando as duas listas são comparadas, e isso exige um sinal comum, não mais rápido que a luz.",
      ),
      statement: t(
        "Entanglement lets you send a message instantly to the other side of the galaxy.",
        "O emaranhamento permite mandar uma mensagem instantânea para o outro lado da galáxia.",
      ),
    },
    difficulty: -1,
    format: "trueFalse",
    key: "no-signaling-galaxy-message",
    skill: "no-signaling",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Nothing: his results look like a random 50/50 either way",
            "Nada: os resultados dele parecem um meio a meio aleatório de qualquer jeito",
          ),
          t(
            "Alice's choice doesn't change the odds on Bob's side. Only comparing both lists later reveals the link.",
            "A escolha de Alice não muda as chances do lado de Bob. Só comparar as duas listas depois revela a ligação.",
          ),
        ),
        bankOption(
          t(
            "Whether Alice measured, because his results would stop being random",
            "Se Alice mediu, porque os resultados dele deixariam de ser aleatórios",
          ),
          t(
            "His results are random whether or not she measured. A distant measurement doesn't change the odds he sees.",
            "Os resultados dele são aleatórios tendo ela medido ou não. Uma medição distante não muda as chances que ele vê.",
          ),
          t(
            "Thinks a distant measurement changes the local odds",
            "Acha que uma medição distante muda as chances locais",
          ),
        ),
        bankOption(
          t(
            "A message from Alice, written in his ups and downs",
            "Uma mensagem de Alice, escrita nos para cima e para baixo dele",
          ),
          t(
            "Alice can't choose her results, so there's no message to read in his.",
            "Alice não escolhe os resultados dela, então não há mensagem para ler nos dele.",
          ),
          t(
            "Thinks entangled results can carry a message",
            "Acha que resultados emaranhados podem carregar uma mensagem",
          ),
        ),
        bankOption(
          t(
            "Whether Alice measured, because his particles would feel collapsed",
            "Se Alice mediu, porque as partículas dele pareceriam colapsadas",
          ),
          t(
            "No local test tells a partner-measured particle apart from an untouched one.",
            "Nenhum teste local diferencia uma partícula cuja parceira foi medida de uma intocada.",
          ),
          t(
            "Thinks collapse can be detected from one side",
            "Acha que o colapso pode ser detectado de um lado só",
          ),
        ),
      ],
      question: t(
        "Bob measures his halves of 1,000 entangled pairs. Far away, Alice has either measured her halves or left them alone. Looking only at his own results, what can Bob tell?",
        "Bob mede as metades dele de 1.000 pares emaranhados. Longe dali, Alice mediu as metades dela ou as deixou quietas. Olhando só os próprios resultados, o que Bob consegue saber?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "no-signaling-bob-alone",
    skill: "no-signaling",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "When the two sides compare their results over an ordinary channel, like a phone call",
            "Quando os dois lados comparam os resultados por um canal comum, como uma ligação telefônica",
          ),
          t(
            "Each list looks random alone. The agreement only appears side by side, and getting the lists together takes an ordinary signal.",
            "Cada lista parece aleatória sozinha. A concordância só aparece lado a lado, e juntar as listas exige um sinal comum.",
          ),
        ),
        bankOption(
          t(
            "As soon as one side measures, on the other side's screen",
            "Assim que um lado mede, na tela do outro lado",
          ),
          t(
            "Nothing changes on the other side's screen: its results look random whether or not anyone measured far away.",
            "Nada muda na tela do outro lado: os resultados dele parecem aleatórios, tenha alguém medido longe ou não.",
          ),
          t(
            "Thinks the far side sees a change right away",
            "Acha que o outro lado vê uma mudança na hora",
          ),
        ),
        bankOption(
          t("Never, the link is only a theory", "Nunca, a ligação é só uma teoria"),
          t(
            "It has been measured many times, in labs and between distant stations, by comparing results.",
            "Ela já foi medida muitas vezes, em laboratórios e entre estações distantes, comparando resultados.",
          ),
          t(
            "Thinks entanglement has never been observed",
            "Acha que o emaranhamento nunca foi observado",
          ),
        ),
        bankOption(
          t(
            "Only when the two particles are brought back together",
            "Só quando as duas partículas são reunidas de novo",
          ),
          t(
            "The particles don't need to meet again. Their results, written down and compared, are enough.",
            "As partículas não precisam se reencontrar. Os resultados delas, anotados e comparados, bastam.",
          ),
          t(
            "Thinks the particles must be reunited to show the link",
            "Acha que as partículas precisam ser reunidas para mostrar a ligação",
          ),
        ),
      ],
      question: t(
        "Two labs far apart each measure one particle from many entangled pairs. When does the link between their results become visible?",
        "Dois laboratórios distantes medem cada um uma partícula de muitos pares emaranhados. Quando a ligação entre os resultados fica visível?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "no-signaling-compare-notes",
    skill: "no-signaling",
  },
  {
    content: {
      context: null,
      isTrue: true,
      misconception: null,
      reason: t(
        "Each side's results are random on their own, so nothing can be encoded in them. The agreement only shows after the lists are compared over an ordinary channel.",
        "Os resultados de cada lado são aleatórios sozinhos, então nada pode ser codificado neles. A concordância só aparece depois de comparar as listas por um canal comum.",
      ),
      statement: t(
        "The results of entangled particles agree however far apart they are, yet this can't be used to send information faster than light.",
        "Os resultados de partículas emaranhadas concordam por mais distantes que elas estejam, e mesmo assim isso não serve para mandar informação mais rápido que a luz.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "no-signaling-agree-but-no-message",
    skill: "no-signaling",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "Entangled particles agree more often than any plan fixed in advance could explain",
            "Partículas emaranhadas concordam mais vezes do que qualquer plano combinado de antemão conseguiria explicar",
          ),
          t(
            "Bell found a limit that any set of hidden instructions must obey. Experiments break that limit, as quantum physics predicts.",
            "Bell achou um limite que qualquer conjunto de instruções escondidas precisa obedecer. Os experimentos ultrapassam esse limite, como a física quântica prevê.",
          ),
        ),
        bankOption(
          t(
            "Entangled particles carry hidden instructions set when they were made",
            "Partículas emaranhadas carregam instruções escondidas definidas quando foram criadas",
          ),
          t(
            "That's the idea the tests ruled out: no hidden instructions reproduce the agreement that was measured.",
            "Essa é justamente a ideia que os testes descartaram: nenhuma instrução escondida reproduz a concordância medida.",
          ),
          t(
            "Thinks Bell tests support hidden instructions",
            "Acha que os testes de Bell apoiam instruções escondidas",
          ),
        ),
        bankOption(
          t(
            "Entangled particles send signals to each other faster than light",
            "Partículas emaranhadas mandam sinais uma para a outra mais rápido que a luz",
          ),
          t(
            "The tests showed no signal of any kind. Each side's results stay random; only their agreement breaks Bell's limit.",
            "Os testes não mostraram sinal de tipo nenhum. Os resultados de cada lado continuam aleatórios; só a concordância ultrapassa o limite de Bell.",
          ),
          t(
            "Thinks Bell tests showed faster-than-light signals",
            "Acha que os testes de Bell mostraram sinais mais rápidos que a luz",
          ),
        ),
        bankOption(
          t(
            "The strange results were measurement errors",
            "Os resultados estranhos eram erros de medição",
          ),
          t(
            "The results have been repeated for decades, with the main loopholes closed, and they won the 2022 Nobel Prize in Physics.",
            "Os resultados foram repetidos por décadas, com as principais brechas fechadas, e ganharam o Nobel de Física de 2022.",
          ),
          t(
            "Thinks the results were experimental noise",
            "Acha que os resultados eram ruído experimental",
          ),
        ),
      ],
      question: t(
        "What did Bell tests show about entangled particles?",
        "O que os testes de Bell mostraram sobre partículas emaranhadas?",
      ),
    },
    difficulty: 0,
    format: "multipleChoice",
    key: "bell-test-what-it-showed",
    skill: "bell-test",
  },
  {
    content: {
      context: null,
      isTrue: false,
      misconception: t(
        "Thinks Bell tests support hidden instructions",
        "Acha que os testes de Bell apoiam instruções escondidas",
      ),
      reason: t(
        "They showed the opposite. Any hidden list of answers would keep the agreement under Bell's limit, and the measured agreement goes over it.",
        "Eles mostraram o contrário. Qualquer lista escondida de respostas manteria a concordância abaixo do limite de Bell, e a concordância medida passa dele.",
      ),
      statement: t(
        "Bell tests confirmed that each entangled particle carries a hidden list of answers, set when the pair is created.",
        "Os testes de Bell confirmaram que cada partícula emaranhada carrega uma lista escondida de respostas, definida quando o par é criado.",
      ),
    },
    difficulty: 1,
    format: "trueFalse",
    key: "bell-test-no-hidden-list",
    skill: "bell-test",
  },
  {
    content: {
      context: null,
      options: [
        bankOption(
          t(
            "So no plan carried by the particles could know in advance which measurement they'd face",
            "Para que nenhum plano levado pelas partículas pudesse saber de antemão qual medição elas enfrentariam",
          ),
          t(
            "If the settings were fixed, the particles' hidden instructions could in principle be tuned to them. Random late choices close that loophole.",
            "Se as configurações fossem fixas, as instruções escondidas das partículas poderiam, em tese, se ajustar a elas. Escolhas aleatórias de última hora fecham essa brecha.",
          ),
        ),
        bankOption(
          t("To make the results less random", "Para deixar os resultados menos aleatórios"),
          t(
            "Switching settings doesn't reduce randomness. Each detector's results stay a random mix.",
            "Trocar as configurações não reduz a aleatoriedade. Os resultados de cada detector continuam uma mistura aleatória.",
          ),
          t(
            "Thinks switching settings reduces randomness",
            "Acha que trocar as configurações reduz a aleatoriedade",
          ),
        ),
        bankOption(
          t(
            "To send a signal from one detector to the other",
            "Para mandar um sinal de um detector para o outro",
          ),
          t(
            "The point is the reverse: the choices are made so late that no signal could get from one detector to the other in time.",
            "A ideia é o contrário: as escolhas são feitas tão tarde que nenhum sinal chegaria de um detector ao outro a tempo.",
          ),
          t(
            "Thinks the detectors signal each other",
            "Acha que os detectores mandam sinais um para o outro",
          ),
        ),
        bankOption(
          t("To average out errors in the detectors", "Para compensar erros dos detectores"),
          t(
            "Calibration handles detector errors. The random switching is about ruling out a plan fixed in advance.",
            "A calibração cuida dos erros dos detectores. A troca aleatória serve para descartar um plano combinado de antemão.",
          ),
          t(
            "Confuses the random settings with calibration",
            "Confunde as configurações aleatórias com calibração",
          ),
        ),
      ],
      question: t(
        "In the best Bell tests, each detector picks its measurement direction at random while the particles are already in flight. Why?",
        "Nos melhores testes de Bell, cada detector escolhe a direção da medição ao acaso enquanto as partículas já estão a caminho. Por quê?",
      ),
    },
    difficulty: 1,
    format: "multipleChoice",
    key: "bell-test-random-settings",
    skill: "bell-test",
  },
  {
    content: {
      context: null,
      math: {
        answer: 36,
        commonMistakes: [
          {
            expression: "amplitude * 100",
            misconception: t(
              "Took the amplitude itself as the probability",
              "Tomou a própria amplitude como probabilidade",
            ),
            reason: t(
              "The chance is the amplitude squared, not the amplitude.",
              "A chance é a amplitude ao quadrado, não a amplitude.",
            ),
          },
          {
            expression: "2 * amplitude * 100",
            misconception: t(
              "Doubled the amplitude instead of squaring it",
              "Dobrou a amplitude em vez de elevá-la ao quadrado",
            ),
            reason: t(
              "Squaring means multiplying the amplitude by itself, not by 2.",
              "Elevar ao quadrado é multiplicar a amplitude por ela mesma, não por 2.",
            ),
          },
        ],
        solution: "amplitude^2 * 100",
        steps: [
          {
            expression: "amplitude^2",
            text: t(
              "Square the amplitude: {amplitude}² = {result}",
              "Eleve a amplitude ao quadrado: {amplitude}² = {result}",
            ),
          },
          {
            expression: "amplitude^2 * 100",
            text: t("As a percent: {result}%", "Em porcentagem: {result}%"),
          },
        ],
        tolerance: { kind: "absolute", value: 0.5 },
        unit: "%",
        variables: [{ max: 0.9, min: 0.1, name: "amplitude", step: 0.1, unit: null, value: 0.6 }],
      },
      question: t(
        "An electron is in a superposition of being in the left half or the right half of a box. The amplitude for the left half is {amplitude}. What is the chance, in percent, of finding it in the left half?",
        "Um elétron está numa superposição de estar na metade esquerda ou na metade direita de uma caixa. A amplitude para a metade esquerda é {amplitude}. Qual é a chance, em porcentagem, de encontrá-lo na metade esquerda?",
      ),
    },
    difficulty: 0,
    format: "numeric",
    key: "born-rule-left-half",
    skill: "born-rule",
  },
];
