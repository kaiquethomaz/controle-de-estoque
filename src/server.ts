import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { itensRouter } from "./routes/itens.js";
import { movimentacoesRouter } from "./routes/movimentacoes.js";

const app = express();
const porta = Number(process.env.PORT) || 3000;
const pastaPublica = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

app.use(express.json());
app.use(express.static(pastaPublica));
app.use("/api/itens", itensRouter);
app.use("/api/movimentacoes", movimentacoesRouter);

const servidor = app.listen(porta, () => {
  console.log(`Controle de estoque rodando em http://localhost:${porta}`);
});

servidor.on("error", (erro: NodeJS.ErrnoException) => {
  if (erro.code === "EADDRINUSE") {
    console.error(`A porta ${porta} já está em uso. Feche o outro servidor ou mude PORT no arquivo .env.`);
    process.exit(1);
  }
  throw erro;
});
