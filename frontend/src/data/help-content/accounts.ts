import type { HelpContent } from './types'

export const accountsHelp: HelpContent = {
  pageId: 'accounts',
  pageTitle: 'Contas',
  description: 'Gerencie suas contas bancárias, carteiras e investimentos.',
  sections: [
    {
      title: 'Tipos de Conta',
      content: `
O Biveto suporta diferentes tipos de conta:

- **Carteira**: Dinheiro em espécie
- **Conta Corrente**: Conta bancária comum
- **Conta Poupança**: Conta poupança
- **Investimento**: Aplicações e investimentos

*Cada tipo tem um ícone diferente para fácil identificação.*
      `
    },
    {
      title: 'Saldo das Contas',
      content: `
O saldo de cada conta é calculado automaticamente baseado nas transações.

- **Saldo Inicial**: Valor que você define ao criar a conta
- **Saldo Atual**: Saldo inicial + receitas - despesas

*O saldo total aparece no topo, somando todas as contas.*
      `
    },
    {
      title: 'Cores e Organização',
      content: `
Personalize suas contas com cores diferentes.

As cores ajudam a identificar rapidamente a conta em:
- Lista de transações
- Formulários de cadastro
- Gráficos e relatórios
      `
    },
    {
      title: 'Propriedade da Conta',
      content: `
Em famílias, cada conta pode pertencer a um membro específico ou ser compartilhada.

- **Pessoal**: Só o dono vê e gerencia
- **Compartilhada**: Todos os membros da família podem ver

*Útil para organizar finanças individuais e conjuntas.*
      `
    }
  ],
  tips: [
    'Crie contas separadas para melhor controle',
    'Use cores diferentes para cada banco',
    'Mantenha o saldo inicial atualizado'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Cartões', path: '/credit-cards' },
    { title: 'Família', path: '/family' }
  ]
}
