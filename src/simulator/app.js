import { receivingState } from "./receiving.js";
import { PRODUCTS, getProduct, productIcon } from "./products.js";
import "./style.css";
import { ENVIRONMENTS, createSimulation, MATERIALS } from "./simulation.js";
import { createLabScene } from "./lab-scene.js";

const icon = (name) => {
  const paths = {
    play: "M9 5v14l10-7Z",
    pause: "M8 5v14M16 5v14",
    reset: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
    cube: "m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9",
    front: "M4 5h16v14H4zM4 9h16",
    top: "M4 4h16v16H4zM4 12h16M12 4v16",
    plus: "M12 5v14M5 12h14",
    minus: "M5 12h14",
    gear: "M4 19V9l5 3V6l6 4V3h5v16H4Zm4-3h1m3 0h1m3 0h1",
    signal: "M3 18h4V9h5v9h5V5h4",
    export: "M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5",
    step: "M6 5v14l10-7ZM19 5v14",
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] ?? paths.gear}"/></svg>`;
};
const staticDemo = import.meta.env.MODE === "pages";
const root = document.querySelector("#app");
root.innerHTML = `
  <header class="app-header"><div class="senai-signature"><img src="${import.meta.env.BASE_URL}senai-logo.png" alt="SENAI" width="126" height="48"></div><div class="brand"><strong>Simulador de Logística</strong><span>${staticDemo ? "Protótipo de demonstração" : "Laboratório de processos industriais"}</span></div><div class="header-context"><span id="product-context">Panela de cabo · 18 cm</span> <span class="context-separator">/</span> Do disco ao pedido expedido</div><button id="report" class="text-button">${icon("export")}<span>Relatório</span></button>${staticDemo ? "" : '<button id="logout" class="text-button">Sair</button>'}</header>
  <div class="workspace">
    <main class="laboratory">
      <div class="simulation-toolbar"><label class="environment-picker"><span class="sr-only">Ambiente</span><select id="environment-select" aria-label="Ambiente">${ENVIRONMENTS.map((e, i) => `<option value="${e.id}">${String(i + 1).padStart(2, "0")} · ${e.short}</option>`).join("")}</select></label><div class="transport"><button id="start" class="primary">${icon("play")}<span>Iniciar</span></button><button id="pause" class="icon-button" aria-label="Pausar simulação">${icon("pause")}</button><button id="step" class="icon-button" aria-label="Avançar 100 milissegundos">${icon("step")}</button><span class="toolbar-divider"></span><button id="new-batch" class="icon-button" aria-label="Preparar novo lote">${icon("reset")}</button></div><div class="simulation-settings"><label class="scope-label"><span class="sr-only">Abrangência da simulação</span><select id="scope"><option value="bench">Bancada individual</option><option value="line">Linha integrada</option></select></label><label><span class="sr-only">Velocidade da simulação</span><select id="speed"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select></label></div></div>
      <section class="viewport" aria-label="Visualização tridimensional do equipamento"><div class="scene-host"><canvas id="world" aria-label="Equipamento industrial 3D. Arraste para girar, use a roda para aproximar e clique nos sensores para inspecionar." tabindex="0"></canvas></div><div class="scene-heading"><span class="section-counter" id="environment-number"></span><h1 id="environment-title"></h1><p id="machine-title"></p></div><div class="camera-tools" role="group" aria-label="Câmeras"><button data-camera="iso" aria-label="Câmera isométrica">${icon("cube")}</button><button data-camera="front" class="active" aria-label="Câmera frontal">${icon("front")}</button><button data-camera="top" aria-label="Câmera superior">${icon("top")}</button><span></span><button id="zoom-in" aria-label="Aproximar">${icon("plus")}</button><button id="zoom-out" aria-label="Afastar">${icon("minus")}</button></div><div class="process-hotspots" aria-hidden="true"><span id="hotspot-0">1 · Entrada</span><span id="hotspot-1">2 · Equipamento</span><span id="hotspot-2">3 · Saída</span></div><button id="scene-action" class="primary scene-action">Inserir unidade</button><div id="receiving-feedback" class="receiving-feedback" hidden><strong id="receiving-title"></strong><span id="receiving-detail"></span><progress id="receiving-progress" max="1" value="0" aria-label="Progresso da conferência"></progress></div><div class="viewport-state"><span id="run-indicator"></span><span id="scene-state">Pronto para iniciar</span></div><div class="scene-bottom"><div class="scene-hint">Arraste para girar · Role para aproximar</div><div class="scene-metrics"><div><span>Na entrada</span><strong id="queue-count">0</strong></div><div><span>Em processo</span><strong id="wip-count">0</strong></div><div><span>Concluídas</span><strong id="done-count">0</strong></div></div></div><div id="render-error" hidden><strong>Não foi possível abrir o ambiente 3D.</strong><p>Recarregue a página em um navegador com WebGL 2.</p><button id="retry">Recarregar</button></div></section>
      <div class="process-strip" aria-label="Fluxo logístico">${ENVIRONMENTS.map((e, i) => `<button data-environment="${e.id}" aria-label="Visualizar ${e.name}"><span>${String(i + 1).padStart(2, "0")}</span><span>${e.short}</span><b id="process-${e.id}">0</b></button>`).join("")}</div>
    </main>
    <aside class="inspector" aria-label="Painel do simulador"><div class="inspector-tabs" role="tablist"><button role="tab" data-tab="operation" aria-controls="panel-operation" aria-selected="true">Operação</button><button role="tab" data-tab="signals" aria-controls="panel-signals" aria-selected="false">Sinais</button><button role="tab" data-tab="practice" aria-controls="panel-practice" aria-selected="false">Prática</button></div>
      <section id="panel-operation" class="inspector-panel" role="tabpanel"><section class="product-picker" aria-label="Escolha sua panela"><div class="panel-heading"><h2>Qual panela vamos produzir?</h2></div><div class="product-options">${PRODUCTS.map((p) => `<button data-product="${p.id}" aria-pressed="${p.id === PRODUCTS[0].id}">${productIcon(p)}<span><strong>${p.name}</strong><small>${p.size}</small></span></button>`).join("")}</div><p id="product-description" class="muted"></p><p class="product-note">Trocar o modelo prepara um novo lote.</p></section><div class="interaction-card"><span id="action-state">Sua vez</span><button id="execute-action" class="primary">Inserir unidade</button><progress id="action-progress" max="1" value="0" aria-label="Progresso da ação"></progress><p id="action-help"></p></div><div class="panel-heading"><h2>Modo de operação</h2></div><div class="mode-selector" role="group" aria-label="Modo de operação"><button data-mode="guided" aria-pressed="true">Interativo</button><button data-mode="auto" aria-pressed="true">Automático</button><button data-mode="manual" aria-pressed="false">Manual</button></div><p id="mode-description" class="muted"></p><div class="panel-section"><div class="panel-heading"><h2>Atuadores</h2><span id="manual-badge">Controle automático</span></div><div class="actuator-list">${[
        ["motor", "Q.0", "Transportador"],
        ["work", "Q.1", "Processo da máquina"],
        ["transfer", "Q.2", "Transferência"],
      ]
        .map(
          ([key, address, name]) =>
            `<button data-command="${key}" class="actuator" aria-pressed="false"><span class="io-address" data-output-address="${key}">${address}</span><span>${name}</span><span class="toggle-switch"></span></button>`,
        )
        .join(
          "",
        )}</div><p class="control-caption" id="manual-help"></p></div><div class="panel-section"><h2>Condições do ambiente</h2><label class="condition"><span>Proteção fechada</span><input id="guard" type="checkbox" checked></label><label class="condition"><span>Simular saída obstruída</span><input id="fault" type="checkbox"></label></div><div class="safety-area"><button id="emergency"><span class="emergency-symbol"></span>Parada de emergência</button><button id="acknowledge" hidden>Rearmar segurança</button><p id="safety-message">Interrompe todos os atuadores da linha.</p></div></section>
      <section id="panel-signals" class="inspector-panel" role="tabpanel" hidden><h2>Entradas digitais</h2><p class="muted">Estados dos sensores do ambiente selecionado.</p><div class="signal-table">${[
        ["entry", "Sensor de entrada"],
        ["positioned", "Peça posicionada"],
        ["exit", "Sensor de saída"],
        ["guard", "Proteção fechada"],
        ["stroke", "Fim de curso"],
      ]
        .map(
          ([key, name], i) =>
            `<div class="signal-row" id="signal-${key}"><span class="io-address" data-input-address="${key}">I.${i}</span><span>${name}</span><b id="input-${key}">0</b></div>`,
        )
        .join(
          "",
        )}</div><div class="panel-section"><h2>Saídas digitais</h2><div class="signal-table">${[
        ["motor", "Transportador"],
        ["work", "Processo"],
        ["transfer", "Transferência"],
      ]
        .map(
          ([key, name], i) =>
            `<div class="signal-row"><span class="io-address" data-output-address="${key}">Q.${i}</span><span>${name}</span><b id="output-${key}">0</b></div>`,
        )
        .join(
          "",
        )}</div></div><p class="io-note">Monitoramento virtual. Esta versão funciona no navegador, sem conexão com CLP externo.</p></section>
      <section id="panel-practice" class="inspector-panel" role="tabpanel" hidden><h2>Prática sugerida</h2><p id="exercise" class="exercise-text"></p><div class="practice-steps"><div><span>1</span>Conduza as etapas no modo interativo.</div><div><span>2</span>Relacione os sensores com os atuadores.</div><div><span>3</span>Experimente o modo manual e os intertravamentos.</div></div><div class="panel-section"><h2>Registro de eventos</h2><ol id="event-list" class="event-list"></ol></div></section>
      <div class="inspector-summary"><span>Lote</span><strong id="batch-progress">0 / 12</strong><div class="batch-track"><span id="batch-bar"></span></div></div>
    </aside>
  </div>
  <footer class="statusbar"><div><span id="global-status-dot"></span><span id="global-status">Pronto</span></div><div><span id="scope-status">Bancada individual</span><span class="footer-divider"></span><span>Tempo simulado <b id="simulation-clock">00:00</b></span></div><span class="prototype-label">Protótipo didático</span></footer>
  <dialog id="batch-dialog"><form id="batch-form"><button type="button" id="cancel-batch" class="dialog-close" aria-label="Fechar">×</button><h2>Preparar novo lote</h2><p>Os contadores e o estado dos equipamentos serão reiniciados.</p><label>Quantidade de unidades<input id="batch-size" type="number" min="1" max="50" value="12" required></label><button type="submit" class="primary">Preparar lote</button></form></dialog>`;

