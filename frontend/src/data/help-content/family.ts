import type { HelpContent } from './types'

export const familyHelp: HelpContent = {
  pageId: 'family',
  pageTitle: 'Família',
  description: 'Gerencie finanças em conjunto com sua família.',
  sections: [
    {
      title: 'Como Funciona',
      content: `
O modo família permite:

- Compartilhar dados financeiros com membros
- Cada um mantém suas contas pessoais
- Visualizar gastos da família como um todo
- Definir orçamentos conjuntos

*Ideal para casais, famílias ou grupos que dividem despesas.*
      `
    },
    {
      title: 'Convidar Membros',
      content: `
Para adicionar alguém à família:

1. Clique em "Convidar Membro"
2. Insira o e-mail da pessoa
3. Ela receberá um convite por e-mail
4. Ao aceitar, entra na família

*A pessoa precisa ter conta no Biveto.*
      `
    },
    {
      title: 'Papéis e Permissões',
      content: `
Cada membro pode ter um papel:

- **Administrador**: Controle total, pode remover membros
- **Membro**: Pode ver e adicionar transações
- **Visualizador**: Apenas visualiza dados

*O criador da família é sempre administrador.*
      `
    },
    {
      title: 'Contas Pessoais vs Compartilhadas',
      content: `
Você pode ter dois tipos de conta:

- **Pessoal**: Só você vê e gerencia
- **Compartilhada**: Toda família pode ver

*Útil para separar gastos pessoais de conjuntos.*
      `
    }
  ],
  tips: [
    'Defina regras claras sobre gastos compartilhados',
    'Use contas compartilhadas para despesas da casa',
    'Mantenha uma conta pessoal para gastos individuais',
    'Revise as permissões de cada membro'
  ],
  relatedPages: [
    { title: 'Contas', path: '/accounts' },
    { title: 'Orçamento', path: '/budget' },
    { title: 'Configurações', path: '/settings' }
  ]
}
