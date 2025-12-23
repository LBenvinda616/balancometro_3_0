<script lang="ts">
  import Counter from "./lib/Counter.svelte";
  import SAFTSummary from "./lib/SAFTSummary.svelte";

  type MenuItem = {
    id: "counter" | "saft";
    label: string;
    description: string;
  };

  const menuItems: MenuItem[] = [
    {
      id: "counter",
      label: "Contador",
      description: "Ferramenta de contagem simples e precisa.",
    },
    {
      id: "saft",
      label: "Resumo SAF‑T",
      description: "Agregue 12 ficheiros SAF‑T e exporte o resumo.",
    },
  ];

  let activeItem: MenuItem | null = null;

  // Controlo global (workspace)
  let edicaoAtiva: boolean = false;
  let ficheiroSelecionado: File | null = null;
  let resumo = { totalProdutos: 0, somaTotal: 0 };
  let filtroId: string = "";
  let filtroDescricao: string = "";
  let filtroPrecoMin: string = ""; // usar strings para inputs
  let filtroPrecoMax: string = "";
  let exportarTimestamp: number = 0;

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
        <p>Escolha "Contador" ou "Resumo SAF‑T" para iniciar.</p>
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
              {edicaoAtiva}
              ficheiro={ficheiroSelecionado}
              filtros={{
                id: filtroId,
                descricao: filtroDescricao,
                precoMin: filtroPrecoMin,
                precoMax: filtroPrecoMax,
              }}
              onResumo={(r) => (resumo = r)}
              exportar={exportarTimestamp}
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
              <p class="eyebrow">Edição</p>
              <label class="switch">
                <input type="checkbox" bind:checked={edicaoAtiva} />
                <span class="slider" aria-hidden="true"></span>
                <span class="rotulo">Permitir edição de quantidade e preço</span
                >
              </label>

              <div class="aside__section">
                <p class="eyebrow">Filtros</p>
                <label>
                  <span class="resumo-label">ID</span>
                  <input
                    class="celula-input"
                    type="text"
                    bind:value={filtroId}
                    placeholder="ex.: 123"
                  />
                </label>
                <label>
                  <span class="resumo-label">Descrição</span>
                  <input
                    class="celula-input"
                    type="text"
                    bind:value={filtroDescricao}
                    placeholder="ex.: parafuso"
                  />
                </label>
                <div class="resumo-grid">
                  <label class="resumo-item">
                    <span class="resumo-label">Preço min.</span>
                    <input
                      class="celula-input"
                      type="number"
                      step="0.01"
                      bind:value={filtroPrecoMin}
                    />
                  </label>
                  <label class="resumo-item">
                    <span class="resumo-label">Preço máx.</span>
                    <input
                      class="celula-input"
                      type="number"
                      step="0.01"
                      bind:value={filtroPrecoMax}
                    />
                  </label>
                </div>
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
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  {:else if activeItem.id === "saft"}
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
            <SAFTSummary />
          </div>
        </div>
        <aside class="workspace__aside">
          <div class="panel fill">
            <div class="aside__section">
              <h3>Como começar</h3>
              <p class="hint">
                Carregue 12 ficheiros SAF‑T (.xml), um por mês.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  {/if}
</main>
