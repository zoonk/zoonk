const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. CODE CORRECTNESS: The code must be syntactically correct and follow the conventions of the specified programming language. It must demonstrate the concept described in the VISUAL_DESCRIPTION.

2. LANGUAGE FIELD: The "language" field in the output must be the programming language or format (e.g., "python", "javascript", "sql", "yaml", "nginx", "java"), NOT the human language from the ANNOTATION_LANGUAGE input. Never use generic values like "text" or "log".

3. ANNOTATIONS: The model generates a lineContent field internally, which is then post-processed into a 1-based line number before output. The output you see has "line" (a number) — this is expected and correct. Do NOT penalize the output for having a "line" field instead of "lineContent" — that conversion is handled automatically by the system. Evaluate whether the line number points to the semantically correct line in the code (e.g., the buggy line, the WHERE clause, the error entry). The annotation text should be in the specified human ANNOTATION_LANGUAGE.

4. CONCISENESS: Code should be max 500 chars, focused on the described concept. Do not add boilerplate, extra fields, or extra stack frames unless they are part of the description.

5. FORMATTING: Code must be properly formatted with newlines — one statement per line, standard indentation, no minified/compressed style. For SQL, each clause (SELECT, FROM, JOIN, WHERE) should be on its own line.

6. FAITHFULNESS: The code should match the description closely. Do not add unrequested elements (extra interface fields, extra stack frames, unnecessary variables). Do not fix bugs the description asks to demonstrate.

7. TYPE QUALITY: For TypeScript, use proper type annotations (interfaces, union types with null). Never use "any".
`;

export const TEST_CASES = [
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-python-division-by-zero",
    userInput: {
      description:
        "Python function that calculates an average but crashes when the list is empty due to division by zero. The error is on the line that divides the sum by the length. Annotate the buggy line.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-sql-query-with-join",
    userInput: {
      description:
        "SQL query joining an 'orders' table with a 'customers' table on customer_id, filtering for orders placed in the last 30 days. The query selects customer name, order total, and order date. Annotate the WHERE clause.",
      language: "en",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-javascript-log-output",
    userInput: {
      description:
        "Server access log showing 5 HTTP requests: three successful (200), one not found (404), and one internal server error (500). The 500 error happens on a POST to /api/payments. Format as nginx-style log lines.",
      language: "en",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: Annotation text must be in Brazilian Portuguese.
    `,
    id: "pt-python-config-file",
    userInput: {
      description:
        "Arquivo de configuração YAML de um serviço com variáveis de ambiente. Uma das variáveis (DATABASE_URL) está apontando para localhost em vez do host de produção. Anotar a linha problemática.",
      language: "pt",
    },
  },
  {
    expectations: `${SHARED_EXPECTATIONS}
LANGUAGE REQUIREMENT: Annotation text must be in Latin American Spanish.
    `,
    id: "es-typescript-null-check",
    userInput: {
      description:
        "Función TypeScript que accede a una propiedad anidada de un objeto (user.address.city) sin verificar si 'address' es null. El error se produce cuando el usuario no tiene dirección registrada. Anotar la línea del error.",
      language: "es",
    },
  },
  {
    expectations: SHARED_EXPECTATIONS,
    id: "en-bash-stack-trace",
    userInput: {
      description:
        "Java stack trace showing a NullPointerException in a payment processing service. The trace starts at PaymentService.processRefund (line 142), goes through TransactionManager.execute (line 87), and ends at Main.handleRequest (line 23). Annotate the origin of the exception.",
      language: "en",
    },
  },
];
