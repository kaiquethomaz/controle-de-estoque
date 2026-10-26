// Cria as tabelas na primeira requisição (não precisa rodar migração à parte)
const AGORA = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

const TABELAS = [
  `CREATE TABLE IF NOT EXISTS item (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
    estoqueMinimo INTEGER NOT NULL DEFAULT 0,
    criadoEm TEXT NOT NULL DEFAULT ${AGORA}
  )`,
  `CREATE TABLE IF NOT EXISTS movimentacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    quantidade INTEGER NOT NULL,
    responsavel TEXT,
    destino TEXT,
    data TEXT NOT NULL DEFAULT ${AGORA},
    itemId INTEGER NOT NULL REFERENCES item(id)
  )`,
  "CREATE INDEX IF NOT EXISTS movimentacao_itemId ON movimentacao(itemId)",
];

let pronto: Promise<unknown> | null = null;

export function prepararBanco(db: D1Database): Promise<unknown> {
  pronto ??= db.batch(TABELAS.map((sql) => db.prepare(sql))).catch((erro) => {
    pronto = null;
    throw erro;
  });
  return pronto;
}

export type Item = {
  id: number;
  nome: string;
  categoria: string;
  quantidade: number;
  estoqueMinimo: number;
  criadoEm: string;
};
