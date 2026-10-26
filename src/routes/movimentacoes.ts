import { Router, type Request, type Response } from "express";
import { prisma } from "../db.js";

export const movimentacoesRouter = Router();

// Histórico de entradas e saídas, mais recentes primeiro (filtro opcional ?itemId=)
movimentacoesRouter.get("/", async (req: Request, res: Response) => {
  const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
  if (itemId !== undefined && !Number.isInteger(itemId)) {
    return res.status(400).json({ erro: "Item inválido." });
  }

  try {
    const movimentacoes = await prisma.movimentacao.findMany({
      where: { itemId },
      include: { item: { select: { nome: true } } },
      orderBy: { id: "desc" },
      take: 100,
    });
    res.json(movimentacoes);
  } catch (erro) {
    console.error("Erro ao listar movimentações:", erro);
    res.status(500).json({ erro: "Erro ao listar movimentações." });
  }
});