const $ = (selector) => document.querySelector(selector);
const panelToggle = document.createElement("button");
panelToggle.id = "toggle-panel";
panelToggle.setAttribute("aria-label", "Expandir painel de operação");
panelToggle.setAttribute("aria-expanded", "false");
panelToggle.innerHTML = icon("plus");
$(".inspector-tabs").append(panelToggle);
panelToggle.onclick = () => {
  const open = $(".workspace").classList.toggle("panel-open");
  panelToggle.setAttribute("aria-expanded", String(open));
  panelToggle.setAttribute(
    "aria-label",
    open ? "Recolher painel" : "Expandir painel de operação",
  );
  panelToggle.innerHTML = icon(open ? "minus" : "plus");
};
let selected = "receiving";
const simulation = createSimulation(12, {
  scope: "bench",
  environment: selected,
  mode: "auto",
});
let view = null,
  lastTime = performance.now(),
  lastUi = 0,
  lastEvent = 0,
  activeTab = "operation";
const timeLabel = (time) =>
  `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
function text(selector, value) {
  const element = $(selector);
  if (element && element.textContent !== String(value))
    element.textContent = String(value);
}
function tab(name) {
  activeTab = name;
  $(".workspace").classList.add("panel-open");
  panelToggle.setAttribute("aria-expanded", "true");
  panelToggle.setAttribute("aria-label", "Recolher painel");
  panelToggle.innerHTML = icon("minus");
  for (const button of document.querySelectorAll("[data-tab]"))
    button.setAttribute("aria-selected", String(button.dataset.tab === name));
  for (const panel of document.querySelectorAll(".inspector-panel"))
    panel.hidden = panel.id !== `panel-${name}`;
}
function selectEnvironment(id) {
  if (!ENVIRONMENTS.some((e) => e.id === id)) return;
  const changed = selected !== id;
  selected = id;
  const state = simulation.snapshot;
  if (changed && state.scope === "bench") simulation.setScope("bench", id);
  const environment = ENVIRONMENTS.find((e) => e.id === id),
    index = ENVIRONMENTS.indexOf(environment);
  $("#environment-select").value = id;

  text("#input-material", MATERIALS[environment.input]);
  text("#output-material", MATERIALS[environment.output]);
  text("#environment-number", `${String(index + 1).padStart(2, "0")} / 08`);
  text("#environment-title", environment.name);
  text("#machine-title", environment.machine);
  text("#exercise", environment.exercise);
  for (const button of document.querySelectorAll("[data-environment]")) {
    button.classList.toggle("selected", button.dataset.environment === id);
    button.setAttribute(
      "aria-current",
      button.dataset.environment === id ? "true" : "false",
    );
  }
  for (const [i, key] of [
    "entry",
    "positioned",
    "exit",
    "guard",
    "stroke",
  ].entries())
    for (const element of document.querySelectorAll(
      `[data-input-address="${key}"]`,
    ))
      element.textContent = `I${index}.${i}`;
  for (const [i, key] of ["motor", "work", "transfer"].entries())
    for (const element of document.querySelectorAll(
      `[data-output-address="${key}"]`,
    ))
      element.textContent = `Q${index}.${i}`;
  view?.select(id);
  for (const button of document.querySelectorAll("[data-camera]"))
    button.classList.toggle("active", button.dataset.camera === "front");
  lastEvent = -1;
  updateUi();
}
function updateUi() {
  const state = simulation.snapshot,
    cell = state.cells.find((c) => c.id === selected);
  const environment = ENVIRONMENTS.find((e) => e.id === selected);
  const product = getProduct(state.product);
  text("#product-context", `${product.name} · ${product.size}`);
  text("#product-description", product.description);
  for (const b of document.querySelectorAll("[data-product]"))
    b.setAttribute("aria-pressed", String(b.dataset.product === product.id));
  const receiving = receivingState(cell, getProduct(state.product));
  $("#receiving-feedback").hidden = selected !== "receiving" || !cell.part;
  text("#receiving-title", receiving.title);
  text("#receiving-detail", receiving.detail);
  $("#receiving-progress").value = cell.stage?.progress ?? 0;
  const interactive = cell.mode === "guided";
  $(".interaction-card").hidden = !interactive;
  text(
    "#execute-action",
    cell.awaitingAction
      ? (cell.actionLabel ?? "Aguardar material")
      : "Executando…",
  );
  $("#execute-action").disabled =
    !state.ready || !cell.awaitingAction || !cell.actionAvailable;
  $("#scene-action").hidden = !interactive;
  $("#scene-action").disabled = $("#execute-action").disabled;
  text(
    "#scene-action",
    cell.awaitingAction
      ? (cell.actionLabel ?? "Aguardar material")
      : "Executando…",
  );
  text(
    "#action-state",
    !state.ready
      ? "Verifique a segurança"
      : cell.awaitingAction
        ? "Sua vez"
        : "Ação em andamento",
  );
  text(
    "#action-help",
    cell.awaitingAction
      ? "Autorize uma ação. O equipamento para ao terminar e espera seu próximo comando."
      : "Observe o movimento e o progresso. A próxima etapa depende de você.",
  );
  $("#action-progress").value = cell.stage?.progress ?? 0;
  text(
    "#cycle-action",
    cell.stage
      ? `${state.running ? "" : "Pausado · "}${cell.stage.label}`
      : state.done >= state.batch
        ? "Lote concluído"
        : "Como funciona",
  );
  text(
    "#cycle-explanation",
    cell.stage?.explanation ?? environment.description,
  );
  text(
    "#unit-status",
    cell.unit
      ? `${cell.unit.id} · ${MATERIALS[cell.unit.material]}`
      : `Lote de ${state.batch} panelas`,
  );
  for (const item of document.querySelectorAll("[data-step]")) {
    const i = Number(item.dataset.step);
    item.classList.toggle("active", i === cell.stageIndex);
    item.classList.toggle(
      "done",
      cell.stageIndex > i || state.done >= state.batch,
    );
  }
  const status = state.emergency
    ? "Emergência acionada"
    : !state.ready
      ? "Intertravamento ativo"
      : state.done >= state.batch
        ? "Lote concluído"
        : cell.mode === "guided" && cell.awaitingAction
          ? "Aguardando sua ação"
          : state.running
            ? "Em operação"
            : "Pronto / pausado";
  text("#global-status", status);
  text("#scene-state", state.running ? cell.status : status);
  text("#simulation-clock", timeLabel(state.time));
  text("#queue-count", cell.queue);
  text("#wip-count", cell.part ? 1 : 0);
  text("#done-count", cell.done);
  text("#batch-progress", `${state.done} / ${state.batch}`);
  $("#batch-bar").style.width = `${(state.done / state.batch) * 100}%`;
  $("#start").disabled =
    state.running || !state.ready || state.done >= state.batch;
  $("#pause").disabled = !state.running;
  $("#step").disabled =
    state.running || !state.ready || state.done >= state.batch;
  $("#run-indicator").className =
    state.emergency || !state.ready ? "fault" : state.running ? "running" : "";
  $("#global-status-dot").className = $("#run-indicator").className;
  text(
    "#scope-status",
    state.scope === "bench" ? "Bancada individual" : "Linha integrada",
  );
  $("#guard").checked = cell.guard;
  $("#fault").checked = cell.fault;
  $("#acknowledge").hidden = !state.emergency;
  $("#acknowledge").disabled = state.cells.some((c) => !c.guard || c.fault);
  text(
    "#safety-message",
    state.emergency
      ? "Elimine as falhas e rearme antes de iniciar."
      : !state.ready
        ? "Verifique proteções e obstruções nos ambientes."
        : "Interrompe todos os atuadores da linha.",
  );
  text(
    "#mode-description",
    cell.mode === "guided"
      ? "Você autoriza cada etapa. Nenhuma etapa seguinte começa sozinha."
      : cell.mode === "auto"
        ? "O ciclo coordena transporte, processo e transferência automaticamente."
        : "Acione os atuadores e observe os sensores para conduzir cada etapa.",
  );
  text(
    "#manual-badge",
    cell.mode === "guided"
      ? "Controle por etapas"
      : cell.mode === "auto"
        ? "Controle automático"
        : "Controle manual",
  );
  text(
    "#manual-help",
    cell.mode === "guided"
      ? "Use o botão de ação para conduzir cada operação."
      : cell.mode === "auto"
        ? "Selecione Manual para comandar os atuadores."
        : !state.running
          ? "Inicie a simulação para energizar os atuadores."
          : "Posicione a unidade antes de acionar o processo. Libere a transferência no sensor de saída.",
  );
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.mode === cell.mode),
    );
  }
  for (const button of document.querySelectorAll("[data-command]")) {
    const key = button.dataset.command;
    button.disabled = cell.mode !== "manual" || !state.ready;
    button.setAttribute(
      "aria-pressed",
      String(cell.mode === "manual" ? cell.commands[key] : cell.outputs[key]),
    );
    button.classList.toggle("energized", cell.outputs[key]);
  }
  for (const [key, value] of Object.entries(cell.inputs)) {
    text(`#input-${key}`, value ? "1" : "0");
    $(`#input-${key}`).classList.toggle("on", value);
  }
  for (const [key, value] of Object.entries(cell.outputs)) {
    text(`#output-${key}`, value ? "1" : "0");
    $(`#output-${key}`).classList.toggle("on", value);
  }
  for (const c of state.cells) {
    text(`#process-${c.id}`, c.done);
    const dot = $(`#dot-${c.id}`);
    if (dot)
      dot.className = `environment-dot ${c.fault || !c.guard ? "error" : state.running && c.part ? "live" : ""}`;
  }
  if (state.events[0]?.id !== lastEvent) {
    lastEvent = state.events[0]?.id;
    $("#event-list").replaceChildren();
    for (const event of state.events
      .filter((e) => !e.environment || e.environment === selected)
      .slice(0, 9)) {
      const item = document.createElement("li");
      item.className = event.type;
      const stamp = document.createElement("time");
      stamp.textContent = timeLabel(event.time);
      const message = document.createElement("span");
      message.textContent = event.message;
      item.append(stamp, message);
      $("#event-list").append(item);
    }
  }
}
for (const button of document.querySelectorAll("[data-product]"))
  button.onclick = () => {
    simulation.setProduct(button.dataset.product);
    view?.setProduct(button.dataset.product);
    lastEvent = -1;
    updateUi();
  };
