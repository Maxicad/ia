import { DEFAULT_CRITERIA, auditFederation, federateModels, parseIfc } from './ifcAudit.js';

const state = {
  models: [],
  criteria: structuredClone(DEFAULT_CRITERIA),
  federation: federateModels([]),
  audit: null,
};

const elements = {
  fileInput: document.querySelector('#ifc-files'),
  criteriaForm: document.querySelector('#criteria-form'),
  criteriaList: document.querySelector('#criteria-list'),
  modelsList: document.querySelector('#models-list'),
  entityChart: document.querySelector('#entity-chart'),
  auditTable: document.querySelector('#audit-table tbody'),
  score: document.querySelector('#score'),
  modelCount: document.querySelector('#model-count'),
  entityCount: document.querySelector('#entity-count'),
  issueCount: document.querySelector('#issue-count'),
  reportDate: document.querySelector('#report-date'),
  emptyState: document.querySelector('#empty-state'),
  dashboard: document.querySelector('#dashboard'),
  exportJson: document.querySelector('#export-json'),
  exportCsv: document.querySelector('#export-csv'),
  sampleButton: document.querySelector('#load-sample'),
};

elements.fileInput.addEventListener('change', handleFiles);
elements.criteriaForm.addEventListener('submit', addCriterion);
elements.exportJson.addEventListener('click', exportJsonReport);
elements.exportCsv.addEventListener('click', exportCsvReport);
elements.sampleButton.addEventListener('click', loadSampleModels);

document.querySelector('#reset-data').addEventListener('click', () => {
  state.models = [];
  state.audit = null;
  refresh();
});

renderCriteria();
refresh();

async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  const parsedModels = await Promise.all(files.map(async (file) => parseIfc(await file.text(), file.name)));
  state.models.push(...parsedModels);
  event.target.value = '';
  refresh();
}

function addCriterion(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const criterion = {
    id: `criterio-${Date.now()}`,
    name: String(form.get('name') || '').trim(),
    description: String(form.get('description') || '').trim(),
    severity: String(form.get('severity') || 'media'),
    entity: String(form.get('entity') || '').trim().toUpperCase(),
    property: String(form.get('property') || '').trim(),
    operator: String(form.get('operator') || 'not_empty'),
    expected: String(form.get('expected') || '').trim(),
  };

  if (!criterion.name || !criterion.entity) return;
  state.criteria.push(criterion);
  event.currentTarget.reset();
  renderCriteria();
  refresh();
}

function removeCriterion(id) {
  state.criteria = state.criteria.filter((criterion) => criterion.id !== id);
  renderCriteria();
  refresh();
}

function refresh() {
  state.federation = federateModels(state.models);
  state.audit = auditFederation(state.federation, state.criteria);
  renderModels();
  renderDashboard();
}

function renderCriteria() {
  elements.criteriaList.innerHTML = state.criteria.map((criterion) => `
    <article class="criterion-card">
      <div>
        <strong>${escapeHtml(criterion.name)}</strong>
        <p>${escapeHtml(criterion.description || describeCriterion(criterion))}</p>
        <span>${escapeHtml(criterion.entity)} ${criterion.property ? `• ${escapeHtml(criterion.property)}` : ''} • ${labelOperator(criterion.operator)}</span>
      </div>
      <button class="ghost danger" data-remove="${criterion.id}" aria-label="Remover ${escapeHtml(criterion.name)}">Remover</button>
    </article>
  `).join('');

  elements.criteriaList.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => removeCriterion(button.dataset.remove));
  });
}

function renderModels() {
  if (state.models.length === 0) {
    elements.modelsList.innerHTML = '<li>Nenhum IFC carregado. Importe arquivos ou use os exemplos.</li>';
    return;
  }

  elements.modelsList.innerHTML = state.models.map((model) => `
    <li>
      <strong>${escapeHtml(model.fileName)}</strong>
      <span>${escapeHtml(model.projectName)} • ${model.entityCount} entidades • ${model.sizeKb} KB</span>
    </li>
  `).join('');
}

function renderDashboard() {
  const hasData = state.models.length > 0;
  elements.emptyState.hidden = hasData;
  elements.dashboard.hidden = !hasData;

  elements.score.textContent = `${state.audit.score}%`;
  elements.modelCount.textContent = state.federation.modelCount;
  elements.entityCount.textContent = state.federation.entityCount;
  elements.issueCount.textContent = state.audit.failed + state.audit.warnings;
  elements.reportDate.textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.audit.auditedAt));

  renderEntityChart();
  renderAuditTable();
}

