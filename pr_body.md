✅ Closes

-

✋ publicar antes deste pr

-

⏭️ publicar depois deste pr

-

**Checklist**

- [ ] Fieldnews - enviar broadcast via e-mail com publicação
- [x] 🧪 Testes - testes e2e, integrados e unitários foram feitos

<!-- Init:FieldnewsEmailContent -->

**Contexto**

<!--
Antes de explicar o que foi feito, vamos dar uma contextualizada geral no que já existe hoje dessa funcionalidade.
O que é, como funciona, pra que serve..

Lembre-se que nem todas as pessoas que vão ler nosso e-mail são programadoras, pense que você está explicando pra sua mãe.
-->
Atualmente, o comando `dependabot-rebase` filtra apenas PRs do autor "dependabot". Com a introdução do Renovate em alguns projetos, precisamos que essa ferramenta também suporte PRs do Renovate para realizar o rebase e auto-merge.

**Motivações**

<!--
Explique quais são as motivações para realizar essa contribuição.
Qual problema que resolve, o que acontece atualmente que motivou a gente realizar essa alteração.
-->
O Renovate atua de forma similar ao Dependabot, e queremos unificar o fluxo de atualização de dependências. Permitir que o comando funcione para ambos aumenta a automação e reduz o trabalho manual de rebase nos PRs do Renovate.

**Implementação**

<!--
O que foi feito? Como funciona? Como deve ser usado?
Descreva o que fizemos, quais alternativas avaliamos e qual foi o resultado que chegamos.
-->
Alteramos o filtro de PRs para incluir autores que contenham "renovate" no nome login. Adicionamos uma lógica para verificar qual bot é o autor e enviar o comando de rebase correto (`@dependabot rebase` ou `@renovate rebase`).

**Evoluções**

<!--
Quais são as vantagens, oportunidades da implementação realizada? O que corrigiu? O que melhorou?
-->
Suporte unificado para Dependabot e Renovate.

**Screenshots**

<!--
Gifs são bem-vindos, mas cuidado! Gifs acabam tendo um tamanho grande de arquivo físico que deixa o e-mail lento, outro ponto é que se for pra fazer gifs, faça um gif rápido com zoom no que foi alterado.

Sempre que possível, dê preferencias para imagens
-->
N/A

<!-- End:FieldnewsEmailContent -->
