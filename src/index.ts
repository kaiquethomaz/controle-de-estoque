import { Hono } from "hono";
import { prepararBanco } from "./db.js";
import { itensRouter } from "./routes/itens.js";
import { movimentacoesRouter } from "./routes/movimentacoes.js";

// As telas (pasta public) são servidas pela Cloudflare; aqui fica só a API
const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  await prepararBanco(c.env.DB);
  await next();
});

app.route("/api/itens", itensRouter);
app.route("/api/movimentacoes", movimentacoesRouter);

app.notFound((c) => c.json({ erro: "Rota não encontrada." }, 404));

app.onError((erro, c) => {
  console.error("Erro na API:", erro);
  return c.json({ erro: "Erro interno. Tente novamente." }, 500);
});

export default app;