const logoutButton = $("#logout");
if (logoutButton)
  logoutButton.onclick = () => document.dispatchEvent(new Event("auth:logout"));
for (const button of document.querySelectorAll("[data-environment]"))
  button.onclick = () => selectEnvironment(button.dataset.environment);
for (const button of document.querySelectorAll("[data-tab]"))
  button.onclick = () => tab(button.dataset.tab);
for (const button of document.querySelectorAll("[data-mode]"))
  button.onclick = () => {
    simulation.setMode(selected, button.dataset.mode);
    updateUi();
  };
for (const button of document.querySelectorAll("[data-command]"))
  button.onclick = () => {
    const cell = simulation.snapshot.cells.find((c) => c.id === selected);
    simulation.command(
      selected,
      button.dataset.command,
      !cell.commands[button.dataset.command],
    );
    updateUi();
  };
for (const button of document.querySelectorAll("[data-camera]"))
  button.onclick = () => {
    view?.setView(button.dataset.camera);
    for (const other of document.querySelectorAll("[data-camera]"))
      other.classList.toggle("active", other === button);
  };
$("#environment-select").onchange = (e) => selectEnvironment(e.target.value);
$("#execute-action").onclick = $("#scene-action").onclick = () => {
  simulation.performNext(selected);
  updateUi();
};
$("#start").onclick = () => {
  simulation.snapshot.cells.find((c) => c.id === selected).mode === "guided"
    ? simulation.performNext(selected)
    : simulation.start();
  updateUi();
};
$("#pause").onclick = () => {
  simulation.stop();
  updateUi();
};
$("#step").onclick = () => {
  simulation.step(0.1, true);
  updateUi();
};
$("#speed").onchange = (e) => {
  simulation.setSpeed(Number(e.target.value));
};
$("#scope").onchange = (e) => {
  simulation.setScope(e.target.value, selected);
  lastEvent = -1;
  updateUi();
};
$("#emergency").onclick = () => {
  simulation.emergencyStop();
  updateUi();
};
$("#acknowledge").onclick = () => {
  simulation.acknowledge();
  updateUi();
};
$("#guard").onchange = (e) => {
  simulation.setGuard(selected, e.target.checked);
  updateUi();
};
$("#fault").onchange = (e) => {
  simulation.setFault(selected, e.target.checked);
  updateUi();
};
$("#new-batch").onclick = () => {
  $("#batch-size").value = String(simulation.snapshot.batch);
  $("#batch-dialog").showModal();
};
$("#cancel-batch").onclick = () => $("#batch-dialog").close();
$("#batch-form").onsubmit = (e) => {
  e.preventDefault();
  simulation.reset(Number($("#batch-size").value));
  lastEvent = -1;
  $("#batch-dialog").close();
  updateUi();
};
$("#zoom-in").onclick = () => view?.zoom(0.85);
$("#zoom-out").onclick = () => view?.zoom(1.15);
$("#retry").onclick = () => location.reload();
$("#report").onclick = () => {
  const state = simulation.snapshot;
  const blob = new Blob(
    [
      JSON.stringify(
        {
          title: "Relatório da simulação logística",
          generatedAt: new Date().toISOString(),
          selectedEnvironment: selected,
          ...state,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "relatorio-logistica.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
try {
  view = createLabScene(
    $("#world"),
    (key) => {
      tab("signals");
      const row = $(`#signal-${key}`);
      row.classList.add("highlight");
      row.scrollIntoView({ block: "nearest" });
      setTimeout(() => row.classList.remove("highlight"), 1200);
    },
    (id, reason) => {
      simulation.haltMotion(id, reason);
      updateUi();
    },
  );
} catch (error) {
  console.error(error);
  $("#render-error").hidden = false;
}
selectEnvironment(selected);
function frame(now) {
  const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 0.1);
  lastTime = now;
  if (!document.hidden) {
    simulation.step(dt);
    const state = simulation.snapshot;
    view?.update(
      state.cells.find((c) => c.id === selected),
      dt,
      state.running,
      state.emergency,
      state.scope,
    );
    view?.render();
    if (view) {
      for (const [i, p] of view.hotspots().entries()) {
        const label = $(`#hotspot-${i}`);
        label.style.left = `${p.x}%`;
        label.style.top = `${p.y}%`;
        label.hidden =
          !p.visible || p.x < 5 || p.x > 95 || p.y < 23 || p.y > 82;
        label.classList.toggle(
          "live",
          state.running &&
            ((i === 0 &&
              state.cells.find((c) => c.id === selected).phase === "feeding") ||
              (i === 1 &&
                state.cells.find((c) => c.id === selected).phase ===
                  "processing") ||
              (i === 2 &&
                state.cells.find((c) => c.id === selected).phase ===
                  "unloading")),
        );
      }
    }
    if (now - lastUi > 100) {
      updateUi();
      lastUi = now;
    }
  }
  requestAnimationFrame(frame);
}
document.addEventListener("visibilitychange", () => {
  lastTime = performance.now();
});
requestAnimationFrame(frame);
