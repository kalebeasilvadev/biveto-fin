# Documento de Negócio — App PF de Controle Financeiro Inteligente (Mobile + Web)

> **Objetivo**: criar um produto profissional, robusto e amigável que transforme **foto/PDF** (cupom fiscal, nota fiscal, comprovante de pagamento, extrato/fatura) em **lançamentos financeiros com 1 toque**, e entregue **métricas analíticas explicadas** + recomendações acionáveis para reduzir custos e melhorar hábitos.

---

## 1) Visão do produto
Um app para **pessoa física** que:
- simplifica o registro de gastos/receitas ao máximo (**capturar → sugerir → confirmar**);
- gera **painéis ricos em informação**, focados em *clareza* e *decisão*;
- recomenda ações com **cálculos e justificativas** (sem “achismo”).

### Norte do produto (princípios)
1) **Fricção mínima** no lançamento (o usuário não deve “trabalhar” para registrar).
2) **Explicabilidade** (qualquer recomendação precisa dizer “por quê” e “quanto impacta”).
3) **Confiabilidade** (score por campo + correção fácil).
4) **Leveza operacional** (evitar processamento caro; usar regras e cache antes de IA pesada).
5) **Privacidade por padrão** (dados financeiros são sensíveis).

---

## 2) Problema e oportunidade
### Problemas comuns do usuário PF
- Registrar manualmente é demorado e vira abandono.
- Mesmo quando registra, faltam **insights claros** (o que mudou? onde apertar?).
- Pequenos gastos recorrentes (“vazamentos”) passam despercebidos.
- Baixa previsibilidade e pouca margem no mês.

### Por que “document-driven” (foto/PDF) é diferencial
- É o que o usuário já tem em mãos (cupom, fatura, comprovante).
- Reduz a barreira do “tenho que preencher tudo”.

---

## 3) Fundamentação (boas práticas validadas → funcionalidades)
Este projeto incorpora princípios amplamente recomendados em educação financeira:

### 3.1 Controle e planejamento (anotar receitas e despesas)
- Controle e planejamento, incluindo **anotar receitas e despesas**, ajudam a organizar e alcançar objetivos “ao menor custo possível”. (Banco Central do Brasil — Caderno de Educação Financeira / Gestão de Finanças Pessoais)

**Como vira feature**
- “Diagnóstico 30 dias” (relatório automático ao final do período).
- Metas simples (ex.: “reduzir categoria X em 10%”) com acompanhamento semanal.

### 3.2 Acompanhar gastos por período suficiente (evitar visão enviesada)
- A CFPB recomenda rastrear gastos por um período que pode ser **um mês**, para enxergar padrões e despesas pequenas que somam.

**Como vira feature**
- Indicador de “cobertura do mês” (% de dias com registro; % de gastos via documento).
- Alertas de lacunas (ex.: “faltam lançamentos do cartão X nos últimos 7 dias”).

### 3.3 Resiliência financeira (capacidade de enfrentar choques)
- Relatórios G20/OECD-INFE tratam resiliência financeira como capacidade de lidar com choques, conectada a bem-estar, inclusão e alfabetização financeira.

**Como vira feature**
- Metrificação de **margem mensal** (receita - despesas) e **reserva** (configurável pelo usuário).
- Recomendações focadas em aumentar margem e previsibilidade.

---

## 4) Público-alvo (PF) e personas
1) **Analítico**: ama gráficos, tendências, comparações e explicações.
2) **Prático**: quer “1 toque” e pronto.
3) **Sob pressão**: precisa reduzir gastos e controlar recorrências (assinaturas, juros).
4) **Gestor do lar**: organiza despesas da casa/família (mesmo sem ser “PJ”).

---

## 5) Escopo do produto (o que entrega)
### 5.1 Funções principais
- Captura de documento por **foto** e **upload** (imagem/PDF).
- Extração automática: **valor, data, estabelecimento**, itens (quando possível), método de pagamento, parcelas/taxas (quando houver).
- Sugestão de **categoria**, tags e “fixo vs variável”.
- Confirmação rápida (preferencialmente **1 toque**).
- Dashboards: categorias, estabelecimentos, recorrência, comparativos (mês vs média).
- Recomendações: vazamentos, drivers de aumento, oportunidades de corte, renegociação/assinaturas, antecipação **somente com desconto explícito**.
- Exportação (CSV/Excel), histórico e auditoria.

### 5.2 Fora do escopo inicial (para evitar inchaço)
- Open Finance/importadores complexos (OFX, etc.) no MVP.
- Consultas automáticas em portais fiscais (por captcha/limites legais).
- “IA que movimenta dinheiro”: o app **recomenda**, mas não executa ações financeiras.

---

## 6) Requisitos de telas (Frontend) — amigável, profissional e “1 toque”
> Requisito-chave: **o lançamento deve ser mais rápido que abrir o app do banco**.

