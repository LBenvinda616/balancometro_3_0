<script lang="ts">
  import Counter from "./lib/Counter.svelte";

  type MenuItem = {
    id: "counter";
    label: string;
    description: string;
  };

  const menuItems: MenuItem[] = [
    {
      id: "counter",
      label: "Contador",
      description: "Ferramenta de contagem simples e precisa.",
    },
  ];

  let activeItem: MenuItem | null = null;

  // Controlo global (workspace)
  let ficheiroSelecionado: File | null = null;
  let resumo = {
    totalProdutos: 0,
    somaTotal: 0,
    totalProdutosFiltrados: 0,
    somaTotalFiltrados: 0,
  };
  let filtroId: string = "";
  let filtroDescricao: string = "";
  let filtroDescricaoLev: boolean = false;
  let filtroDescricaoLevPercent: number = 30; // 0-100
  let filtroPrecoMin: string = ""; // usar strings para inputs
  let filtroPrecoMax: string = "";
  let exportarTimestamp: number = 0;
  let filtrosBloqueados = false;
  let precoMaxManual = false; // se o utilizador ajustar o preço máximo manualmente

  const formatarMoeda = (valor: number) =>
    new Intl.NumberFormat("pt-PT", {
      style: "currency",
      currency: "EUR",
    }).format(valor);

  const openItem = (item: MenuItem) => {
    activeItem = item;
  };

  const closeItem = () => {
    activeItem = null;
  };

  const triggerExport = () => {
    exportarTimestamp = Date.now();
  };
</script>

<main class="shell">
  {#if !activeItem}
    <section class="menu">
      <div class="menu__header">
        <p class="eyebrow">Menu inicial</p>
        <h1>Balancometro</h1>
        <p class="hint">Selecione uma ferramenta para começar.</p>
      </div>

      <ul class="menu__list">
        {#each menuItems as item}
          <li>
            <button class="menu__item" on:click={() => openItem(item)}>
              <div>
                <p class="menu__label">{item.label}</p>
                <p class="menu__description">{item.description}</p>
              </div>
              <span aria-hidden="true">→</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>

    <section class="content">
      <div class="placeholder">
        <p>Escolha "Contador" para iniciar.</p>
      </div>
    </section>
  {:else if activeItem.id === "counter"}
    <section class="workspace workspace--fixed">
      <header class="workspace__header">
        <div>
          <p class="eyebrow">Ferramenta</p>
          <h2>{activeItem.label}</h2>
        </div>
        <button class="ghost" on:click={closeItem}>Voltar ao menu</button>
      </header>

      <div class="workspace__grid">
        <div class="workspace__main">
          <div class="panel fill">
            <Counter
              ficheiro={ficheiroSelecionado}
              filtros={{
                id: filtroId,
                descricao: filtroDescricao,
                descricaoLevAtivo: filtroDescricaoLev,
                descricaoLevPct: filtroDescricaoLevPercent / 100,
                precoMin: filtroPrecoMin,
                precoMax: filtroPrecoMax,
              }}
              onResumo={(r) => (resumo = r)}
              exportar={exportarTimestamp}
              onEditingChange={(ativo) => (filtrosBloqueados = ativo)}
            />
          </div>
        </div>
        <aside class="workspace__aside">
          <div class="panel fill">
            <div class="aside__section">
              <h3>Controlo e filtros</h3>
              <p class="hint">Área reservada para filtros globais.</p>
            </div>

            <div class="aside__section">
              <p class="eyebrow">Importação</p>
              <label class="upload">
                <input
                  type="file"
                  accept=".xlsx"
                  on:change={(e) => {
                    const el = e.target as HTMLInputElement;
                    ficheiroSelecionado = el.files?.[0] ?? null;
                  }}
                />
                <span>Escolher ficheiro .xlsx</span>
              </label>

              <button class="upload" on:click={triggerExport}>
                Exportar para .xlsx
              </button>
            </div>

            <div class="aside__section">
              <p class="eyebrow">Filtros</p>
              <label>
                <span class="resumo-label">ID</span>
                <input
                  class="celula-input"
                  type="text"
                  bind:value={filtroId}
                  placeholder="ex.: 123"
                  disabled={filtrosBloqueados}
                />
              </label>
              <label>
                <span class="resumo-label">Descrição</span>
                <input
                  class="celula-input"
                  type="text"
                  bind:value={filtroDescricao}
                  placeholder="ex.: parafuso"
                  disabled={filtrosBloqueados}
                />
              </label>
              <div class="resumo-grid">
                <label
                  class="resumo-item"
                  title="Ativar correspondência por Levenshtein"
                >
                  <span class="resumo-label">Levenshtein</span>
                  <input
                    type="checkbox"
                    bind:checked={filtroDescricaoLev}
                    disabled={filtrosBloqueados}
                  />
                </label>
                <label class="resumo-item" title="Percentagem de tolerância">
                  <span class="resumo-label">Tolerância</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={filtroDescricaoLevPercent}
                    on:input={(e) =>
                      (filtroDescricaoLevPercent = Number(
                        (e.target as HTMLInputElement).value
                      ))}
                    disabled={filtrosBloqueados || !filtroDescricaoLev}
                  />
                  <span class="hint">{filtroDescricaoLevPercent}%</span>
                </label>
              </div>
              <div class="resumo-grid">
                <label class="resumo-item">
                  <span class="resumo-label">Preço min.</span>
                  <input
                    class="celula-input"
                    type="number"
                    step="1.00"
                    lang="en"
                    inputmode="decimal"
                    value={filtroPrecoMin}
                    on:input={(e) => {
                      const v = (e.target as HTMLInputElement).value;
                      filtroPrecoMin = v;
                      if (!precoMaxManual) {
                        filtroPrecoMax = v;
                      }
                      if (v === "" && filtroPrecoMax === "") {
                        precoMaxManual = false;
                      }
                    }}
                    disabled={filtrosBloqueados}
                  />
                </label>
                <label class="resumo-item">
                  <span class="resumo-label">Preço máx.</span>
                  <input
                    class="celula-input"
                    type="number"
                    step="1.00"
                    lang="en"
                    inputmode="decimal"
                    value={filtroPrecoMax}
                    on:input={(e) => {
                      precoMaxManual = true;
                      filtroPrecoMax = (e.target as HTMLInputElement).value;
                      if (filtroPrecoMin === "" && filtroPrecoMax === "") {
                        precoMaxManual = false;
                      }
                    }}
                    disabled={filtrosBloqueados}
                  />
                </label>
              </div>
            </div>
            <div class="aside__section">
              <p class="eyebrow">Resumo</p>
              <div class="resumo-grid">
                <div class="resumo-item">
                  <span class="resumo-label">Produtos</span>
                  <span class="resumo-value">{resumo.totalProdutos}</span>
                </div>
                <div class="resumo-item">
                  <span class="resumo-label">Soma dos totais</span>
                  <span class="resumo-value"
                    >{formatarMoeda(resumo.somaTotal)}</span
                  >
                </div>
                <div class="resumo-item">
                  <span class="resumo-label">Produtos (filtrados)</span>
                  <span class="resumo-value"
                    >{resumo.totalProdutosFiltrados}</span
                  >
                </div>
                <div class="resumo-item">
                  <span class="resumo-label">Soma filtrada</span>
                  <span class="resumo-value"
                    >{formatarMoeda(resumo.somaTotalFiltrados)}</span
                  >
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  {/if}
</main>
