export const DEFAULT_CRITERIA = [
  {
    id: 'project-present',
    name: 'Projeto identificado',
    description: 'Verifica se o arquivo possui uma entidade IFCPROJECT.',
    severity: 'alta',
    entity: 'IFCPROJECT',
    property: '',
    operator: 'exists',
    expected: '',
  },
  {
    id: 'site-present',
    name: 'Terreno identificado',
    description: 'Verifica se há pelo menos uma entidade IFCSITE.',
    severity: 'media',
    entity: 'IFCSITE',
    property: '',
    operator: 'exists',
    expected: '',
  },
  {
    id: 'wall-name',
    name: 'Paredes com nome',
    description: 'Verifica se objetos IFCWALL possuem Name preenchido.',
    severity: 'media',
    entity: 'IFCWALL',
    property: 'Name',
    operator: 'not_empty',
    expected: '',
  },
  {
    id: 'space-name',
    name: 'Ambientes com nome',
    description: 'Verifica se objetos IFCSPACE possuem Name preenchido.',
    severity: 'alta',
    entity: 'IFCSPACE',
    property: 'Name',
    operator: 'not_empty',
    expected: '',
  },
];

export const IFC_ATTRIBUTE_MAP = {
  IFCPROJECT: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'LongName', 'Phase', 'RepresentationContexts', 'UnitsInContext'],
  IFCSITE: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'LongName', 'CompositionType'],
  IFCBUILDING: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'LongName', 'CompositionType'],
  IFCBUILDINGSTOREY: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'LongName', 'CompositionType', 'Elevation'],
  IFCSPACE: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'LongName', 'CompositionType'],
  IFCWALL: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag'],
  IFCWALLSTANDARDCASE: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag'],
  IFCDOOR: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag', 'OverallHeight', 'OverallWidth'],
  IFCWINDOW: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag', 'OverallHeight', 'OverallWidth'],
  IFCBEAM: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag'],
  IFCCOLUMN: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag'],
  IFCSLAB: ['GlobalId', 'OwnerHistory', 'Name', 'Description', 'ObjectType', 'ObjectPlacement', 'Representation', 'Tag', 'PredefinedType'],
};

const ENTITY_PATTERN = /#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([^;]*)\);/gims;

export function parseIfc(content, fileName = 'modelo.ifc') {
  const entities = [];
  const entityCounts = {};
  let match;

  while ((match = ENTITY_PATTERN.exec(content)) !== null) {
    const [, stepId, rawType, rawArgs] = match;
    const type = rawType.toUpperCase();
    const args = splitIfcArguments(rawArgs).map(cleanIfcValue);
    const attributes = mapAttributes(type, args);

    entities.push({
      stepId: `#${stepId}`,
      type,
      args,
      attributes,
      displayName: attributes.Name || attributes.LongName || attributes.GlobalId || `#${stepId}`,
    });
    entityCounts[type] = (entityCounts[type] || 0) + 1;
  }

  const project = entities.find((entity) => entity.type === 'IFCPROJECT');
  const sizeKb = Math.max(1, Math.round(new Blob([content]).size / 1024));

  return {
    id: cryptoRandomId(fileName),
    fileName,
    projectName: project?.attributes?.Name || 'Projeto não identificado',
    entityCount: entities.length,
    entityCounts,
    entities,
    sizeKb,
    importedAt: new Date().toISOString(),
  };
}

