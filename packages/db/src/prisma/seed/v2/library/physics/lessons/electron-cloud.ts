import { t } from "../../../_utils/localize";
import { guess, option } from "../../content";
import { type SeedLesson } from "../../types";

/**
 * Chapter "Inside the atom", lesson 2. Most people learned the planet picture of the atom, so the
 * lesson opens with a guess, breaks that picture with one fact and rebuilds the atom as a cloud
 * whose lowest energy is a floor.
 */
export const electronCloudLesson: SeedLesson = {
  canDo: t(
    "You'll explain why atoms don't collapse, using the electron cloud.",
    "Você vai explicar por que os átomos não colapsam, usando a nuvem de elétrons.",
  ),
  description: t(
    "Classical physics says atoms should collapse in an instant. The electron cloud explains why they don't.",
    "A física clássica diz que os átomos deveriam colapsar num instante. A nuvem de elétrons explica por que isso não acontece.",
  ),
  key: "electron-cloud",
  minutes: 6,
  skills: ["electron-cloud", "ground-state"],
  steps: [
    {
      content: {
        options: [
          guess(
            "planet",
            t("Like a planet, circling in an orbit", "Como um planeta, girando numa órbita"),
          ),
          guess(
            "cloud",
            t("As a cloud, spread out all around", "Como uma nuvem, espalhado ao redor"),
            true,
          ),
          guess("still", t("Standing still in one fixed spot", "Parado em um ponto fixo")),
        ],
        question: t(
          "An electron is pulled toward the nucleus. How does it stay around it without falling in?",
          "O elétron é atraído pelo núcleo. Como ele fica ao redor sem cair?",
        ),
        reveal: t(
          "As a cloud. The planet picture is the one most of us learned at school, and it's the one that fails. Let's see why.",
          "Como uma nuvem. A imagem do planeta é a que a maioria de nós aprendeu na escola, e é justamente ela que falha. Vamos ver por quê.",
        ),
        variant: "guess",
      },
      kind: "hook",
    },
    {
      content: {
        text: t(
          "In the classic drawing, the electron circles the nucleus like Earth circles the Sun. But a charge moving in a circle gives off light, and light carries energy away.\n\nAn orbiting electron would lose energy on every lap and spiral into the nucleus in about **16 trillionths of a second**. Atoms have lasted billions of years, so the drawing is wrong, not the atom.",
          "No desenho clássico, o elétron gira em volta do núcleo como a Terra em volta do Sol. Só que uma carga andando em círculo emite luz, e a luz leva energia embora.\n\nUm elétron em órbita perderia energia a cada volta e cairia em espiral no núcleo em cerca de **16 trilionésimos de segundo**. Os átomos existem há bilhões de anos, então o errado é o desenho, não o átomo.",
        ),
        title: t("The planet picture breaks", "A imagem do planeta não funciona"),
      },
      kind: "explanation",
    },
    {
      content: {
        exampleLineSlot: {
          idea: t(
            "A blur that shows where something is likely to be, not where it is",
            "Um borrão que mostra onde algo provavelmente está, não onde está",
          ),
        },
        text: t(
          "The electron doesn't follow a path at all. It's spread out as a **cloud of chances**, which physicists call an **orbital**: a map of where you'd likely find it if you looked. Where the cloud is thick, finding it is likely. Where it's thin, it's rare.\n\nA spinning fan looks like a blur that shows where a blade might be. The electron's cloud is a blur like that, except there's no tiny ball racing around inside it.",
          "O elétron não segue caminho nenhum. Ele fica espalhado como uma **nuvem de probabilidades**, que os físicos chamam de **orbital**: um mapa de onde você provavelmente o encontraria se olhasse. Onde a nuvem é densa, encontrá-lo é provável. Onde é rala, é raro.\n\nUm ventilador ligado vira um borrão que mostra onde uma pá pode estar. A nuvem do elétron é um borrão assim, só que não há nenhuma bolinha correndo lá dentro.",
        ),
        title: t("A cloud, not a little ball", "Uma nuvem, não uma bolinha"),
      },
      kind: "explanation",
    },
    {
      content: {
        options: [
          option(
            "path",
            t("The exact path the electron follows", "O caminho exato que o elétron percorre"),
            t(
              "There's no path to show. The electron doesn't move along a track, so the cloud can't be one.",
              "Não há caminho para mostrar. O elétron não anda por um trilho, então a nuvem não pode ser um.",
            ),
          ),
          option(
            "chances",
            t(
              "Where the electron is most likely to be found",
              "Onde é mais provável encontrar o elétron",
            ),
            t(
              "Right. The cloud is a map of chances: thick where finding the electron is likely, thin where it's rare.",
              "Isso. A nuvem é um mapa de probabilidades: densa onde é provável encontrar o elétron, rala onde é raro.",
            ),
            true,
          ),
          option(
            "size",
            t("How big the electron is", "O tamanho do elétron"),
            t(
              "It isn't the electron's size. As far as anyone can measure, the electron has no size at all; the cloud maps where it might be.",
              "Não é o tamanho do elétron. Até onde se consegue medir, o elétron não tem tamanho nenhum; a nuvem mapeia onde ele pode estar.",
            ),
          ),
        ],
        question: t("What does the electron cloud show?", "O que a nuvem de elétrons mostra?"),
      },
      kind: "check",
      skill: "electron-cloud",
    },
    {
      content: {
        text: t(
          "Pulling the electron closer means squeezing its cloud into a smaller space. And in quantum physics, **the more confined something is, the more it jitters**. Jittering takes energy.\n\nThe nucleus pulls the cloud in. The jitter pushes it out. The cloud settles where the two balance: about 0.1 nanometer across in hydrogen.",
          "Puxar o elétron para mais perto é espremer a nuvem num espaço menor. E, na física quântica, **quanto mais confinado, mais agitado**. Agitação custa energia.\n\nO núcleo puxa a nuvem para dentro. A agitação empurra para fora. A nuvem se acomoda onde os dois se equilibram: cerca de 0,1 nanômetro no hidrogênio.",
        ),
        title: t("So why doesn't it fall?", "Então por que ele não cai?"),
      },
      kind: "explanation",
      skill: "ground-state",
    },
    {
      content: {
        text: t(
          "That balance is the atom's lowest possible energy, the **ground state**. Falling in would mean going lower, and there is no lower. Nothing holds the electron up: there's simply no “further down” to fall to.\n\nThe electron can only have certain energies, like the steps of a staircase. The ground state is the bottom step.",
          "Esse equilíbrio é a menor energia possível do átomo, o **estado fundamental**. Cair seria descer mais, e não existe mais baixo. Nada segura o elétron: simplesmente não há um “mais para baixo” para onde cair.\n\nO elétron só pode ter certas energias, como os degraus de uma escada. O estado fundamental é o degrau mais baixo.",
        ),
        title: t("The ground state", "O estado fundamental"),
      },
      kind: "explanation",
      skill: "ground-state",
    },
    {
      content: {
        options: [
          option(
            "push",
            t(
              "The nucleus pushes it away when it gets too close",
              "O núcleo o empurra quando ele chega perto demais",
            ),
            t(
              "The nucleus only pulls: it's positive and the electron is negative. Nothing pushes back.",
              "O núcleo só atrai: ele é positivo e o elétron é negativo. Nada empurra de volta.",
            ),
          ),
          option(
            "lowest",
            t(
              "It's already in the lowest energy state there is",
              "Ele já está no estado de menor energia possível",
            ),
            t(
              "Yes. A smaller cloud would jitter more and cost more energy than it gains, so the ground state is the floor.",
              "Isso. Uma nuvem menor se agitaria mais e custaria mais energia do que ganharia, então o estado fundamental é o piso.",
            ),
            true,
          ),
          option(
            "fast",
            t("It spins too fast to be caught", "Ele gira rápido demais para ser capturado"),
            t(
              "That's the planet picture again. The electron doesn't circle the nucleus, so speed isn't what keeps it out.",
              "Essa é a imagem do planeta de novo. O elétron não gira em volta do núcleo, então não é a velocidade que o mantém fora.",
            ),
          ),
          option(
            "light",
            t(
              "Electrons are too light to be pulled in",
              "Elétrons são leves demais para serem puxados",
            ),
            t(
              "Light things are pulled too, and the pull here is strong. It's the jitter of a squeezed electron that balances it.",
              "Coisas leves também são atraídas, e a atração aqui é forte. É a agitação do elétron espremido que equilibra a conta.",
            ),
          ),
        ],
        question: t(
          "Why can't the electron in a hydrogen atom lose more energy and fall into the nucleus?",
          "Por que o elétron do hidrogênio não pode perder mais energia e cair no núcleo?",
        ),
      },
      kind: "check",
      skill: "ground-state",
    },
    {
      content: {
        check: {
          explanation: t(
            "The planet picture predicts atoms that collapse. The cloud picture explains why they last.",
            "A imagem do planeta prevê átomos que colapsam. A imagem da nuvem explica por que eles duram.",
          ),
          kind: "interaction",
        },
        fields: {
          groups: [
            {
              id: "planet",
              label: t("Planet picture", "Imagem do planeta"),
              rule: t(
                "The electron is a tiny ball that follows a path.",
                "O elétron é uma bolinha que segue um caminho.",
              ),
            },
            {
              id: "cloud",
              label: t("Cloud picture", "Imagem da nuvem"),
              rule: t(
                "The electron is spread out as a map of chances.",
                "O elétron está espalhado como um mapa de probabilidades.",
              ),
            },
          ],
          items: [
            {
              groupId: "planet",
              id: "track",
              text: t(
                "The electron circles the nucleus on a track",
                "O elétron gira em volta do núcleo num trilho",
              ),
              why: t(
                "A track is a path, and the cloud picture has none.",
                "Um trilho é um caminho, e a imagem da nuvem não tem nenhum.",
              ),
            },
            {
              groupId: "planet",
              id: "collapse",
              text: t(
                "Atoms should collapse in a split second",
                "Os átomos deveriam colapsar numa fração de segundo",
              ),
              why: t(
                "That's what an orbiting charge would do, which is how we know the picture fails.",
                "É o que uma carga em órbita faria, e é assim que sabemos que a imagem falha.",
              ),
            },
            {
              groupId: "cloud",
              id: "likely",
              text: t(
                "You can say where the electron is likely to be, not where it is",
                "Dá para dizer onde o elétron provavelmente está, não onde ele está",
              ),
              why: t(
                "Chances, not positions: that's what the cloud maps.",
                "Probabilidades, não posições: é isso que a nuvem mapeia.",
              ),
            },
            {
              groupId: "cloud",
              id: "lowest",
              text: t(
                "There's a lowest energy, and atoms sit in it",
                "Existe uma energia mínima, e os átomos ficam nela",
              ),
              why: t(
                "The ground state only exists in the cloud picture.",
                "O estado fundamental só existe na imagem da nuvem.",
              ),
            },
            {
              groupId: "cloud",
              id: "jitter",
              text: t(
                "Squeezing the electron closer makes it jitter more",
                "Espremer o elétron mais perto faz ele se agitar mais",
              ),
              why: t(
                "Confinement costs energy in the quantum picture; a planet follows no such rule.",
                "Na imagem quântica, confinar custa energia; um planeta não segue essa regra.",
              ),
            },
          ],
        },
        prompt: t(
          "Sort each statement into the picture of the atom it belongs to.",
          "Coloque cada frase na imagem do átomo a que ela pertence.",
        ),
        template: "categorize",
      },
      kind: "activity",
      skill: "electron-cloud",
    },
    {
      content: {
        keyPoints: [
          t(
            "The electron is a cloud of chances, not a ball on an orbit",
            "O elétron é uma nuvem de probabilidades, não uma bolinha em órbita",
          ),
          t(
            "Squeezing the cloud closer makes it jitter more, which costs energy",
            "Espremer a nuvem mais perto aumenta a agitação, e isso custa energia",
          ),
          t(
            "The atom is already at its lowest energy, the ground state, so there's nowhere lower to fall",
            "O átomo já está na menor energia, o estado fundamental, então não há para onde cair",
          ),
        ],
        question: t(
          "A friend says: “The electron would fall into the nucleus if it stopped moving.” In two or three sentences, explain what really keeps atoms from collapsing.",
          "Um amigo diz: “O elétron cairia no núcleo se parasse de se mexer.” Em duas ou três frases, explique o que de fato impede os átomos de colapsar.",
        ),
        sampleAnswer: t(
          "The electron isn't a ball moving on an orbit, so stopping isn't the issue. It's a cloud, and squeezing that cloud toward the nucleus would make it jitter more, costing more energy than the pull gives back. The atom is already at its lowest energy, the ground state, so there's no lower place to fall.",
          "O elétron não é uma bolinha andando numa órbita, então parar não é a questão. Ele é uma nuvem, e espremer essa nuvem em direção ao núcleo aumentaria a agitação, custando mais energia do que a atração devolve. O átomo já está na menor energia, o estado fundamental, então não há lugar mais baixo para cair.",
        ),
      },
      kind: "typedAnswer",
      skill: "ground-state",
    },
    {
      content: {
        ideas: [
          {
            text: t(
              "The electron doesn't fall because the atom is already at its lowest energy: there's nowhere lower to go.",
              "O elétron não cai porque o átomo já está na menor energia: não há para onde descer.",
            ),
          },
          {
            text: t(
              "The planet picture fails: an orbiting electron would radiate energy and crash in an instant.",
              "A imagem do planeta falha: um elétron em órbita irradiaria energia e cairia num instante.",
            ),
          },
          {
            text: t(
              "Orbital: the cloud that maps where the electron is likely to be found.",
              "Orbital: a nuvem que mapeia onde o elétron provavelmente está.",
            ),
          },
          {
            text: t(
              "The more confined the electron is, the more it jitters, and jitter costs energy.",
              "Quanto mais confinado o elétron, mais ele se agita, e agitação custa energia.",
            ),
          },
          {
            text: t(
              "Ground state: the lowest energy an atom can have, the bottom step of its staircase.",
              "Estado fundamental: a menor energia que um átomo pode ter, o degrau mais baixo da escada.",
            ),
          },
        ],
      },
      kind: "summary",
    },
  ],
  supportMode: "questionFirst",
  title: t("Why doesn't the electron fall in?", "Por que o elétron não cai no núcleo?"),
};
