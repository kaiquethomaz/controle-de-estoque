# 📦 Controle de Estoque de TI

Sistema simples para o almoxarifado de TI: entrada de materiais, retirada (quem retirou e para qual chamado/setor) e consulta rápida com alerta de reposição.

## Funcionalidades

- **Entrada:** cadastro de itens (nome, categoria, quantidade, estoque mínimo) e registro de remessas.
- **Saída:** retirada com responsável e chamado/setor; o estoque é atualizado na hora e nunca fica negativo.
- **Consulta:** busca por nome, filtro por categoria, destaque de itens abaixo do mínimo e histórico de movimentações.

## Tecnologias

Node.js, TypeScript, Express, Prisma e SQLite. Front-end em HTML/CSS/JS puro.

## Como rodar

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

Acesse `http://localhost:3000`.
