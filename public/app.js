const aviso = document.getElementById("aviso");
const formCadastro = document.getElementById("form-cadastro");
const formEntrada = document.getElementById("form-entrada");
const formSaida = document.getElementById("form-saida");
const listaItens = document.getElementById("lista-itens");
const listaHistorico = document.getElementById("lista-historico");
const listaCategorias = document.getElementById("categorias");
const campoBusca = document.getElementById("busca");
const filtroCategoria = document.getElementById("filtro-categoria");
const totalItens = document.getElementById("total-itens");
const totalRepor = document.getElementById("total-repor");

const precisaRepor = (item) => item.quantidade <= item.estoqueMinimo;

function mostrarAviso(mensagem, tipo) {
  aviso.textContent = mensagem;
  aviso.className = `aviso ${tipo}`;
  aviso.hidden = false;
  clearTimeout(mostrarAviso.timer);
  mostrarAviso.timer = setTimeout(() => (aviso.hidden = true), 4000);
}

async function api(url, opcoes) {
  const resposta = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opcoes,
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Erro inesperado.");
  return dados;
}

function linha(...celulas) {
  const tr = document.createElement("tr");
  celulas.forEach(([valor, classe]) => {
    const td = document.createElement("td");
    td.textContent = valor;
    if (classe) td.className = classe;
    tr.appendChild(td);
  });
  return tr;
}

function situacao(item) {
  if (item.quantidade === 0) return ["Esgotado", "status esgotado"];
  if (precisaRepor(item)) return ["Repor", "status repor"];
  return ["OK", "status ok"];
}

function trocarOpcoes(select, opcoes) {
  const anterior = select.value;
  select.replaceChildren(...opcoes);
  if ([...select.options].some((o) => o.value === anterior)) select.value = anterior;
}

// Painel: lista filtrada pela busca e categoria
async function carregarPainel() {
  const params = new URLSearchParams({ busca: campoBusca.value, categoria: filtroCategoria.value });
  try {
    const itens = await api(`/api/itens?${params}`);
    listaItens.replaceChildren(
      ...(itens.length
        ? itens.map((i) => {
            const tr = linha([i.nome], [i.categoria], [i.quantidade, "num"], [i.estoqueMinimo, "num"], situacao(i));
            if (precisaRepor(i)) tr.className = "baixo";
            return tr;
          })
        : [linha(["Nenhum item encontrado.", "vazio"])])
    );
    listaItens.querySelector(".vazio")?.setAttribute("colspan", "5");
  } catch (erro) {
    mostrarAviso(erro.message, "erro");
  }
}

// Lista completa: alimenta os selects, categorias e contadores
async function carregarTudo() {
  try {
    const itens = await api("/api/itens");

    const opcoes = () => itens.map((i) => new Option(`${i.nome} (${i.quantidade} em estoque)`, i.id));
    trocarOpcoes(formEntrada.elements.itemId, opcoes());
    trocarOpcoes(formSaida.elements.itemId, opcoes());

    const categorias = [...new Set(itens.map((i) => i.categoria))].sort();
    listaCategorias.replaceChildren(...categorias.map((c) => new Option(c)));
    trocarOpcoes(filtroCategoria, [new Option("Todas as categorias", ""), ...categorias.map((c) => new Option(c))]);

    const repor = itens.filter(precisaRepor).length;
    totalItens.textContent = `${itens.length} ${itens.length === 1 ? "item" : "itens"}`;
    totalRepor.textContent = `⚠️ ${repor} ${repor === 1 ? "item" : "itens"} para repor`;
    totalRepor.hidden = repor === 0;
  } catch (erro) {
    mostrarAviso(erro.message, "erro");
  }
}

async function carregarHistorico() {
  try {
    const movimentacoes = await api("/api/movimentacoes");
    listaHistorico.replaceChildren(
      ...(movimentacoes.length
        ? movimentacoes.map((m) =>
            linha(
              [new Date(m.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })],
              m.tipo === "SAIDA" ? ["Saída", "status repor"] : ["Entrada", "status ok"],
              [m.item.nome],
              [m.quantidade, "num"],
              [m.responsavel ?? "—"],
              [m.destino ?? "—"]
            )
          )
        : [linha(["Nenhuma movimentação ainda.", "vazio"])])
    );
    listaHistorico.querySelector(".vazio")?.setAttribute("colspan", "6");
  } catch (erro) {
    mostrarAviso(erro.message, "erro");
  }
}

function atualizarTela() {
  return Promise.all([carregarTudo(), carregarPainel(), carregarHistorico()]);
}

campoBusca.addEventListener("input", () => {
  clearTimeout(campoBusca.timer);
  campoBusca.timer = setTimeout(carregarPainel, 250);
});
filtroCategoria.addEventListener("change", carregarPainel);

formCadastro.addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(formCadastro));
  try {
    const item = await api("/api/itens", { method: "POST", body: JSON.stringify(dados) });
    mostrarAviso(`"${item.nome}" cadastrado com ${item.quantidade} unidade(s).`, "ok");
    formCadastro.reset();
    atualizarTela();
  } catch (erro) {
    mostrarAviso(erro.message, "erro");
  }
});

formEntrada.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { itemId, quantidade } = Object.fromEntries(new FormData(formEntrada));
  try {
    const item = await api(`/api/itens/${itemId}/entrada`, {
      method: "POST",
      body: JSON.stringify({ quantidade }),
    });
    mostrarAviso(`Entrada registrada. "${item.nome}" agora tem ${item.quantidade} unidade(s).`, "ok");
    formEntrada.elements.quantidade.value = "";
    atualizarTela();
  } catch (erro) {
    mostrarAviso(erro.message, "erro");
  }
});

formSaida.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { itemId, ...dados } = Object.fromEntries(new FormData(formSaida));
  try {
    const item = await api(`/api/itens/${itemId}/saida`, { method: "POST", body: JSON.stringify(dados) });
    const alerta = precisaRepor(item) ? " ⚠️ Atenção: abaixo do mínimo, hora de repor." : "";
    mostrarAviso(`Retirada registrada. "${item.nome}" agora tem ${item.quantidade} unidade(s).${alerta}`, "ok");
    formSaida.elements.quantidade.value = "1";
    formSaida.elements.destino.value = "";
    atualizarTela();
  } catch (erro) {
    mostrarAviso(erro.message, "erro");
  }
});

atualizarTela();
