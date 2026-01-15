<script lang="ts">
  import * as XLSX from "xlsx";

  type Linha = {
    id: string | number;
    descricao: string;
    quantidade: number;
    preco: number;
    total: number;
  };

  type Mudanca = {
    id: string;
    descricao: string;
    quantidadeAlterada: boolean;
    quantidadeAntiga: number;
    quantidadeNova: number;
    precoAlterado: boolean;
    precoAntigo: number;
    precoNovo: number;
    totalNovo: number;
  };

  let file1: File | null = $state(null);
  let file2: File | null = $state(null);
  let carregando = $state(false);
  let mensagem = $state("");
  let tipoMensagem: "sucesso" | "erro" | "" = $state("");
  let mudancas: Mudanca[] = $state([]);
  let linhasMescladas: Linha[] = $state([]);

  const parseNumero = (valor: unknown): number => {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : NaN;
    if (typeof valor === "string") {
      const semEspacos = valor.trim().replace(/\s+/g, "");
      const apenasNumeros = semEspacos.replace(/[^0-9,.-]/g, "");
      const normalizado = apenasNumeros.includes(",")
        ? apenasNumeros.replace(/\./g, "").replace(",", ".")
        : apenasNumeros;
      const numero = Number(normalizado);
      return Number.isFinite(numero) ? numero : NaN;
    }
    return NaN;
  };

  const lerExcel = async (file: File): Promise<Linha[]> => {
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
      throw new Error("Ficheiro sem dados.");
    }

    const [, ...dados] = matriz;
    const linhas: Linha[] = [];

    for (const linha of dados) {
      const [id, descricao, quantidadeBruta, precoBruto, totalBruto] = linha;

      if (
        [id, descricao, quantidadeBruta, precoBruto, totalBruto].every(
          (c) => c === "" || c === undefined
        )
      ) {
        continue;
      }

      const quantidade = parseNumero(quantidadeBruta);
      const preco = parseNumero(precoBruto);
      const total = parseNumero(totalBruto);

      linhas.push({
        id: String(id || ""),
        descricao: String(descricao || ""),
        quantidade: isNaN(quantidade) ? 0 : quantidade,
        preco: isNaN(preco) ? 0 : preco,
        total: isNaN(total) ? 0 : total,
      });
    }

    return linhas;
  };

  const executarMerge = async () => {
    if (!file1 || !file2) {
      mensagem = "Seleccione ambos os ficheiros";
      tipoMensagem = "erro";
      return;
    }

    try {
      carregando = true;
      mensagem = "A processar...";
      tipoMensagem = "";
      mudancas = [];

      // Ler ambos os ficheiros
      const linhas1 = await lerExcel(file1);
      const linhas2 = await lerExcel(file2);

      // Criar mapa de dados do ficheiro 2
      const mapaDados2 = new Map<string, Linha>();
      for (const linha of linhas2) {
        const id = String(linha.id);
        mapaDados2.set(id, linha);
      }

      // Array temporário para mudanças
      const mudancasTemp: Mudanca[] = [];

      // Mesclar: adicionar quantidades e manter preço mais alto
      const linhasMescladasTemp = linhas1.map((linha) => {
        const id = String(linha.id);
        const linha2 = mapaDados2.get(id);

        if (!linha2) {
          return linha;
        }

        const quantidadeAntiga = linha.quantidade;
        const quantidadeExtra = linha2.quantidade;
        const novaQuantidade = quantidadeAntiga + quantidadeExtra;

        const precoAntigo = linha.preco;
        const preco2 = linha2.preco;
        const novoPreco = Math.max(precoAntigo, preco2);

        const novoTotal = novaQuantidade * novoPreco;

        // Registar mudanças
        const quantidadeAlterada = quantidadeExtra !== 0;
        const precoAlterado = novoPreco !== precoAntigo;

        if (quantidadeAlterada || precoAlterado) {
          mudancasTemp.push({
            id,
            descricao: linha.descricao,
            quantidadeAlterada,
            quantidadeAntiga,
            quantidadeNova: novaQuantidade,
            precoAlterado,
            precoAntigo,
            precoNovo: novoPreco,
            totalNovo: novoTotal,
          });
        }

        return {
          ...linha,
          quantidade: novaQuantidade,
          preco: novoPreco,
          total: novoTotal,
        };
      });

      // Atribuir mudanças de uma vez para triggerar reactivity
      mudancas = mudancasTemp;
      linhasMescladas = linhasMescladasTemp;

      if (mudancasTemp.length === 0) {
        mensagem = "Nenhuma alteração detectada entre os ficheiros";
        tipoMensagem = "erro";
      } else {
        mensagem = `${mudancasTemp.length} produto(s) com alterações`;
        tipoMensagem = "";
      }
    } catch (error) {
      console.error("Erro ao combinar:", error);
      mensagem = `Erro: ${error}`;
      tipoMensagem = "erro";
    } finally {
      carregando = false;
    }
  };

  const exportarFicheiro = async () => {
    if (linhasMescladas.length === 0) {
      mensagem = "Não há dados para exportar";
      tipoMensagem = "erro";
      return;
    }

    try {
      carregando = true;

      // Nome do ficheiro com timestamp
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const timestamp = `${yyyy}-${mm}-${dd}-${hh}-${min}-${ss}`;
      const nomeFicheiro = `merged-${timestamp}.xlsx`;

      // Usar Tauri dialog e fs para salvar nativamente
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");

      const caminho = await save({
        title: "Guardar ficheiro Excel",
        defaultPath: nomeFicheiro,
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });

      if (!caminho) {
        mensagem = "Exportação cancelada";
        tipoMensagem = "erro";
        return;
      }

      // Criar ficheiro Excel
      const ws = XLSX.utils.aoa_to_sheet([
        ["ID", "Descrição", "Quantidade", "Preço", "Total"],
        ...linhasMescladas.map((l) => [
          l.id,
          l.descricao,
          l.quantidade,
          l.preco,
          l.total,
        ]),
      ]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Combinado");

      const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
      await writeFile(caminho, buffer);

      mensagem = `Ficheiro guardado com sucesso`;
      tipoMensagem = "sucesso";
    } catch (error) {
      console.error("Erro ao exportar:", error);
      mensagem = `Erro ao guardar ficheiro: ${error}`;
      tipoMensagem = "erro";
    } finally {
      carregando = false;
    }
  };

  const limpar = () => {
    file1 = null;
    file2 = null;
    mensagem = "";
    tipoMensagem = "";
    mudancas = [];
    linhasMescladas = [];
  };
</script>

<div class="merger">
  {#if mensagem && tipoMensagem === "sucesso"}
    <p class="resumo">{mensagem} · Produtos alterados: {mudancas.length}</p>
  {:else if mensagem && tipoMensagem === "erro"}
    <p class="erro">{mensagem}</p>
  {/if}

  {#if mudancas.length === 0 && !mensagem}
    <div class="placeholder">
      <p>Seleccione dois ficheiros Excel para começar a combinação.</p>
      <p class="hint">As alterações aparecerão aqui após o processamento.</p>
    </div>
  {:else if mudancas.length > 0}
    <div class="tabela-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Descrição</th>
            <th class="th-numeric">Qtd Anterior</th>
            <th class="th-numeric">Qtd Nova</th>
            <th class="th-numeric">Preço Anterior</th>
            <th class="th-numeric">Preço Novo</th>
            <th class="th-numeric">Total</th>
          </tr>
        </thead>
        <tbody>
          {#each mudancas as mudanca}
            <tr>
              <td>{mudanca.id}</td>
              <td>{mudanca.descricao}</td>
              <td
                class="td-numeric {mudanca.quantidadeAlterada
                  ? 'td-changed'
                  : ''}"
              >
                {mudanca.quantidadeAntiga}
              </td>
              <td
                class="td-numeric {mudanca.quantidadeAlterada
                  ? 'td-changed td-new'
                  : ''}"
              >
                {mudanca.quantidadeNova}
              </td>
              <td
                class="td-numeric {mudanca.precoAlterado ? 'td-changed' : ''}"
              >
                €{mudanca.precoAntigo.toFixed(2)}
              </td>
              <td
                class="td-numeric {mudanca.precoAlterado
                  ? 'td-changed td-new'
                  : ''}"
              >
                €{mudanca.precoNovo.toFixed(2)}
              </td>
              <td class="td-numeric td-total"
                >€{mudanca.totalNovo.toFixed(2)}</td
              >
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<aside class="workspace__aside">
  <div class="panel fill">
    <div class="aside__section">
      <h3>Combinar Ficheiros</h3>
      <p class="hint">Junte quantidades e actualize preços</p>
    </div>

    <div class="aside__section">
      <p class="eyebrow">Ficheiro Principal (1)</p>
      <label class="upload">
        <input
          type="file"
          accept=".xlsx"
          onchange={(e) => {
            const el = e.target as HTMLInputElement;
            file1 = el.files?.[0] ?? null;
          }}
          disabled={carregando}
        />
        <span>Escolher ficheiro .xlsx</span>
      </label>
      {#if file1}
        <p class="file-info">✓ {file1.name}</p>
      {/if}
    </div>

    <div class="aside__section">
      <p class="eyebrow">Ficheiro Incremental (2)</p>
      <label class="upload">
        <input
          type="file"
          accept=".xlsx"
          onchange={(e) => {
            const el = e.target as HTMLInputElement;
            file2 = el.files?.[0] ?? null;
          }}
          disabled={carregando}
        />
        <span>Escolher ficheiro .xlsx</span>
      </label>
      {#if file2}
        <p class="file-info">✓ {file2.name}</p>
      {/if}
    </div>

    {#if mensagem}
      <div class="aside__section">
        <div class={`mensagem mensagem--${tipoMensagem}`}>
          {mensagem}
        </div>
      </div>
    {/if}

    <div class="aside__section">
      <button
        class="upload"
        onclick={executarMerge}
        disabled={!file1 || !file2 || carregando || mudancas.length > 0}
      >
        {carregando ? "A processar..." : "Analisar Ficheiros"}
      </button>
      {#if mudancas.length > 0}
        <button
          class="upload upload--primary"
          onclick={exportarFicheiro}
          disabled={carregando}
        >
          Guardar Ficheiro Combinado
        </button>
      {/if}
      <button
        class="upload upload--secondary"
        onclick={limpar}
        disabled={carregando}
      >
        Limpar
      </button>
    </div>

    <div class="aside__section">
      <p class="eyebrow">Regras de Combinação</p>
      <div class="info-box">
        <p><strong>Quantidades:</strong> São somadas</p>
        <p><strong>Preços:</strong> Mantém-se o mais alto</p>
        <p><strong>Total:</strong> Recalculado automaticamente</p>
      </div>
    </div>
  </div>
</aside>

<style>
  .merger {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 100%;
    overflow: auto;
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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #607094;
    padding: 2rem;
  }

  .placeholder p {
    margin: 0.5rem 0;
  }

  .hint {
    font-size: 0.9rem;
    color: #94a3b8;
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
    min-width: 800px;
  }

  thead {
    background: #f1f5f9;
    position: sticky;
    top: 0;
    z-index: 1;
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
    font-weight: 600;
  }

  .th-numeric {
    text-align: right;
  }

  .td-numeric {
    text-align: right;
    font-family: "Courier New", monospace;
    font-size: 0.9rem;
  }

  .td-changed {
    background: #fef3c7;
    font-weight: 600;
  }

  .td-new {
    background: #d1fae5;
    color: #065f46;
  }

  .td-total {
    font-weight: 600;
    color: #475569;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }

  tbody tr {
    transition: background 120ms ease;
  }

  tbody tr:hover {
    background: #f5f7fb;
  }

  tbody tr:hover .td-changed {
    background: #fde68a;
  }

  tbody tr:hover .td-new {
    background: #a7f3d0;
  }

  .file-info {
    margin: 0.5rem 0 0 0;
    font-size: 0.85rem;
    color: #10b981;
    font-weight: 500;
  }

  .mensagem {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .mensagem--sucesso {
    background: #d1fae5;
    border: 1px solid #6ee7b7;
    color: #065f46;
  }

  .mensagem--erro {
    background: #fee2e2;
    border: 1px solid #fca5a5;
    color: #991b1b;
  }

  .upload--secondary {
    background: #ffffff;
    border: 1px solid #e5e9f2;
    color: #64748b;
  }

  .upload--secondary:hover:not(:disabled) {
    background: #f9fbff;
    border-color: #cdd6e6;
  }

  .upload--primary {
    background: #10b981;
    border-color: #10b981;
    color: white;
    font-weight: 600;
  }

  .upload--primary:hover:not(:disabled) {
    background: #059669;
    border-color: #059669;
  }

  .info-box {
    background: #f9fbff;
    border: 1px solid #e5e9f2;
    border-radius: 8px;
    padding: 0.75rem;
    font-size: 0.85rem;
    color: #475569;
  }

  .info-box p {
    margin: 0.5rem 0;
  }

  .info-box p:first-child {
    margin-top: 0;
  }

  .info-box p:last-child {
    margin-bottom: 0;
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
