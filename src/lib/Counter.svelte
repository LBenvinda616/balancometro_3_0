<script lang="ts">
  import * as XLSX from "xlsx";

  type Linha = {
    id: string | number;
    descricao: string;
    quantidade: number;
    preco: number;
    total: number;
  };

  let linhas: Linha[] = $state([]);
  let arquivoNome = $state("");
  let mensagemErro = $state("");
  let carregando = $state(false);
  type Resumo = { totalProdutos: number; somaTotal: number };
  type Filtros = {
    id?: string;
    descricao?: string;
    precoMin?: string;
    precoMax?: string;
  };
  const props = $props<{
    edicaoAtiva: boolean;
    ficheiro: File | null;
    filtros?: Filtros;
    onResumo?: (r: Resumo) => void;
    exportar?: number; // timestamp to trigger export
  }>();

  const parseNumero = (valor: unknown): number => {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;
    if (typeof valor === "string") {
      // Remove espaços e quaisquer símbolos não numéricos (ex.: €)
      const semEspacos = valor.trim().replace(/\s+/g, "");
      // Mantém apenas dígitos, vírgulas, pontos e sinal negativo
      const apenasNumeros = semEspacos.replace(/[^0-9,.-]/g, "");

      // Se houver vírgula, trata-a como separador decimal e remove pontos (milhares)
      const normalizado = apenasNumeros.includes(",")
        ? apenasNumeros.replace(/\./g, "").replace(",", ".")
        : apenasNumeros;

      const numero = Number(normalizado);
      return Number.isFinite(numero) ? numero : NaN;
    }
    return NaN;
  };

  const importarFicheiro = async (file: File) => {
    mensagemErro = "";

    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      mensagemErro = "Use um ficheiro .xlsx com as colunas A-E.";
      return;
    }

    try {
      carregando = true;
      arquivoNome = file.name;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const primeiraAba = workbook.SheetNames[0];
      const sheet = workbook.Sheets[primeiraAba];
      const matriz = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
        header: 1,
        defval: "",
        raw: true,
      });

      if (matriz.length <= 1) {
        throw new Error(
          "Ficheiro sem dados. Garanta cabeçalho e pelo menos uma linha."
        );
      }

      const [, ...dados] = matriz;

      const convertidas: Linha[] = dados
        .map((linha, idx) => {
          const [id, descricao, quantidadeBruta, precoBruto, totalBruto] =
            linha;

          if (idx < 3) {
            console.log("[Import debug] raw:", {
              id,
              descricao,
              quantidadeBruta,
              precoBruto,
              totalBruto,
              types: {
                id: typeof id,
                descricao: typeof descricao,
                quantidadeBruta: typeof quantidadeBruta,
                precoBruto: typeof precoBruto,
                totalBruto: typeof totalBruto,
              },
            });
          }

          // Ignora linhas completamente vazias
          if (
            [id, descricao, quantidadeBruta, precoBruto, totalBruto].every(
              (c) => c === "" || c === undefined
            )
          ) {
            return null;
          }

          const quantidade = parseNumero(quantidadeBruta);
          const preco = parseNumero(precoBruto);
          const totalValor = parseNumero(totalBruto);

          if (idx < 3) {
            console.log("[Import debug] parsed:", {
              quantidade,
              preco,
              totalValor,
            });
          }

          return {
            id: id ?? "",
            descricao: (descricao ?? "").toString(),
            quantidade: Number.isFinite(quantidade) ? quantidade : 0,
            preco: Number.isFinite(preco) ? preco : 0,
            total: Number.isFinite(totalValor) ? totalValor : 0,
          };
        })
        .filter(Boolean) as Linha[];

      linhas = convertidas;
      notificarResumo();
    } catch (error) {
      console.error(error);
      mensagemErro =
        "Não foi possível ler o ficheiro. Confirme o formato e tente novamente.";
      linhas = [];
      arquivoNome = "";
      notificarResumo();
    } finally {
      carregando = false;
    }
  };

  $effect(() => {
    if (props.ficheiro && props.ficheiro.name !== arquivoNome) {
      importarFicheiro(props.ficheiro);
    }
  });

  let ultimoExportTrigger = 0;

  $effect(() => {
    if (props.exportar && props.exportar !== ultimoExportTrigger) {
      ultimoExportTrigger = props.exportar;
      void exportarXLSX();
    }
  });

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(valor);

  let sortKey: keyof Linha = $state("id");
  let sortAsc: boolean = $state(true);
  let linhasFiltradas: Linha[] = $state([]);
  let linhaSeleccionada: number | null = $state(null);

  const sortBy = (key: keyof Linha) => {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }

    const cmp = (a: Linha, b: Linha) => {
      const dir = sortAsc ? 1 : -1;
      const va = a[key];
      const vb = b[key];
      if (key === "descricao" || key === "id") {
        const sa = (va ?? "").toString().toLocaleLowerCase();
        const sb = (vb ?? "").toString().toLocaleLowerCase();
        if (sa < sb) return -1 * dir;
        if (sa > sb) return 1 * dir;
        return 0;
      }
      const na = Number(va) || 0;
      const nb = Number(vb) || 0;
      return (na - nb) * dir;
    };

    linhas = [...linhas].sort(cmp);
    aplicarFiltros();
  };

  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const levenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matriz: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matriz[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matriz[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matriz[i][j] = matriz[i - 1][j - 1];
        } else {
          matriz[i][j] = Math.min(
            matriz[i - 1][j - 1] + 1, // substituição
            matriz[i][j - 1] + 1, // inserção
            matriz[i - 1][j] + 1 // remoção
          );
        }
      }
    }
    return matriz[b.length][a.length];
  };

  const fuzzyInclui = (texto: string, consulta: string) => {
    const t = normalizar(texto);
    const q = normalizar(consulta);

    // 1. Substring rápida
    if (t.includes(q)) return true;

    // 2. Subsequência: todos os caracteres de q aparecem em ordem em t
    let i = 0;
    for (const ch of t) {
      if (ch === q[i]) i++;
      if (i === q.length) return true;
    }

    // 3. Levenshtein para palavras individuais (misspellings)
    const palavrasTexto = t.split(/\s+/);
    const palavrasConsulta = q.split(/\s+/);

    for (const pConsulta of palavrasConsulta) {
      if (pConsulta.length < 3) continue; // skip palavras muito curtas

      let encontrada = false;
      for (const pTexto of palavrasTexto) {
        const dist = levenshtein(pTexto, pConsulta);
        const threshold = Math.max(1, Math.floor(pConsulta.length * 0.3)); // 30% de erro tolerado
        if (dist <= threshold) {
          encontrada = true;
          break;
        }
      }
      if (!encontrada) return false;
    }

    return palavrasConsulta.length > 0;
  };

  const aplicarFiltros = () => {
    const rawId = props.filtros?.id as unknown;
    const rawDesc = props.filtros?.descricao as unknown;
    const rawMin = props.filtros?.precoMin as unknown;
    const rawMax = props.filtros?.precoMax as unknown;

    const idQ =
      typeof rawId === "string"
        ? rawId.trim()
        : rawId != null
          ? String(rawId)
          : "";
    const descQ =
      typeof rawDesc === "string"
        ? rawDesc.trim()
        : rawDesc != null
          ? String(rawDesc)
          : "";

    const min =
      rawMin == null || (typeof rawMin === "string" && rawMin.trim() === "")
        ? NaN
        : parseNumero(rawMin as any);
    const max =
      rawMax == null || (typeof rawMax === "string" && rawMax.trim() === "")
        ? NaN
        : parseNumero(rawMax as any);
    linhasFiltradas = linhas.filter((l) => {
      // ID
      if (idQ) {
        const idStr = (l.id ?? "").toString();
        if (!normalizar(idStr).includes(normalizar(idQ))) return false;
      }
      // Descrição fuzzy
      if (descQ) {
        if (!fuzzyInclui(l.descricao ?? "", descQ)) return false;
      }
      // Preço min
      if (!Number.isNaN(min) && l.preco < min) return false;
      // Preço max
      if (!Number.isNaN(max) && l.preco > max) return false;

      return true;
    });
  };

  $effect(() => {
    aplicarFiltros();
  });

  const onQuantidadeChange = (idx: number, valor: string) => {
    const n = parseNumero(valor);
    const quantidade = Number.isFinite(n) && n >= 0 ? n : 0;
    linhas[idx].quantidade = quantidade;
    const precoAtual = Number.isFinite(linhas[idx].preco)
      ? linhas[idx].preco
      : 0;
    linhas[idx].total = +(quantidade * precoAtual).toFixed(2);
    notificarResumo();
  };

  const onPrecoChange = (idx: number, valor: string) => {
    const n = parseNumero(valor);
    const preco = Number.isFinite(n) && n >= 0 ? n : 0;
    linhas[idx].preco = preco;
    const quantidadeAtual = Number.isFinite(linhas[idx].quantidade)
      ? linhas[idx].quantidade
      : 0;
    linhas[idx].total = +(quantidadeAtual * preco).toFixed(2);
    notificarResumo();
  };

  const calcularResumo = (): Resumo => {
    const totalProdutos = linhas.length;
    const somaTotal = linhas.reduce(
      (acc, l) => acc + (Number.isFinite(l.total) ? l.total : 0),
      0
    );
    return { totalProdutos, somaTotal };
  };

  const notificarResumo = () => {
    props.onResumo?.(calcularResumo());
  };

  const exportarXLSX = async () => {
    if (linhas.length === 0) {
      mensagemErro = "Não há dados para exportar.";
      return;
    }
    try {
      const dados = [
        ["ID", "Descrição", "Quantidade", "Preço", "Total"],
        ...linhas.map((l) => [
          l.id,
          l.descricao,
          l.quantidade,
          l.preco,
          l.total,
        ]),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(dados);
      XLSX.utils.book_append_sheet(wb, ws, "Dados");
      const agora = new Date();
      const timestamp = agora.toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const nomeFicheiro = `balancometro_${timestamp}.xlsx`;

      // Use Tauri dialog and fs for native save
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const caminho = await save({
        title: "Guardar ficheiro Excel",
        defaultPath: nomeFicheiro,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });

      if (!caminho) {
        mensagemErro = "Exportação cancelada.";
        return;
      }

      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      await writeFile(caminho, buffer);
      mensagemErro = "";
    } catch (error) {
      console.error(error);
      mensagemErro = "Erro ao exportar ficheiro.";
    }
  };
</script>

<section class="importador">
  {#if arquivoNome}
    <p class="resumo">Ficheiro: {arquivoNome} · Linhas: {linhas.length}</p>
  {/if}
  {#if mensagemErro}
    <p class="erro">{mensagemErro}</p>
  {/if}

  {#if linhas.length === 0 && !mensagemErro}
    <div class="placeholder">
      <p>Importe uma folha para visualizar os itens.</p>
    </div>
  {:else if linhas.length > 0}
    <div class="tabela-wrapper">
      <table>
        <thead>
          <tr>
            <th>
              <button class="th-sort" onclick={() => sortBy("id")}>
                ID {#if sortKey === "id"}<span
                    class="th-caret"
                    data-asc={sortAsc}>▾</span
                  >{/if}
              </button>
            </th>
            <th>
              <button class="th-sort" onclick={() => sortBy("descricao")}>
                Descrição {#if sortKey === "descricao"}<span
                    class="th-caret"
                    data-asc={sortAsc}>▾</span
                  >{/if}
              </button>
            </th>
            <th>
              <button class="th-sort" onclick={() => sortBy("quantidade")}>
                Quantidade {#if sortKey === "quantidade"}<span
                    class="th-caret"
                    data-asc={sortAsc}>▾</span
                  >{/if}
              </button>
            </th>
            <th>
              <button class="th-sort" onclick={() => sortBy("preco")}>
                Preço {#if sortKey === "preco"}<span
                    class="th-caret"
                    data-asc={sortAsc}>▾</span
                  >{/if}
              </button>
            </th>
            <th>
              <button class="th-sort" onclick={() => sortBy("total")}>
                Total {#if sortKey === "total"}<span
                    class="th-caret"
                    data-asc={sortAsc}>▾</span
                  >{/if}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {#each linhasFiltradas as linha, idx}
            <tr
              class:selecionada={linhaSeleccionada === idx}
              onclick={() => (linhaSeleccionada = idx)}
            >
              <td data-label="ID">{linha.id}</td>
              <td data-label="Descrição">{linha.descricao}</td>
              <td data-label="Quantidade">
                {#if props.edicaoAtiva}
                  <input
                    class="celula-input"
                    type="number"
                    min="0"
                    step="1"
                    value={linha.quantidade}
                    oninput={(e) =>
                      onQuantidadeChange(
                        idx,
                        (e.target as HTMLInputElement).value
                      )}
                  />
                {:else}
                  {linha.quantidade}
                {/if}
              </td>
              <td data-label="Preço">
                {#if props.edicaoAtiva}
                  <input
                    class="celula-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={linha.preco}
                    oninput={(e) =>
                      onPrecoChange(idx, (e.target as HTMLInputElement).value)}
                  />
                {:else}
                  {formatarMoeda(linha.preco)}
                {/if}
              </td>
              <td data-label="Total">{formatarMoeda(linha.total)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

<style>
  .importador {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .resumo {
    margin: 0;
    color: #4b5563;
  }

  .erro {
    margin: 0;
    color: #b91c1c;
    font-weight: 600;
  }

  .placeholder {
    padding: 1.25rem;
    border: 1px dashed #cdd6e6;
    border-radius: 12px;
    color: #607094;
    background: #f9fbff;
    flex: 1;
  }

  .tabela-wrapper {
    overflow: auto;
    border: 1px solid #e5e9f2;
    border-radius: 12px;
    background: #ffffff;
    flex: 1;
    min-height: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 520px;
  }

  thead {
    background: #f1f5f9;
  }

  th,
  td {
    padding: 0.75rem 0.9rem;
    text-align: left;
    border-bottom: 1px solid #e5e9f2;
    color: #1f2937;
  }

  th {
    font-size: 0.95rem;
    color: #475569;
  }

  .th-sort {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font: inherit;
    color: inherit;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .th-caret {
    display: inline-block;
    transform: rotate(180deg);
    opacity: 0.6;
  }

  .th-caret[data-asc="true"] {
    transform: rotate(0deg);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr {
    cursor: pointer;
    transition: background 120ms ease;
  }

  tbody tr:hover {
    background: #f5f7fb;
  }

  tbody tr.selecionada {
    background: #dbeafe;
    font-weight: 600;
  }

  tbody tr.selecionada:hover {
    background: #bfdbfe;
  }

  .celula-input {
    width: 110px;
    padding: 0.4rem 0.55rem;
    border: 1px solid #cdd6e6;
    border-radius: 8px;
    background: #f9fbff;
    color: #1f2937;
  }

  @media (max-width: 640px) {
    table {
      min-width: 100%;
    }

    th,
    td {
      font-size: 0.95rem;
    }
  }
</style>
