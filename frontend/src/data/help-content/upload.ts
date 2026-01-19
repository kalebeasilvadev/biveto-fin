import type { HelpContent } from './types'

export const uploadHelp: HelpContent = {
  pageId: 'upload',
  pageTitle: 'Adicionar Transação',
  description: 'Adicione transações manualmente ou por foto/PDF.',
  sections: [
    {
      title: 'Formas de Adicionar',
      content: `
Você pode adicionar transações de três formas:

- **Manual**: Preencha os campos um a um
- **Foto**: Tire foto de cupom/nota fiscal
- **PDF**: Envie extrato bancário ou fatura

*A opção por foto/PDF usa inteligência artificial para extrair os dados.*
      `
    },
    {
      title: 'Upload de Foto',
      content: `
Para adicionar por foto:

1. Clique em "Foto" ou "Câmera"
2. Tire foto ou selecione da galeria
3. Aguarde a extração automática
4. Revise e confirme os dados

*Funciona melhor com fotos bem iluminadas e legíveis.*
      `
    },
    {
      title: 'Upload de PDF',
      content: `
Para adicionar por PDF:

1. Clique em "PDF"
2. Selecione o arquivo
3. O sistema extrai as transações
4. Revise cada transação antes de salvar

*Suporta extratos de vários bancos e faturas de cartão.*
      `
    },
    {
      title: 'Tratamento de Duplicatas',
      content: `
O sistema detecta possíveis duplicatas:

- Mesma data, valor e descrição similar
- Você escolhe manter ou descartar
- Duplicatas não são criadas automaticamente

*Revise sempre antes de confirmar o upload.*
      `
    }
  ],
  tips: [
    'Use foto para notas fiscais e cupons',
    'Use PDF para extratos bancários mensais',
    'Revise categorias sugeridas antes de salvar',
    'Mantenha fotos bem enquadradas e legíveis'
  ],
  relatedPages: [
    { title: 'Transações', path: '/transactions' },
    { title: 'Contas', path: '/accounts' },
    { title: 'Cartões', path: '/credit-cards' }
  ]
}
