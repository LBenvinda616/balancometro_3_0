<script lang="ts">
  import { aggregateSAFTFiles, type SAFTAggregationResult } from "./saftParser";

  let ficheiros: File[] = [];
  let nomes: string[] = [];
  let analisando: boolean = false;
  let resultado: SAFTAggregationResult | null = null;

  function onSelecionar(e: Event) {
    const input = e.target as HTMLInputElement;
    ficheiros = Array.from(input.files ?? []);
    nomes = ficheiros.map((f) => f.name);
  }

  async function analisar() {
    if (ficheiros.length === 0) return;
    analisando = true;
    try {
      resultado = await aggregateSAFTFiles(ficheiros);
    } catch (err: any) {
      console.error("Erro ao analisar ficheiros:", err);
    } finally {
      analisando = false;
    }
  }

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(valor);
  }

  async function exportar() {
    if (!resultado) return;
    // Placeholder for export functionality
    console.log("Exportando resultado:", resultado);
  }
</script>

<div class="saft">
  <div class="saft__intro">
    <h3>Resumo SAF‑T Anual</h3>
    <p class="hint">
      Selecione os ficheiros SAF‑T (.xml). Para já, esta vista é um esqueleto —
      vamos implementar a análise e exportação nos próximos passos.
    </p>
  </div>

  <div class="saft__upload">
    <label class="upload">
      <input type="file" accept=".xml" multiple on:change={onSelecionar} />
      <span>Escolher ficheiros SAF‑T (.xml)</span>
    </label>
    {#if ficheiros.length > 0}
      <p class="hint">Selecionados: {ficheiros.length} ficheiros</p>
      <ul class="lista">
        {#each nomes as n}
          <li>{n}</li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="saft__acoes">
    <button
      class="primary"
      disabled={ficheiros.length === 0 || analisando}
      on:click={analisar}
    >
      {analisando ? "Analisando..." : "Analisar"}
    </button>
    <button class="ghost" disabled={!resultado} on:click={exportar}>
      Exportar resumo
    </button>
  </div>

  {#if resultado}
    <div class="saft__resultado">
      <h4>Resultado da Análise</h4>
      {#if resultado.errors.length > 0}
        <div class="erros">
          <p class="eyebrow">Avisos:</p>
          <ul>
            {#each resultado.errors as erro}
              <li>{erro}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="resumo-grid">
        <div class="resumo-item">
          <span class="resumo-label">Período</span>
          <span class="resumo-value">{resultado.period}</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-label">Meses processados</span>
          <span class="resumo-value">{resultado.months.length}</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-label">Produtos únicos</span>
          <span class="resumo-value">{resultado.products.length}</span>
        </div>
        <div class="resumo-item">
          <span class="resumo-label">Valor total</span>
          <span class="resumo-value">{formatarMoeda(resultado.totalValue)}</span
          >
        </div>
      </div>

      {#if resultado.products.length > 0}
        <h5>Top 10 Produtos por Valor</h5>
        <div class="tabela-scroll">
          <table class="tabela">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Quantidade</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {#each resultado.products.slice(0, 10) as prod}
                <tr>
                  <td>{prod.productCode}</td>
                  <td>{prod.productName}</td>
                  <td class="numero">{prod.totalQuantity.toFixed(2)}</td>
                  <td class="numero">{formatarMoeda(prod.totalValue)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .saft {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .saft__intro h3 {
    margin: 0;
  }
  .hint {
    color: #6b7280;
    font-size: 0.9rem;
  }
  .lista {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
    max-height: 160px;
    overflow: auto;
  }
  .upload {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
  .upload input {
    display: none;
  }
  .saft__acoes {
    display: flex;
    gap: 0.5rem;
  }
  .primary {
    background: #2563eb;
    color: white;
    border: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
  }
  .primary[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .ghost {
    background: transparent;
    border: 1px solid #d1d5db;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
  }
  .ghost[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .saft__resultado {
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    background: #f9fafb;
  }
  .saft__resultado h4 {
    margin-top: 0;
  }
  .saft__resultado h5 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .erros {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
  }
  .erros ul {
    margin: 0.5rem 0 0;
    padding-left: 1.25rem;
  }
  .resumo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .resumo-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .resumo-label {
    font-size: 0.85rem;
    color: #6b7280;
    font-weight: 500;
  }
  .resumo-value {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
  }
  .tabela-scroll {
    overflow-x: auto;
  }
  .tabela {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  .tabela thead {
    background: #f3f4f6;
  }
  .tabela th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid #d1d5db;
  }
  .tabela td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }
  .tabela .numero {
    text-align: right;
    font-family: monospace;
  }
</style>
