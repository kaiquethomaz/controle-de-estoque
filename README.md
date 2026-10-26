# 📦 Controle de Estoque de TI

Sistema simples para o almoxarifado de TI: entrada de materiais, retirada (quem retirou e para qual chamado/setor) e consulta rápida com alerta de reposição.

## Funcionalidades

- **Entrada:** cadastro de itens (nome, categoria, quantidade, estoque mínimo) e registro de remessas.
- **Saída:** retirada com responsável e chamado/setor; o estoque é atualizado na hora e nunca fica negativo.
- **Consulta:** busca por nome, filtro por categoria, destaque de itens abaixo do mínimo e histórico de movimentações.

## Tecnologias

Cloudflare Workers + D1 (SQLite), Hono e TypeScript. Front-end em HTML/CSS/JS puro (pasta `public`).
As tabelas são criadas automaticamente na primeira requisição.

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000` (o D1 é simulado localmente na pasta `.wrangler`).

## Publicar na Cloudflare

1. No painel: **Storage & Databases → D1 → Create**, com o nome `estoque`.
2. Copie o **Database ID** para `database_id` em `wrangler.jsonc` e envie para o GitHub.
3. **Workers & Pages → Create application → Import a repository** e escolha este repositório (o deploy usa `npx wrangler deploy`).
