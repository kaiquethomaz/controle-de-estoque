import { Hono } from "hono";

export const movimentacoesRouter = new Hono<{ Bindings: Env }>();

type Linha = {
  id: number;
  tipo: string;
  quantidade: number;
  responsavel: string | null;
  destino: string | null;
  data: string;
  itemId: number;
  nomeItem: string;
};

// Histórico de entradas e saídas, mais recentes primeiro (filtro opcional ?itemId=)
movimentacoesRouter.get("/", async (c) => {
  const filtro = c.req.query("itemId");
  const itemId = filtro ? Number(filtro) : undefined;
  if (itemId !== undefined && !Number.isInteger(itemId)) {
    return c.json({ erro: "Item inválido." }, 400);
  }

  const where = itemId !== undefined ? "WHERE m.itemId = ?" : "";
  const { results } = await c.env.DB.prepare(
    `SELECT m.*, i.nome AS nomeItem FROM movimentacao m
     JOIN item i ON i.id = m.itemId
     ${where}
     ORDER BY m.id DESC LIMIT 100`
  )
    .bind(...(itemId !== undefined ? [itemId] : []))
    .all<Linha>();

  return c.json(results.map(({ nomeItem, ...m }) => ({ ...m, item: { nome: nomeItem } })));
});
