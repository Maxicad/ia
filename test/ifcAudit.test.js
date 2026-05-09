import test from 'node:test';
import assert from 'node:assert/strict';
import { auditFederation, compareValue, federateModels, parseIfc, splitIfcArguments } from '../public/ifcAudit.js';

const sample = `ISO-10303-21;
DATA;
#1=IFCPROJECT('0P1',$,'Projeto Teste',$,$,$,$,$,$);
#2=IFCSITE('0S1',$,'Terreno',$,$,$,$,$,.ELEMENT.);
#3=IFCWALL('0W1',$,'Parede Norte',$,$,$,$,'W-001');
#4=IFCWALL('0W2',$,$,$,$,$,$,'W-002');
ENDSEC;
END-ISO-10303-21;`;

test('splitIfcArguments preserves commas inside strings and nested lists', () => {
  assert.deepEqual(splitIfcArguments("'A,B',(#1,#2),'C'"), ["'A,B'", '(#1,#2)', "'C'"]);
});

test('parseIfc extracts entity counts and project name', () => {
  const model = parseIfc(sample, 'teste.ifc');

  assert.equal(model.fileName, 'teste.ifc');
  assert.equal(model.projectName, 'Projeto Teste');
  assert.equal(model.entityCount, 4);
  assert.equal(model.entityCounts.IFCWALL, 2);
});

test('federateModels consolidates entities from multiple IFC files', () => {
  const modelA = parseIfc(sample, 'arquitetura.ifc');
  const modelB = parseIfc(sample.replaceAll('IFCWALL', 'IFCDOOR'), 'portas.ifc');
  const federation = federateModels([modelA, modelB]);

  assert.equal(federation.modelCount, 2);
  assert.equal(federation.entityCount, 8);
  assert.equal(federation.entityCounts.IFCWALL, 2);
  assert.equal(federation.entityCounts.IFCDOOR, 2);
});

test('auditFederation reports failed criteria with entity samples', () => {
  const federation = federateModels([parseIfc(sample, 'teste.ifc')]);
  const audit = auditFederation(federation, [{
    id: 'wall-name',
    name: 'Paredes com nome',
    description: '',
    severity: 'alta',
    entity: 'IFCWALL',
    property: 'Name',
    operator: 'not_empty',
    expected: '',
  }]);

  assert.equal(audit.score, 0);
  assert.equal(audit.failed, 1);
  assert.equal(audit.results[0].failed, 1);
  assert.equal(audit.results[0].failedEntities[0].stepId, '#4');
});

test('compareValue supports textual operators', () => {
  assert.equal(compareValue('Parede Norte', 'contains', 'norte'), true);
  assert.equal(compareValue('P-001', 'starts_with', 'P-'), true);
  assert.equal(compareValue('Porta', 'equals', 'porta'), true);
  assert.equal(compareValue('', 'not_empty', ''), false);
});
