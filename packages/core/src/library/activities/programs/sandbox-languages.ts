import "server-only";
import { MS_PER_HOUR, MS_PER_SECOND } from "@zoonk/utils/date";
import { type SandboxLanguage } from "./program-languages";

type SandboxToolchain = {
  compile?: readonly string[];
  errorLine: RegExp;
  install: string;
  run: readonly string[];
  smoke: { hello: string; invalid: string };
  files?: Record<string, string>;
  vcpus: 1 | 2;
};

const swiftArchive =
  "https://download.swift.org/swift-6.4.3-release/ubuntu2604/swift-6.4.3-RELEASE/swift-6.4.3-RELEASE-ubuntu26.04.tar.gz";

const kotlinArchive =
  "https://github.com/JetBrains/kotlin/releases/download/v2.4.0/kotlin-compiler-2.4.0.zip";

function apt(packages: string): string {
  return `apt-get -q update && DEBIAN_FRONTEND=noninteractive apt-get -q install -y --no-install-recommends ${packages} && rm -rf /var/lib/apt/lists/*`;
}

const nativeRun = ["./main"];
const defaultResources = { vcpus: 1 } as const;

export const SANDBOX_TOOLCHAINS: Record<SandboxLanguage, SandboxToolchain> = {
  cpp: {
    ...defaultResources,
    compile: ["g++", "-std=c++23", "-o", "main", "main.cpp"],
    errorLine: /main\.cpp:(?<line>\d+):/u,
    install: apt("g++"),
    run: nativeRun,
    smoke: {
      hello: '#include <iostream>\nint main() { std::cout << "hello\\n"; }',
      invalid: "int main() { missing; }",
    },
  },
  csharp: {
    ...defaultResources,
    compile: [
      "dotnet",
      "build",
      "main.csproj",
      "--disable-build-servers",
      "-o",
      "out",
      "--nologo",
      "-v",
      "q",
    ],
    errorLine: /Program\.cs\((?<line>\d+),\d+\)/u,
    files: {
      "main.csproj":
        '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><NuGetAudit>false</NuGetAudit></PropertyGroup></Project>',
    },
    install: apt("dotnet-sdk-10.0"),
    run: ["dotnet", "out/main.dll"],
    smoke: { hello: 'Console.WriteLine("hello");', invalid: "Missing();" },
    vcpus: 2,
  },
  go: {
    ...defaultResources,
    compile: ["go", "build", "-o", "main", "main.go"],
    errorLine: /main\.go:(?<line>\d+):/u,
    install: apt("golang-go"),
    run: nativeRun,
    smoke: {
      hello: 'package main\nimport "fmt"\nfunc main() { fmt.Println("hello") }',
      invalid: "package main\nfunc main() { missing() }",
    },
  },
  java: {
    ...defaultResources,
    compile: ["javac", "Main.java"],
    errorLine: /(?:Main\.java:)(?<line>\d+)/u,
    install: apt("openjdk-25-jdk-headless"),
    run: ["java", "-XX:TieredStopAtLevel=1", "Main"],
    smoke: {
      hello:
        'class Main { public static void main(String[] args) { System.out.println("hello"); } }',
      invalid: "class Main { public static void main(String[] args) { missing(); } }",
    },
  },
  kotlin: {
    ...defaultResources,
    compile: ["/opt/kotlinc/bin/kotlinc", "Main.kt", "-d", "main.jar"],
    errorLine: /Main\.kt:(?<line>\d+):/u,
    install: `${apt("openjdk-25-jdk-headless unzip")} && curl -fsSL ${kotlinArchive} -o kotlin.zip && echo 'ba1b9e6eb6ddc3275079224f2e9ea4a2b02eef7d59ce2d38404f04b22613c20a  kotlin.zip' | sha256sum -c - && unzip -q -o kotlin.zip -d /opt && rm kotlin.zip`,
    run: ["/opt/kotlinc/bin/kotlin", "-classpath", "main.jar", "MainKt"],
    smoke: { hello: 'fun main() { println("hello") }', invalid: "fun main() { missing() }" },
    vcpus: 2,
  },
  php: {
    ...defaultResources,
    errorLine: /main\.php(?::| on line )(?<line>\d+)/u,
    install: apt("php-cli"),
    run: ["php", "-n", "-d", "display_errors=stderr", "-d", "log_errors=0", "main.php"],
    smoke: { hello: String.raw`<?php echo "hello\n";`, invalid: "<?php echo ;" },
  },
  ruby: {
    ...defaultResources,
    errorLine: /main\.rb:(?<line>\d+)/u,
    install: apt("ruby"),
    run: ["ruby", "main.rb"],
    smoke: { hello: 'puts "hello"', invalid: "def" },
  },
  rust: {
    ...defaultResources,
    compile: ["rustc", "-o", "main", "main.rs"],
    errorLine: /main\.rs:(?<line>\d+):/u,
    install: apt("rustc gcc"),
    run: nativeRun,
    smoke: { hello: 'fn main() { println!("hello"); }', invalid: "fn main() { missing(); }" },
  },
  swift: {
    ...defaultResources,
    compile: ["/opt/swift/usr/bin/swiftc", "-o", "main", "main.swift"],
    errorLine: /main\.swift:(?<line>\d+):/u,
    install: `${apt("binutils binutils-gold libc6-dev libcurl4-openssl-dev libedit2 libgcc-15-dev libpython3-dev libsqlite3-0 libstdc++-15-dev libxml2-dev libncurses-dev libz3-dev pkg-config zlib1g-dev")} && mkdir -p /opt/swift && curl -fsSL ${swiftArchive} -o swift.tar.gz && echo '0e408a922a6f00955cbc61ef7a1c40cee3bdbbecb7d50b98ad9aa3b943045613  swift.tar.gz' | sha256sum -c - && tar -xzf swift.tar.gz -C /opt/swift --strip-components=1 && rm swift.tar.gz`,
    run: nativeRun,
    smoke: { hello: 'print("hello")', invalid: "missing()" },
  },
  typescript: {
    ...defaultResources,
    compile: [
      "node",
      "/opt/typescript/node_modules/typescript/bin/tsc",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "--noEmitOnError",
      "main.ts",
    ],
    errorLine: /main\.ts\((?<line>\d+),\d+\)/u,
    install: "npm install --prefix /opt/typescript --no-audit --no-fund typescript@6.0.3",
    run: ["node", "main.js"],
    smoke: {
      hello: 'const greeting: string = "hello"; console.log(greeting);',
      invalid: 'const x: number = "text";',
    },
  },
};