### 6.1 Diretrizes de UX/UI
- **Fluxos curtos**: 3 passos no máximo para lançar (capturar → revisar → confirmar).
- **Componentes grandes** (thumb-friendly): botões e campos pensados para celular.
- **Progressive disclosure**: mostrar o essencial primeiro; detalhes colapsados.
- **Confiança por campo**: exibir o que está “OK” e pedir toque só no que está incerto.
- **Consistência**: mesmas categorias/cores/ícones em todas as telas.
- **Acessibilidade**: contraste, fontes escaláveis, suporte a leitores de tela.

### 6.2 Mapa de telas (MVP)
1) **Onboarding**
   - objetivo do app, privacidade, permissões (câmera/arquivos), escolha de moeda/idioma.
2) **Home / Dashboard**
   - visão do mês: gasto total, margem estimada, top categorias, alertas.
3) **Ação principal: “Adicionar”**
   - opções: Foto / Upload PDF / Manual rápido.
4) **Captura (câmera)**
   - guia de enquadramento, detecção de borda, flash, multi-página (opcional).
5) **Fila de processamento**
   - status “Processando…” + tempo estimado *sem travar o usuário*.
6) **Revisão (Cartão 1 toque)**
   - campos principais: **Valor | Categoria | Conta**
   - demais: data, merchant, tags, parcelas, observações (colapsados).
7) **Lista de transações**
   - filtros por período/categoria/conta/merchant.
8) **Detalhe da transação**
   - auditoria (o que foi extraído vs o que foi editado).
9) **Insights**
   - “o que mudou”, “drivers”, “vazamentos”, recomendações com cálculo.
10) **Configurações**
   - contas/cartões, categorias, exportação, privacidade, retenção de documentos.

### 6.3 Telas (V1/V2)
- **Orçamento por categoria** (teto mensal + projeção).
- **Recorrências/assinaturas** (detecção e gestão).
- **Metas** (poupança/controle).
- **Relatório mensal** (PDF/compartilhar).

---

## 7) Requisitos não funcionais
### 7.1 Segurança e privacidade
- Criptografia em trânsito e em repouso.
- Segregação total por usuário (zero vazamento).
- Controles de retenção: apagar documentos e resultados de extração.
- Logs sem dados sensíveis (somente IDs e eventos).

### 7.2 Qualidade e confiança
- Score de confiança por campo; “human-in-the-loop” obrigatório.
- Auditoria: histórico de alterações para o usuário entender e confiar.

### 7.3 Performance e leveza (minimizar consumo de infra)
- Processamento assíncrono (API leve).
- Pré-processamento local (compressão, recorte, rotação).
- Cache por hash do documento (dedupe).
- Regras primeiro; IA/LLM só quando necessário.

---

## 8) Critérios de aceite (produto)
- **Tempo de lançamento**: “foto → lançamento confirmado” em poucos segundos na maioria dos casos.
- **Taxa de 1-toque**: % de lançamentos confirmados sem editar (meta evolutiva).
- **Insight útil**: todo insight precisa ter *ação sugerida* e *cálculo de impacto*.
- **Zero travamentos** no upload/processamento (fila e estados claros).

---

## 9) Roadmap (por valor)
### MVP
- Captura + extração básica (valor/data/merchant) + revisão 1 toque
- Categorias + dashboard mensal simples
- Lista de transações + export

### V1
- Recorrências/assinaturas
- Diagnóstico 30 dias
- Recomendações explicadas (top 3 do mês)

### V2
- Itens do cupom (quando disponível)
- Detecção de anomalias e previsões
- Personalização avançada por hábitos

---

## 10) Riscos e mitigação
- **OCR/extração falha** → score por campo + revisão fácil + fallback manual rápido.
- **Abandono por complexidade** → “1 toque” como regra; detalhes sempre opcionais.
- **Privacidade** → controles e transparência; apagar documentos a qualquer momento.
- **Custo cresce com IA** → orçamentos por usuário e política “IA só quando agrega”.

---

## 11) Referências (links em bloco de código)
```text
[BCB] Caderno de Educação Financeira — Gestão de Finanças Pessoais (Banco Central do Brasil) — turn0search4
[BCB] Orçamento Pessoal / Como fazer orçamento (Banco Central do Brasil) — turn0search0 / turn0search8 / turn0search12
[CFPB] Spending tracker / Track your spending (Consumer Financial Protection Bureau) — turn0search1 / turn0search16 / turn0search9
[OECD] G20/OECD-INFE report on financial resilience (PDF) — turn0search2 / turn0search10
[OECD] G20 policy note on financial well-being (PDF) — turn0search6
[NFe] Portal NF-e — chave de acesso 44 dígitos (consulta) — turn0search3
```

