# IFC Audit Dashboard

Sistema web para auditoria de dados de arquivos IFC a partir de uma lista de critérios configuráveis. A aplicação permite carregar múltiplos arquivos IFC, consolidar as entidades em um modelo federado e gerar um relatório em formato de dashboard com indicadores de conformidade.

## Funcionalidades

- Importação de um ou mais arquivos `.ifc` diretamente no navegador.
- Criação de federação com contagem consolidada de entidades IFC por tipo.
- Lista inicial de critérios para projeto, terreno, paredes e ambientes.
- Cadastro de novos critérios por entidade IFC, atributo, operador e severidade.
- Dashboard com pontuação, quantidade de modelos, entidades e pendências.
- Tabela detalhada de resultados com amostras de entidades reprovadas.
- Exportação do relatório de auditoria em JSON e CSV.
- Dados de exemplo para demonstração rápida.

## Como executar

```bash
npm start
```

Acesse `http://localhost:4173` no navegador.

## Como testar

```bash
npm test
```

## Observações técnicas

O parser implementado é leve e focado em auditoria textual de entidades e atributos IFC frequentes. Ele não substitui um motor geométrico BIM completo, mas atende ao fluxo de verificação de dados, consolidação e relatório solicitado.
