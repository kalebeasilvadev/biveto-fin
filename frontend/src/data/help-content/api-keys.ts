import type { HelpContent } from './types'

export const apiKeysHelp: HelpContent = {
  pageId: 'api-keys',
  pageTitle: 'Chaves de API',
  description: 'Gerencie integrações com outros sistemas.',
  sections: [
    {
      title: 'O que são Chaves de API',
      content: `
Chaves de API permitem que outros sistemas acessem seus dados:

- **Automações**: Integre com Zapier, Make, etc.
- **Apps**: Conecte aplicativos de terceiros
- **Scripts**: Crie suas próprias integrações

*Cada chave tem permissões específicas.*
      `
    },
    {
      title: 'Criar Nova Chave',
      content: `
Para criar uma chave:

1. Clique em "Nova Chave"
2. Dê um nome descritivo (ex: "Zapier Automação")
3. Selecione as permissões necessárias
4. Copie a chave gerada imediatamente

*A chave só é exibida uma vez. Guarde em local seguro.*
      `
    },
    {
      title: 'Permissões',
      content: `
Defina o que cada chave pode fazer:

- **Leitura**: Apenas consultar dados
- **Escrita**: Criar e modificar transações
- **Exclusão**: Remover dados
- **Admin**: Acesso total

*Use o mínimo de permissões necessárias.*
      `
    },
    {
      title: 'Segurança',
      content: `
Boas práticas com chaves de API:

- Nunca compartilhe suas chaves
- Revogue chaves não utilizadas
- Use nomes descritivos para identificar uso
- Monitore atividade suspeita

*Se uma chave for comprometida, revogue imediatamente.*
      `
    }
  ],
  tips: [
    'Crie chaves separadas para cada integração',
    'Use permissões de leitura quando possível',
    'Revogue chaves de integrações desativadas',
    'Guarde as chaves em gerenciador de senhas'
  ],
  relatedPages: [
    { title: 'Configurações', path: '/settings' },
    { title: 'Automações', path: '/automations' }
  ]
}
