import { renderCertificateImage } from "@/lib/certificates/certificate-image";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { CERTIFICATE_IMAGE_VARIANTS } from "@zoonk/utils/certificate-links";

/* Proof-only route for the Vercel preview: renders fixed sample certificates. Never merged. */
const SAMPLES: CertificateFacts[] = [
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT00000001",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Ana Souza",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [
      "Talk about past trips, plans and experiences"
    ],
    "category": null,
    "courseLevels": [],
    "lessonsStudied": 186,
    "lessonsTestedOut": null,
    "measuredLevel": null,
    "minutes": 3720,
    "skillLevels": [
      {
        "skill": "reading",
        "label": "B2"
      },
      {
        "skill": "listening",
        "label": "B2"
      },
      {
        "skill": "writing",
        "label": "B2+"
      }
    ],
    "topics": [],
    "code": "CERT00000002",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "languageLevel",
    "language": "en",
    "level": "B1",
    "recipientName": "Ana Souza",
    "targetLanguage": "es",
    "title": null
  },
  {
    "answered": 7,
    "canDo": [],
    "category": null,
    "courseLevels": [],
    "lessonsStudied": null,
    "lessonsTestedOut": null,
    "measuredLevel": "B1",
    "minutes": null,
    "skillLevels": [
      {
        "skill": "reading",
        "label": "B1"
      },
      {
        "skill": "listening",
        "label": "A2+"
      },
      {
        "skill": "speaking",
        "label": "B1"
      }
    ],
    "topics": [],
    "code": "CERT00000003",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "placement",
    "language": "en",
    "level": "B1",
    "recipientName": "Ana Souza",
    "targetLanguage": "es",
    "title": null
  },
  {
    "answered": null,
    "canDo": [],
    "category": "tech",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 10
      },
      {
        "level": "intermediate",
        "chapters": 10
      },
      {
        "level": "advanced",
        "chapters": 8
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Tipos de dados",
      "Pandas",
      "Gráficos",
      "Estatística descritiva",
      "Regressão",
      "Limpeza de dados",
      "Projetos"
    ],
    "code": "CERT00000004",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "pt",
    "level": null,
    "recipientName": "Maria da Conceição Aparecida dos Santos Ferreira",
    "targetLanguage": null,
    "title": "Introdução à análise de dados com Python e estatística para quem está começando no mercado de trabalho"
  },
  {
    "answered": null,
    "canDo": [],
    "category": null,
    "courseLevels": [],
    "lessonsStudied": 186,
    "lessonsTestedOut": null,
    "measuredLevel": null,
    "minutes": 3720,
    "skillLevels": [
      {
        "skill": "reading",
        "label": "B1"
      },
      {
        "skill": "listening",
        "label": "B1+"
      }
    ],
    "topics": [],
    "code": "CERT00000005",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "languageLevel",
    "language": "en",
    "level": "A2",
    "recipientName": "Li Na",
    "targetLanguage": "en",
    "title": null
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "光と物質",
      "波と確率",
      "シュレーディンガー方程式",
      "原子とスピン",
      "トンネル効果",
      "量子もつれ",
      "量子コンピューター",
      "測定"
    ],
    "code": "CERT00000006",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "ja",
    "level": null,
    "recipientName": "山田 花子",
    "targetLanguage": null,
    "title": "ゼロから学ぶ量子物理学"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "business",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 10
      }
    ],
    "lessonsStudied": 38,
    "lessonsTestedOut": 0,
    "measuredLevel": null,
    "minutes": 540,
    "skillLevels": [],
    "topics": [
      "Budgeting",
      "Saving and interest",
      "Payslips and taxes",
      "Debt"
    ],
    "code": "CERT00000007",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "محمد عبد الرحمن",
    "targetLanguage": null,
    "title": "Personal finance for your first job"
  },
  {
    "answered": 7,
    "canDo": [],
    "category": null,
    "courseLevels": [],
    "lessonsStudied": null,
    "lessonsTestedOut": null,
    "measuredLevel": "B2",
    "minutes": null,
    "skillLevels": [
      {
        "skill": "reading",
        "label": "B2"
      },
      {
        "skill": "listening",
        "label": "B1+"
      },
      {
        "skill": "speaking",
        "label": "B2"
      }
    ],
    "topics": [],
    "code": "CERT00000008",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "placement",
    "language": "en",
    "level": "B2",
    "recipientName": "प्रिया शर्मा",
    "targetLanguage": "en",
    "title": null
  },
  {
    "answered": null,
    "canDo": [],
    "category": "business",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 9
      },
      {
        "level": "intermediate",
        "chapters": 9
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Unternehmensformen",
      "Rechnungswesen",
      "Marketing",
      "Personal"
    ],
    "code": "CERT00000009",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "de",
    "level": null,
    "recipientName": "Friederike Schwarzenberger-Müller",
    "targetLanguage": null,
    "title": "Grundlagen der Betriebswirtschaftslehre für Quereinsteigerinnen und Quereinsteiger"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000A",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": null,
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      }
    ],
    "lessonsStudied": 52,
    "lessonsTestedOut": 9,
    "measuredLevel": null,
    "minutes": null,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "Atoms and spin"
    ],
    "code": "CERT0000000B",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Jordan Okafor",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000C",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "שלום כהן",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000D",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "김민준",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000E",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "张伟 刘洋",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000F",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "สมชาย ใจดี",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000G",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "pl",
    "level": null,
    "recipientName": "Agnieszka Wróblewska-Łęcka",
    "targetLanguage": null,
    "title": "Fizyka kwantowa od podstaw"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000H",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "tr",
    "level": null,
    "recipientName": "Çağlar Öztürk İşıl",
    "targetLanguage": null,
    "title": "Sıfırdan kuantum fiziği"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000J",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Will محمد",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000K",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "es",
    "level": null,
    "recipientName": "Maximiliano Alejandro de la Santísima Trinidad Fernández-Gutiérrez y Montenegro",
    "targetLanguage": null,
    "title": "Física cuántica desde cero"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000M",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Ana Souza",
    "targetLanguage": null,
    "title": "A practical, hands-on introduction to machine learning, statistics, probability and data visualization for complete beginners who want to change careers into data science"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      }
    ],
    "lessonsStudied": 120,
    "lessonsTestedOut": 10,
    "measuredLevel": null,
    "minutes": 1800,
    "skillLevels": [],
    "topics": [
      "빛과 물질",
      "파동과 확률",
      "슈뢰딩거 방정식",
      "원자와 스핀"
    ],
    "code": "CERT0000000N",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "ko",
    "level": null,
    "recipientName": "김민준",
    "targetLanguage": null,
    "title": "처음 배우는 양자 물리학"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000P",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "山田 花子",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000Q",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Γιώργος Παπαδόπουλος",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "science",
    "courseLevels": [
      {
        "level": "beginner",
        "chapters": 12
      },
      {
        "level": "intermediate",
        "chapters": 14
      },
      {
        "level": "advanced",
        "chapters": 10
      }
    ],
    "lessonsStudied": 148,
    "lessonsTestedOut": 65,
    "measuredLevel": null,
    "minutes": 2460,
    "skillLevels": [],
    "topics": [
      "Light and matter",
      "Waves and probability",
      "The Schrödinger equation",
      "Atoms and spin",
      "Tunneling",
      "Entanglement",
      "Quantum computing",
      "Measurement"
    ],
    "code": "CERT0000000R",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Ana 🌸 Souza",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": "exams",
    "courseLevels": [],
    "lessonsStudied": 30,
    "lessonsTestedOut": 0,
    "measuredLevel": null,
    "minutes": 45,
    "skillLevels": [],
    "topics": [],
    "code": "CERT0000000S",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "course",
    "language": "en",
    "level": null,
    "recipientName": "Ana Souza",
    "targetLanguage": null,
    "title": "Quantum physics from scratch"
  },
  {
    "answered": null,
    "canDo": [],
    "category": null,
    "courseLevels": [],
    "lessonsStudied": 400,
    "lessonsTestedOut": null,
    "measuredLevel": null,
    "minutes": 9000,
    "skillLevels": [
      {
        "skill": "reading",
        "label": "C1+"
      },
      {
        "skill": "listening",
        "label": "C2"
      },
      {
        "skill": "speaking",
        "label": "C1+"
      },
      {
        "skill": "writing",
        "label": "C1+"
      }
    ],
    "topics": [],
    "code": "CERT0000000T",
    "completedOn": "2026-11-03",
    "courseId": null,
    "kind": "languageLevel",
    "language": "fr",
    "level": "C1",
    "recipientName": "Ana Souza",
    "targetLanguage": "es",
    "title": null
  }
];

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/certificate-proof/[sample]">) {
  const { sample } = await params;
  const [code = "", file = ""] = sample.split("-");
  const variant = CERTIFICATE_IMAGE_VARIANTS.find((name) => file === `${name}.png`);
  const facts = SAMPLES.find((item) => item.code === code);

  if (!variant || !facts) {
    return new Response(null, { status: 404 });
  }

  const started = performance.now();
  const image = await renderCertificateImage({ facts, variant });
  const body = await image.arrayBuffer();
  const duration = Math.round(performance.now() - started);

  return new Response(body, {
    headers: { "Cache-Control": "no-store", "Content-Type": "image/png", "Server-Timing": `render;dur=${duration}` },
  });
}
