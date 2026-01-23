import type { HelpContent } from './types'

export const incomeSplitRulesHelp: HelpContent = {
  pageId: 'income-split-rules',
  pageTitle: 'Divisao de Receitas',
  description: 'Configure regras para dividir automaticamente suas receitas em categorias como dizimo, poupanca ou investimentos.',
  sections: [
    {
      title: 'Como Funciona',
      content: `
Ao receber uma receita (salario, freelance, etc.), voce pode configurar **deducoes automaticas**:

1. **Crie regras** com nome e porcentagem (ou valor fixo)
2. **Ao criar uma receita**, selecione quais regras aplicar
3. O sistema cria **despesas pendentes** vinculadas

*Exemplo: Receita de R$ 5.000 com dizimo de 10% = Despesa de R$ 500 (pendente)*
      `
    },
    {
      title: 'Tipos de Divisao',
      content: `
Voce pode configurar dois tipos de divisao:

- **Porcentagem**: Calcula sobre o valor da receita (ex: 10% do salario)
- **Valor Fixo**: Sempre o mesmo valor, independente da receita (ex: R$ 300)

*Use porcentagem para valores proporcionais e fixo para compromissos mensais.*
      `
    },
    {
      title: 'Despesas Geradas',
      content: `
As divisoes criam **despesas automaticas**:

- Vinculadas a receita original
- Na categoria configurada (ex: Dizimo/Ofertas)
- Ja marcadas como pagas (dinheiro comprometido)

*As despesas aparecem no mesmo dia da receita e afetam o saldo imediatamente.*
      `
    },
    {
      title: 'Exemplos de Uso',
      content: `
Regras comuns que usuarios configuram:

- **Dizimo**: 10% para contribuicoes religiosas
- **Poupanca**: 20% para reserva de emergencia
- **Investimentos**: 15% para aplicacoes financeiras
- **Reserva**: Valor fixo mensal para objetivos

*Baseado no metodo 50-30-20 de organizacao financeira.*
      `
    }
  ],
  tips: [
    'Comece com poucas regras e ajuste conforme necessario',
    'A soma das porcentagens nao precisa ser 100%',
    'Ative/desative regras temporariamente sem excluir',
    'As despesas sao criadas na mesma conta da receita'
  ],
  relatedPages: [
    { title: 'Fontes de Receita', path: '/income-sources' },
    { title: 'Transacoes', path: '/transactions' },
    { title: 'Orcamento', path: '/budget' },
    { title: 'Recorrentes', path: '/recurring' }
  ]
}
