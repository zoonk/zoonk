const SHARED_EXPECTATIONS = `
EVALUATION CRITERIA:

1. CODE CORRECTNESS: The code must be syntactically correct and follow the conventions of the specified programming language. It must demonstrate the concept described in the VISUAL_DESCRIPTION.

2. LANGUAGE FIELD: The "language" field in the output must be the programming language (e.g., "python", "javascript"), NOT the human language from the LANGUAGE input.

3. ANNOTATIONS: If key lines or errors are described, annotations should highlight them with 1-based line numbers. Annotation text should be in the specified human LANGUAGE.

4. CONCISENESS: Code should be max 500 chars, focused on the described concept. Do not add boilerplate or imports unless essential to the demonstration.

5. LANGUAGE: Annotation text must be in the specified human language. Code identifiers follow the programming language's conventions (typically English).
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
