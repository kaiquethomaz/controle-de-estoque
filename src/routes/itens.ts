import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export const itensRouter = Router();

function inteiro(valor: unknown): number | null {
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

// Consulta de itens, com busca opcional por nome (?busca=) e categoria (?categoria=)
itensRouter.get("/", async (req: Request, res: Response) => {
  const busca = texto(req.query.busca);
  const categoria = texto(req.query.categoria);

  try {
    const itens = await prisma.item.findMany({
      where: {
        nome: busca ? { contains: busca } : undefined,
        categoria: categoria || undefined,
      },
      orderBy: { nome: "asc" },
    });
    res.json(itens);
  } catch (erro) {
    console.error("Erro ao listar itens:", erro);
    res.status(500).json({ erro: "Erro ao listar itens." });
  }
});

// Cadastro de item novo (com a quantidade inicial registrada como ENTRADA)
itensRouter.post("/", async (req: Request, res: Response) => {
  const nome = texto(req.body?.nome);
  const categoria = texto(req.body?.categoria);
  const quantidade = inteiro(req.body?.quantidade ?? 0);
  const estoqueMinimo = inteiro(req.body?.estoqueMinimo ?? 0);

  if (!nome || !categoria) {
    return res.status(400).json({ erro: "Informe o nome e a categoria." });
  }
  if (quantidade === null || quantidade < 0) {
    return res.status(400).json({ erro: "A quantidade inicial deve ser um número inteiro maior ou igual a 0." });
  }
  if (estoqueMinimo === null || estoqueMinimo < 0) {
    return res.status(400).json({ erro: "O estoque mínimo deve ser um número inteiro maior ou igual a 0." });
  }

  try {
    const item = await prisma.item.create({
      data: {
        nome,
        categoria,
        quantidade,
        estoqueMinimo,
        movimentacoes: quantidade > 0 ? { create: { tipo: "ENTRADA", quantidade } } : undefined,
      },
    });
    res.status(201).json(item);
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
      return res.status(409).json({ erro: `Já existe um item chamado "${nome}". Use a entrada para somar quantidade.` });
    }
    console.error("Erro ao cadastrar item:", erro);
    res.status(500).json({ erro: "Erro ao cadastrar item." });
  }
});

// Entrada de remessa em um item que já existe
itensRouter.post("/:id/entrada", async (req: Request, res: Response) => {
  const id = inteiro(req.params.id);
  const quantidade = inteiro(req.body?.quantidade);

  if (id === null) {
    return res.status(400).json({ erro: "Item inválido." });
  }
  if (quantidade === null || quantidade <= 0) {
    return res.status(400).json({ erro: "A quantidade deve ser um número inteiro maior que 0." });
  }

  try {
    const item = await prisma.item.update({
      where: { id },
      data: {
        quantidade: { increment: quantidade },
        movimentacoes: { create: { tipo: "ENTRADA", quantidade } },
      },
    });
    res.json(item);
  } catch (erro) {
    if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2025") {
      return res.status(404).json({ erro: "Item não encontrado." });
    }
    console.error("Erro ao registrar entrada:", erro);
    res.status(500).json({ erro: "Erro ao registrar entrada." });
  }
});

class ErroSaida extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

// Saída (requisição): o quê, quem retirou e para qual chamado/setor
itensRouter.post("/:id/saida", async (req: Request, res: Response) => {
  const id = inteiro(req.params.id);
  const quantidade = inteiro(req.body?.quantidade);
  const responsavel = texto(req.body?.responsavel);
  const destino = texto(req.body?.destino);

  if (id === null) {
    return res.status(400).json({ erro: "Item inválido." });
  }
  if (quantidade === null || quantidade <= 0) {
    return res.status(400).json({ erro: "A quantidade deve ser um número inteiro maior que 0." });
  }
  if (!responsavel || !destino) {
    return res.status(400).json({ erro: "Informe quem retirou e para qual chamado ou setor." });
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      // Só desconta se ainda houver saldo suficiente (evita estoque negativo)
      const { count } = await tx.item.updateMany({
        where: { id, quantidade: { gte: quantidade } },
        data: { quantidade: { decrement: quantidade } },
      });
      if (count === 0) {
        const atual = await tx.item.findUnique({ where: { id } });
        if (!atual) throw new ErroSaida(404, "Item não encontrado.");
        throw new ErroSaida(400, `Estoque insuficiente: "${atual.nome}" tem só ${atual.quantidade} unidade(s).`);
      }
      await tx.movimentacao.create({ data: { tipo: "SAIDA", quantidade, responsavel, destino, itemId: id } });
      return tx.item.findUniqueOrThrow({ where: { id } });
    });
    res.json(item);
  } catch (erro) {
    if (erro instanceof ErroSaida) {
      return res.status(erro.status).json({ erro: erro.message });
    }
    console.error("Erro ao registrar saída:", erro);
    res.status(500).json({ erro: "Erro ao registrar saída." });
  }
});