export const SANDBOX_IDLE_MS = 120_000;
export const SANDBOX_FORK_MS = 5000;
export const SANDBOX_RUN_SECONDS = 3;
const SANDBOX_OVERHEAD_MS = 12_000;
const COMPILE_SECONDS = { 1: 10, 2: 20 } as const;
const CPU_MICROS_PER_HOUR = 128_000;
const MEMORY_MICROS_PER_GB_HOUR = 21_200;
const GB_PER_VCPU = 2;
const CREATION_MICROS = 0.6;

export function compileSeconds(language: SandboxLanguage) {
  const toolchain = SANDBOX_TOOLCHAINS[language];
  return toolchain.compile ? COMPILE_SECONDS[toolchain.vcpus] : 0;
}

export function runBudgetMs(language: SandboxLanguage) {
  return (compileSeconds(language) + SANDBOX_RUN_SECONDS) * MS_PER_SECOND + SANDBOX_OVERHEAD_MS;
}

export function sandboxCostMicros(language: SandboxLanguage) {
  const { vcpus } = SANDBOX_TOOLCHAINS[language];
  const busyMs = runBudgetMs(language) + SANDBOX_FORK_MS;
  const cpuMicros = (busyMs / MS_PER_HOUR) * CPU_MICROS_PER_HOUR * vcpus;

  const memoryMicros =
    ((busyMs + SANDBOX_IDLE_MS) / MS_PER_HOUR) * MEMORY_MICROS_PER_GB_HOUR * GB_PER_VCPU * vcpus;

  return Math.ceil(cpuMicros + memoryMicros + CREATION_MICROS);
}
