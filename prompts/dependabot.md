---
description: Dependabot Infrastructure & App Architect
---

### **Objetivo**

Configurar o arquivo `.github/dependabot.yml` para automatizar a atualização de dependências, reduzindo o ruído de notificações e protegendo a integrabilidade do projeto.

### **Instruções de Contexto**

1. **Análise de Stack:** Identifique se o projeto utiliza **Angular** via `package.json`.
2. **Proteção Angular:** Se detectado, configure obrigatoriamente um `ignore` para impedir atualizações de **Major Version** (`semver-major`) nos pacotes `@angular/*`.
3. **Frequência:** Configure a verificação como `weekly` (segundas-feiras).
4. **Limite de PRs:** Defina `open-pull-requests-limit: 10`.

### **Configuração de Grupos (Hierarquia)**

Agrupe as dependências usando os seguintes critérios de padrões (`patterns`):

* **Angular Ecosystem:** `@angular/*`, `@schematics/*`, `rxjs`, `zone.js`. (caso o projeto use angular)
* **Serverless:** `serverless`, `@serverless/*`.
* **AWS:** `aws-sdk`, `@aws-sdk/*`.
* **Web Frameworks:** `express`, `@types/express`, `fastify`, `nest`, `cors`, `helmet`.
* **Build & Bundling:** `esbuild`, `tsup`, `vite`, `webpack`, `rollup`.
* **Testing Suite:** `jest`, `vitest`, `cypress`, `playwright`, `@testing-library/*`.
* **Linting & Style:** `eslint`, `prettier`, `@typescript-eslint/*`, `stylelint`, `qodana`.
* **Infrastructure (GitHub Actions):** Adicione um bloco de atualização para `github-actions` agrupando todas as actions em um grupo chamado `actions-updates`.
* **Others:** Crie um grupo final chamado `others` que capture todas as dependências restantes (`*`) para garantir que nada fique isolado em PRs individuais.

### **Template de Saída Esperado**

O output deve ser o código YAML pronto para ser salvo em `.github/dependabot.yml`, seguindo as melhores práticas de indentação e comentários explicativos.