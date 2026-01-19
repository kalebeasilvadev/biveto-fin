import type { HelpContent } from './types'

export const settingsHelp: HelpContent = {
  pageId: 'settings',
  pageTitle: 'Configurações',
  description: 'Personalize sua experiência no Biveto.',
  sections: [
    {
      title: 'Perfil',
      content: `
Gerencie suas informações pessoais:

- **Nome**: Como você será identificado
- **E-mail**: Usado para login e notificações
- **Foto**: Imagem do seu perfil
- **Telefone**: Para recuperação de conta

*Mantenha seus dados atualizados.*
      `
    },
    {
      title: 'Segurança',
      content: `
Proteja sua conta:

- **Alterar Senha**: Troque sua senha regularmente
- **Autenticação 2FA**: Adicione uma camada extra de segurança
- **Sessões Ativas**: Veja onde sua conta está logada
- **Encerrar Sessões**: Deslogue de outros dispositivos

*Use senhas fortes e únicas.*
      `
    },
    {
      title: 'Notificações',
      content: `
Configure quais alertas receber:

- **E-mail**: Resumos e alertas importantes
- **Push**: Notificações no celular
- **Tipos**: Escolha quais eventos notificar

*Notificações ajudam a manter o controle.*
      `
    },
    {
      title: 'Aparência',
      content: `
Personalize a interface:

- **Tema**: Claro, escuro ou automático
- **Idioma**: Português (Brasil)
- **Moeda**: Real (BRL)

*O tema escuro é mais confortável à noite.*
      `
    }
  ],
  tips: [
    'Ative autenticação em dois fatores',
    'Use o tema escuro para economizar bateria',
    'Configure notificações de vencimento de faturas',
    'Revise suas configurações periodicamente'
  ],
  relatedPages: [
    { title: 'Família', path: '/family' },
    { title: 'Chaves API', path: '/api-keys' },
    { title: 'Dashboard', path: '/' }
  ]
}