function renderEntityChart() {
  const counts = Object.entries(state.federation.entityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const max = Math.max(...counts.map(([, count]) => count), 1);

  elements.entityChart.innerHTML = counts.map(([type, count]) => `
    <div class="bar-row">
      <span>${escapeHtml(type)}</span>
      <div class="bar-track"><div class="bar" style="width:${(count / max) * 100}%"></div></div>
      <strong>${count}</strong>
    </div>
  `).join('') || '<p>Sem entidades IFC identificadas.</p>';
}

function renderAuditTable() {
  elements.auditTable.innerHTML = state.audit.results.map((result) => `
    <tr>
      <td><span class="status ${result.status}">${result.status}</span></td>
      <td><strong>${escapeHtml(result.name)}</strong><br><small>${escapeHtml(result.description || describeCriterion(result))}</small></td>
      <td>${escapeHtml(result.severity)}</td>
      <td>${escapeHtml(result.entity)}</td>
      <td>${result.evaluated}</td>
      <td>${escapeHtml(result.message)}${renderFailedEntities(result.failedEntities)}</td>
    </tr>
  `).join('');
}

function renderFailedEntities(entities) {
  if (!entities.length) return '';
  return `<details><summary>Ver amostras</summary><ul>${entities.map((entity) => `
    <li>${escapeHtml(entity.fileName)} • ${escapeHtml(entity.stepId)} • ${escapeHtml(entity.name)} ${entity.actual ? `(${escapeHtml(entity.actual)})` : ''}</li>
  `).join('')}</ul></details>`;
}

function exportJsonReport() {
  download('relatorio-auditoria-ifc.json', JSON.stringify(buildReport(), null, 2), 'application/json');
}

function exportCsvReport() {
  const rows = [
    ['Status', 'Critério', 'Severidade', 'Entidade', 'Avaliados', 'Falhas', 'Mensagem'],
    ...state.audit.results.map((result) => [result.status, result.name, result.severity, result.entity, result.evaluated, result.failed, result.message]),
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
  download('relatorio-auditoria-ifc.csv', csv, 'text/csv');
}

function buildReport() {
  return {
    resumo: {
      pontuacao: state.audit.score,
      modelos: state.federation.modelCount,
      entidades: state.federation.entityCount,
      criterios: state.audit.total,
      aprovados: state.audit.passed,
      reprovados: state.audit.failed,
      atencao: state.audit.warnings,
      auditadoEm: state.audit.auditedAt,
    },
    modelos: state.models.map(({ entities, ...model }) => model),
    contagemEntidades: state.federation.entityCounts,
    resultados: state.audit.results,
  };
}

function download(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function loadSampleModels() {
  const samples = [
    `ISO-10303-21;\nDATA;\n#1=IFCPROJECT('0P1',$,'Hospital BIM',$,$,$,$,$,$);\n#2=IFCSITE('0S1',$,'Terreno A',$,$,$,$,$,.ELEMENT.);\n#3=IFCWALL('0W1',$,'Parede externa',$,$,$,$,'W-001');\n#4=IFCSPACE('0SP1',$,'Recepção',$,$,$,$,'Sala',$);\nENDSEC;\nEND-ISO-10303-21;`,
    `ISO-10303-21;\nDATA;\n#10=IFCPROJECT('1P1',$,'Hospital BIM - Estrutural',$,$,$,$,$,$);\n#11=IFCBUILDING('1B1',$,'Bloco A',$,$,$,$,$,.ELEMENT.);\n#12=IFCCOLUMN('1C1',$,'Pilar P01',$,$,$,$,'C-001');\n#13=IFCWALL('1W1',$,$,$,$,$,$,'W-SEM-NOME');\nENDSEC;\nEND-ISO-10303-21;`,
  ];
  state.models.push(...samples.map((sample, index) => parseIfc(sample, `exemplo-${index + 1}.ifc`)));
  refresh();
}

function labelOperator(operator) {
  return {
    exists: 'existe',
    not_empty: 'preenchido',
    equals: 'igual a',
    contains: 'contém',
    starts_with: 'começa com',
  }[operator] || operator;
}

function describeCriterion(criterion) {
  return `${criterion.entity}.${criterion.property || '*'} deve ${labelOperator(criterion.operator)} ${criterion.expected || ''}`.trim();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }[char]));
}