export function splitIfcArguments(rawArgs) {
  const values = [];
  let current = '';
  let depth = 0;
  let inString = false;

  for (let index = 0; index < rawArgs.length; index += 1) {
    const char = rawArgs[index];
    const next = rawArgs[index + 1];

    if (char === "'") {
      current += char;
      if (inString && next === "'") {
        current += next;
        index += 1;
      } else {
        inString = !inString;
      }
      continue;
    }

    if (!inString) {
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        values.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim() !== '') values.push(current.trim());
  return values;
}

export function cleanIfcValue(value) {
  if (value === undefined || value === null) return '';
  const trimmed = String(value).trim();
  if (trimmed === '$' || trimmed === '*') return '';
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

export function mapAttributes(type, args) {
  const names = IFC_ATTRIBUTE_MAP[type] || [];
  return args.reduce((attributes, value, index) => {
    attributes[names[index] || `arg${index + 1}`] = value;
    return attributes;
  }, {});
}

export function federateModels(models) {
  const entityCounts = {};
  const entities = [];

  models.forEach((model) => {
    Object.entries(model.entityCounts).forEach(([type, count]) => {
      entityCounts[type] = (entityCounts[type] || 0) + count;
    });
    model.entities.forEach((entity) => {
      entities.push({ ...entity, modelId: model.id, fileName: model.fileName });
    });
  });

  return {
    modelCount: models.length,
    entityCount: entities.length,
    entityCounts,
    entities,
    generatedAt: new Date().toISOString(),
  };
}

export function auditFederation(federation, criteria) {
  const results = criteria.map((criterion) => evaluateCriterion(federation.entities, criterion));
  const passed = results.filter((result) => result.status === 'aprovado').length;
  const failed = results.filter((result) => result.status === 'reprovado').length;
  const warnings = results.filter((result) => result.status === 'atenção').length;
  const score = results.length === 0 ? 0 : Math.round((passed / results.length) * 100);

  return {
    score,
    passed,
    failed,
    warnings,
    total: results.length,
    results,
    auditedAt: new Date().toISOString(),
  };
}

export function evaluateCriterion(entities, criterion) {
  const targetType = criterion.entity.trim().toUpperCase();
  const matches = targetType ? entities.filter((entity) => entity.type === targetType) : entities;
  const failedEntities = [];
  let status = 'aprovado';
  let message = '';

  if (criterion.operator === 'exists') {
    status = matches.length > 0 ? 'aprovado' : 'reprovado';
    message = status === 'aprovado' ? `${matches.length} ocorrência(s) encontrada(s).` : 'Nenhuma ocorrência encontrada.';
  } else {
    matches.forEach((entity) => {
      const actual = entity.attributes[criterion.property] || '';
      if (!compareValue(actual, criterion.operator, criterion.expected)) {
        failedEntities.push(entity);
      }
    });

    if (matches.length === 0) {
      status = 'atenção';
      message = `Nenhuma entidade ${targetType || 'IFC'} encontrada para avaliação.`;
    } else if (failedEntities.length > 0) {
      status = 'reprovado';
      message = `${failedEntities.length} de ${matches.length} entidade(s) não atendem ao critério.`;
    } else {
      message = `${matches.length} entidade(s) avaliadas com sucesso.`;
    }
  }

  return {
    ...criterion,
    status,
    evaluated: matches.length,
    failed: failedEntities.length,
    message,
    failedEntities: failedEntities.slice(0, 25).map((entity) => ({
      stepId: entity.stepId,
      type: entity.type,
      name: entity.displayName,
      fileName: entity.fileName,
      actual: entity.attributes[criterion.property] || '',
    })),
  };
}

export function compareValue(actual, operator, expected) {
  const normalizedActual = String(actual || '').trim();
  const normalizedExpected = String(expected || '').trim();

  switch (operator) {
    case 'not_empty':
      return normalizedActual.length > 0;
    case 'equals':
      return normalizedActual.toLowerCase() === normalizedExpected.toLowerCase();
    case 'contains':
      return normalizedActual.toLowerCase().includes(normalizedExpected.toLowerCase());
    case 'starts_with':
      return normalizedActual.toLowerCase().startsWith(normalizedExpected.toLowerCase());
    case 'exists':
      return true;
    default:
      return false;
  }
}

function cryptoRandomId(seed) {
  const randomPart = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${seed.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomPart}`;
}
