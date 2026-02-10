✅ Closes

- #closes (none)

**Checklist**

- [ ] Fieldnews - enviar broadcast via e-mail com publicação
- [x] 🧪 Testes - testes e2e, integrados e unitários foram feitos

<!-- Init:FieldnewsEmailContent -->

**Contexto**

Este PR traz melhorias ao comando `pr-create` e limpeza no core de execução, além de adicionar suporte para descrições de PR via arquivo.

**Motivações**

1.  **Flexibilidade**: Permitir o uso de arquivos locais para descrições de PR, facilitando automações ou descrições pré-escritas.
2.  **Robustez**: Evitar erros ao tentar commitar sem alterações pendentes.
3.  **Manutenibilidade**: Remover código morto e padronizar a formatação.

**Implementação**

- **CLI Improvements**:
    - Adicionada a opção `--body-file <path>` ao comando `pr-create`.
    - O comando `pr-create` agora verifica se há alterações para commitar antes de executar `git commit` (utilizando `git status --porcelain`).
    - Escapamento de espaços na mensagem de commit.
- **Cleanup**:
    - Removida lógica de busca de times e membros do GitHub que não estava sendo utilizada no fluxo de criação de PR.
    - Padronização de indentação na query GraphQL.
- **Core**:
    - Pequenos ajustes de lint/formatação no `exec.js`.

**Evoluções**

O fluxo de criação de PR está mais limpo e menos propenso a falhas silenciosas de commit. O suporte a `--body-file` permite integrar a ferramenta em pipelines de CI/CD ou outros workflows automáticos.

**Screenshots**

N/A (Mudança de CLI)

<!-- End:FieldnewsEmailContent -->
