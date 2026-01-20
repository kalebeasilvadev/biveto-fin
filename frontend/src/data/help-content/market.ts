import type { HelpContent } from './types'

export const marketHelp: HelpContent = {
  pageId: 'market',
  pageTitle: 'Mercado',
  description: 'Controle detalhado dos seus gastos de supermercado.',
  sections: [
    {
      title: 'O que é o Mercado',
      content: `
O Mercado permite rastrear e analisar seus gastos de supermercado de forma detalhada.

Principais funcionalidades:
- **Histórico de compras**: Veja todos os itens comprados
- **Categorização**: Produtos organizados por tipo (laticínios, carnes, limpeza, etc.)
- **Análise de necessidade**: Separe itens essenciais de supérfluos
- **Comparação mensal**: Compare gastos entre meses
      `
    },
    {
      title: 'Dashboard',
      content: `
O painel principal mostra um resumo do mês:

- **Total gasto**: Soma de todas as compras do mês
- **Essencial vs Supérfluo**: Quanto foi gasto em necessidades básicas vs itens dispensáveis
- **Por categoria**: Distribuição dos gastos (frutas, carnes, bebidas, etc.)
- **Listas ativas**: Suas listas de compras em andamento

*Use as setas para navegar entre meses.*
      `
    },
    {
      title: 'Listas de Compras',
      content: `
Crie e gerencie listas de compras compartilhadas com sua família:

- **Nova Lista**: Crie uma lista manual
- **Gerar do Histórico**: IA cria lista baseada nas suas compras anteriores
- **Marcar itens**: Toque no item para marcar como comprado
- **Compartilhamento**: Todos do household veem e editam as listas

*Listas completadas são arquivadas automaticamente.*
      `
    },
    {
      title: 'Histórico de Compras',
      content: `
Visualize todas as compras de supermercado:

- **Busca**: Encontre produtos específicos
- **Filtros**: Filtre por categoria ou período
- **Detalhes**: Veja quantidade, preço unitário e total

*Compras são registradas automaticamente ao confirmar cupons fiscais.*
      `
    },
    {
      title: 'Análise e Insights',
      content: `
A aba de análise oferece:

- **Economia potencial**: Quanto você pode economizar reduzindo supérfluos
- **Itens mais caros**: Produtos que mais pesam no orçamento
- **Itens frequentes**: O que você compra com mais frequência
- **Tendências**: Compare com meses anteriores

*Os insights ajudam a identificar onde economizar.*
      `
    },
    {
      title: 'Essencial vs Supérfluo',
      content: `
Cada produto é classificado:

**Essencial** (necessidades básicas):
- Arroz, feijão, leite, ovos, pão
- Frutas e verduras
- Produtos de higiene básica
- Itens de limpeza essenciais

**Supérfluo** (dispensáveis):
- Refrigerantes, cervejas, energéticos
- Chocolates, doces, salgadinhos
- Produtos premium ou gourmet

*Essa classificação ajuda a entender seus hábitos de consumo.*
      `
    },
    {
      title: 'Integração com Cupom Fiscal',
      content: `
Ao fazer upload de um cupom fiscal na tela de Upload:

1. Os itens são extraídos automaticamente
2. Cada produto é classificado por categoria
3. A necessidade (essencial/supérfluo) é identificada
4. Ao confirmar, os dados vão para o Mercado

*Quanto mais cupons você enviar, mais precisas serão as análises.*
      `
    }
  ],
  tips: [
    'Envie cupons fiscais regularmente para ter dados precisos',
    'Use a lista gerada por IA para não esquecer itens frequentes',
    'Monitore o percentual de supérfluos para economizar',
    'Compare gastos mensais para identificar variações',
    'Compartilhe listas com a família para compras coordenadas'
  ],
  relatedPages: [
    { title: 'Upload', path: '/upload' },
    { title: 'Transações', path: '/transactions' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Família', path: '/family' }
  ]
}
