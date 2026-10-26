import { Hono } from "hono";
import type { Item } from "../db.js";

export const itensRouter = new Hono<{ Bindings: Env }>();

function inteiro(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

type Corpo = Record<string, unknown>;

// Consulta de itens, com busca opcional por nome (?busca=) e categoria (?categoria=)
itensRouter.get("/", async (c) => {
  const busca = texto(c.req.query("busca"));
  const categoria = texto(c.req.query("categoria"));

  const filtros: string[] = [];
  const valores: string[] = [];
  if (busca) {
    filtros.push("nome LIKE ?");
    valores.push(`%${busca}%`);
  }
  if (categoria) {
    filtros.push("categoria = ?");
    valores.push(categoria);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const { results } = await c.env.DB.prepare(`SELECT * FROM item ${where} ORDER BY nome COLLATE NOCASE`)
    .bind(...valores)
    .all<Item>();
  return c.json(results);
});

// Cadastro de item novo (com a quantidade inicial registrada como ENTRADA)
itensRouter.post("/", async (c) => {
  const corpo = await c.req.json<Corpo>().catch((): Corpo => ({}));
  const nome = texto(corpo.nome);
  const categoria = texto(corpo.categoria);
  const quantidade = inteiro(corpo.quantidade ?? 0);
  const estoqueMinimo = inteiro(corpo.estoqueMinimo ?? 0);

  if (!nome || !categoria) {
    return c.json({ erro: "Informe o nome e a categoria." }, 400);
  }
  if (quantidade === null || quantidade < 0) {
    return c.json({ erro: "A quantidade inicial deve ser um número inteiro maior ou igual a 0." }, 400);
  }
  if (estoqueMinimo === null || estoqueMinimo < 0) {
    return c.json({ erro: "O estoque mínimo deve ser um número inteiro maior ou igual a 0." }, 400);
  }

  const db = c.env.DB;
  try {
    const [criado] = await db.batch([
      db.prepare("INSERT INTO item (nome, categoria, quantidade, estoqueMinimo) VALUES (?, ?, ?, ?) RETURNING *")
        .bind(nome, categoria, quantidade, estoqueMinimo),
      db.prepare("INSERT INTO movimentacao (tipo, quantidade, itemId) SELECT 'ENTRADA', ?1, last_insert_rowid() WHERE ?1 > 0")
        .bind(quantidade),
    ]);
    return c.json(criado.results[0] as Item, 201);
  } catch (erro) {
    if (String(erro).includes("UNIQUE constraint failed")) {
      return c.json({ erro: `Já existe um item chamado "${nome}". Use a entrada para somar quantidade.` }, 409);
    }
    throw erro;
  }
});

// Entrada de remessa em um item que já existe
itensRouter.post("/:id/entrada", async (c) => {
  const id = inteiro(c.req.param("id"));
  const corpo = await c.req.json<Corpo>().catch((): Corpo => ({}));
  const quantidade = inteiro(corpo.quantidade);

  if (id === null) {
    return c.json({ erro: "Item inválido." }, 400);
  }
  if (quantidade === null || quantidade <= 0) {
    return c.json({ erro: "A quantidade deve ser um número inteiro maior que 0." }, 400);
  }

  const db = c.env.DB;
  const [atualizado] = await db.batch([
    db.prepare("UPDATE item SET quantidade = quantidade + ?1 WHERE id = ?2 RETURNING *").bind(quantidade, id),
    db.prepare("INSERT INTO movimentacao (tipo, quantidade, itemId) SELECT 'ENTRADA', ?1, id FROM item WHERE id = ?2")
      .bind(quantidade, id),
  ]);

  const item = atualizado.results[0] as Item | undefined;
  if (!item) {
    return c.json({ erro: "Item não encontrado." }, 404);
  }
  return c.json(item);
});

// Saída (requisição): o quê, quem retirou e para qual chamado/setor
itensRouter.post("/:id/saida", async (c) => {
  const id = inteiro(c.req.param("id"));
  const corpo = await c.req.json<Corpo>().catch((): Corpo => ({}));
  const quantidade = inteiro(corpo.quantidade);
  const responsavel = texto(corpo.responsavel);
  const destino = texto(corpo.destino);

  if (id === null) {
    return c.json({ erro: "Item inválido." }, 400);
  }
  if (quantidade === null || quantidade <= 0) {
    return c.json({ erro: "A quantidade deve ser um número inteiro maior que 0." }, 400);
  }
  if (!responsavel || !destino) {
    return c.json({ erro: "Informe quem retirou e para qual chamado ou setor." }, 400);
  }

  // Só desconta se ainda houver saldo suficiente (evita estoque negativo);
  // o histórico só é gravado se o desconto aconteceu (changes() = 1)
  const db = c.env.DB;
  const [atualizado] = await db.batch([
    db.prepare("UPDATE item SET quantidade = quantidade - ?1 WHERE id = ?2 AND quantidade >= ?1 RETURNING *")
      .bind(quantidade, id),
    db.prepare(
      `INSERT INTO movimentacao (tipo, quantidade, responsavel, destino, itemId)
       SELECT 'SAIDA', ?1, ?2, ?3, ?4 WHERE changes() = 1`
    ).bind(quantidade, responsavel, destino, id),
  ]);

  const item = atualizado.results[0] as Item | undefined;
  if (item) {
    return c.json(item);
  }

  const atual = await db.prepare("SELECT nome, quantidade FROM item WHERE id = ?").bind(id).first<Item>();
  if (!atual) {
    return c.json({ erro: "Item não encontrado." }, 404);
  }
  return c.json({ erro: `Estoque insuficiente: "${atual.nome}" tem só ${atual.quantidade} unidade(s).` }, 400);
});
