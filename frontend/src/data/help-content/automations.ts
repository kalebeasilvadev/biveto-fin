import type { HelpContent } from './types'

export const automationsHelp: HelpContent = {
  pageId: 'automations',
  pageTitle: 'Automações',
  description: 'Configure regras para automatizar tarefas repetitivas.',
  sections: [
    {
      title: 'O que são Automações',
      content: `
Automações executam ações automaticamente quando certas condições são atendidas:

- **Trigger**: O que dispara a automação
- **Condições**: Filtros adicionais
- **Ação**: O que acontece automaticamente

*Exemplo: Categorizar automaticamente transações do Uber como "Transporte".*
      `
    },
    {
      title: 'Tipos de Triggers',
      content: `
Eventos que podem disparar automações:

- **Nova Transação**: Quando uma transação é criada
- **Transação Editada**: Quando uma transação é modificada
- **Data Específica**: Em determinado dia/horário
- **Saldo Baixo**: Quando conta atinge valor mínimo

*Cada trigger tem condições específicas.*
      `
    },
    {
      title: 'Ações Disponíveis',
      content: `
O que as automações podem fazer:

- **Categorizar**: Definir categoria automaticamente
- **Notificar**: Enviar alerta ou e-mail
- **Mover**: Transferir para outra conta
- **Marcar**: Adicionar tags ou flags

*Múltiplas ações podem ser combinadas.*
      `
    },
    {
      title: 'Criar uma Automação',
      content: `
Passo a passo:

1. Clique em "Nova Automação"
2. Escolha o trigger
3. Defina as condições (ex: descrição contém "Uber")
4. Selecione a ação (ex: categoria = Transporte)
5. Ative a automação

*Teste com transações existentes antes de ativar.*
      `
    }
  ],
  tips: [
    'Comece com regras simples e específicas',
    'Use automações para categorização consistente',
    'Revise automações que não estão funcionando',
    'Cuidado com regras muito amplas'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Recorrentes', path: '/recurring' },
    { title: 'Orçamento', path: '/budget' }
  ]
}
