# Documentacao de Componentes

## Visao Geral

O frontend esta organizado em componentes reutilizaveis divididos em categorias:
- **Layout**: Estrutura principal da aplicacao
- **Shared**: Componentes genericos reutilizaveis
- **Credit Cards**: Componentes especificos de cartao de credito
- **Upload**: Componentes do fluxo de upload de documentos
- **Feature**: Componentes de funcionalidades especificas

---

## Layout Components

### Layout.tsx
Componente principal que envolve todas as paginas protegidas.

**Responsabilidades:**
- Sidebar de navegacao
- Header com usuario logado
- Menu mobile responsivo
- Tema claro/escuro
- Logout

**Uso:**
```tsx
// Automaticamente aplicado via App.tsx para rotas protegidas
<Layout>
  <Dashboard />
</Layout>
```

---

## Shared Components

### BankSelector.tsx
Dropdown para selecao de banco brasileiro.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `value` | `string \| null` | Sim | Banco selecionado |
| `onChange` | `(bankId: string) => void` | Sim | Callback de mudanca |
| `disabled` | `boolean` | Nao | Desabilita selecao |

**Uso:**
```tsx
<BankSelector
  value={selectedBank}
  onChange={setSelectedBank}
/>
```

---

### BankLogo.tsx
Exibe logo do banco com fallback.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `bankId` | `string` | Sim | ID do banco |
| `size` | `'sm' \| 'md' \| 'lg'` | Nao | Tamanho (default: md) |
| `className` | `string` | Nao | Classes adicionais |

**Uso:**
```tsx
<BankLogo bankId="nubank" size="lg" />
```

---

### CardBrandLogo.tsx
Exibe logo da bandeira do cartao.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `brand` | `string` | Sim | Bandeira (visa, mastercard, etc.) |
| `size` | `'sm' \| 'md' \| 'lg'` | Nao | Tamanho |
| `className` | `string` | Nao | Classes adicionais |

**Bandeiras Suportadas:**
- visa, mastercard, elo, amex, hipercard, diners

---

### ConfirmDialog.tsx
Modal de confirmacao para acoes destrutivas.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `isOpen` | `boolean` | Sim | Controla visibilidade |
| `onClose` | `() => void` | Sim | Callback ao fechar |
| `onConfirm` | `() => void` | Sim | Callback ao confirmar |
| `title` | `string` | Sim | Titulo do dialog |
| `message` | `string` | Sim | Mensagem de confirmacao |
| `confirmText` | `string` | Nao | Texto do botao (default: "Confirmar") |
| `cancelText` | `string` | Nao | Texto do cancelar (default: "Cancelar") |
| `variant` | `'danger' \| 'warning'` | Nao | Estilo visual |

**Uso:**
```tsx
<ConfirmDialog
  isOpen={showDelete}
  onClose={() => setShowDelete(false)}
  onConfirm={handleDelete}
  title="Excluir transacao"
  message="Tem certeza que deseja excluir esta transacao?"
  variant="danger"
/>
```

---

### CurrencyInput.tsx
Input formatado para valores monetarios em BRL.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `value` | `number` | Sim | Valor numerico |
| `onChange` | `(value: number) => void` | Sim | Callback de mudanca |
| `placeholder` | `string` | Nao | Placeholder |
| `disabled` | `boolean` | Nao | Desabilita input |
| `className` | `string` | Nao | Classes adicionais |

**Comportamento:**
- Formata automaticamente com R$ e separadores
- Aceita entrada de centavos
- Converte string formatada para numero

**Uso:**
```tsx
<CurrencyInput
  value={amount}
  onChange={setAmount}
  placeholder="R$ 0,00"
/>
```

---

### OwnershipSelector.tsx
Seletor de tipo de propriedade (pessoal vs familia).

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `value` | `'personal' \| 'household'` | Sim | Valor selecionado |
| `onChange` | `(value: string) => void` | Sim | Callback de mudanca |
| `disabled` | `boolean` | Nao | Desabilita selecao |
| `showHousehold` | `boolean` | Nao | Mostra opcao household |

**Uso:**
```tsx
<OwnershipSelector
  value={ownership}
  onChange={setOwnership}
  showHousehold={hasFamily}
/>
```

---

### ToastContainer.tsx
Container para exibicao de notificacoes toast.

**Uso:**
```tsx
// Em App.tsx (ja configurado)
<ToastContainer />
```

**Disparando Toasts (via toastStore):**
```tsx
import { useToastStore } from '@/stores/toastStore';

const { success, error, warning, info } = useToastStore();

success('Transacao criada com sucesso!');
error('Erro ao processar documento');
warning('Voce atingiu o limite de cartoes');
info('Nova fatura disponivel');
```

---

## Credit Card Components

### CardTemplateSelector.tsx
Seletor visual de templates de cartao de credito.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `onSelect` | `(template: CardTemplate) => void` | Sim | Callback ao selecionar |
| `selectedBank` | `string \| null` | Nao | Filtra por banco |

**Comportamento:**
- Exibe templates pre-definidos de cartoes
- Filtra por banco selecionado
- Preenche automaticamente dados do cartao

---

### CreditCardModal.tsx
Modal completo para criacao/edicao de cartao de credito.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `isOpen` | `boolean` | Sim | Controla visibilidade |
| `onClose` | `() => void` | Sim | Callback ao fechar |
| `card` | `CreditCard \| null` | Nao | Cartao para edicao |
| `onSuccess` | `() => void` | Nao | Callback apos salvar |

**Campos:**
- Nome do cartao
- Banco emissor
- Bandeira
- Limite de credito
- Dia de fechamento
- Dia de vencimento
- Programa de pontos
- Cor do cartao
- Tipo de propriedade

---

## Upload Components

### UploadSelector.tsx
Seletor do metodo de upload de documento.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `onFileSelect` | `(file: File) => void` | Sim | Callback ao selecionar arquivo |
| `onCameraSelect` | `() => void` | Sim | Callback para abrir camera |

**Metodos de Upload:**
- Arrastar e soltar arquivo
- Selecionar do dispositivo
- Capturar com camera (mobile)

---

### CameraCapture.tsx
Captura de foto via camera do dispositivo.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `onCapture` | `(file: File) => void` | Sim | Callback ao capturar |
| `onCancel` | `() => void` | Sim | Callback ao cancelar |

**Funcionalidades:**
- Preview da camera
- Botao de captura
- Confirmacao antes de enviar
- Suporte a camera frontal/traseira

---

### TransactionForm.tsx
Formulario de transacao manual ou edicao.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `onSubmit` | `(data: TransactionFormData) => void` | Sim | Callback ao submeter |
| `initialData` | `TransactionFormData` | Nao | Dados iniciais |
| `accounts` | `Account[]` | Sim | Lista de contas |
| `categories` | `Category[]` | Sim | Lista de categorias |
| `creditCards` | `CreditCard[]` | Nao | Lista de cartoes |

**Campos:**
- Tipo (receita/despesa)
- Valor
- Data
- Descricao
- Conta
- Categoria
- Cartao de credito (se aplicavel)
- Parcelamento
- Tags

---

### ExtractedItemsList.tsx
Lista de itens extraidos de documento para confirmacao.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `items` | `ExtractedItem[]` | Sim | Itens extraidos |
| `onConfirm` | `(items: ExtractedItem[]) => void` | Sim | Callback ao confirmar |
| `onEdit` | `(item: ExtractedItem) => void` | Nao | Callback para editar item |
| `cardInfo` | `CardInfo \| null` | Nao | Info do cartao detectado |

**Funcionalidades:**
- Selecao multipla de itens
- Edicao individual
- Deteccao de duplicatas
- Deteccao de recorrentes
- Vinculacao com cartao
- Confirmacao em lote

---

## Feature Components

### FloatingAssistant.tsx
Botao flutuante do assistente financeiro IA.

**Comportamento:**
- Botao fixo no canto inferior direito
- Abre chat com assistente
- Mostra sugestoes de perguntas
- Historico de conversa

---

### QuickTransactionModal.tsx
Modal rapido para adicionar transacao (despesa, receita ou transferencia).

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `isOpen` | `boolean` | Sim | Controla visibilidade |
| `onClose` | `() => void` | Sim | Callback ao fechar |

**Tipos de Transacao:**
- `expense` - Despesa (vermelho)
- `income` - Receita (verde)
- `transfer` - Transferencia entre contas (azul)

**Transferencias:**
- Permite transferir entre contas do tipo: `wallet`, `bank`, `investment`
- Cartoes de credito (`credit_card`) NAO aparecem nas opcoes
- Seleciona conta de origem ("De") e conta de destino ("Para")

**Acesso:**
- Mobile: Botao "+" na barra de navegacao inferior
- Desktop: Botao "Nova Transacao" na pagina de Transacoes

**State Management:**
Controlado via `quickTransactionStore` (Zustand) para acesso global.

---

### EmptyState.tsx
Componente para estados vazios.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `icon` | `LucideIcon` | Sim | Icone a exibir |
| `title` | `string` | Sim | Titulo |
| `description` | `string` | Nao | Descricao adicional |
| `action` | `ReactNode` | Nao | Botao de acao |

**Uso:**
```tsx
<EmptyState
  icon={Wallet}
  title="Nenhuma conta cadastrada"
  description="Adicione sua primeira conta para comecar"
  action={<Button onClick={openModal}>Adicionar Conta</Button>}
/>
```

---

### LoadingButton.tsx
Botao com estado de loading.

**Props:**
| Prop | Tipo | Obrigatorio | Descricao |
|------|------|-------------|-----------|
| `loading` | `boolean` | Sim | Estado de loading |
| `children` | `ReactNode` | Sim | Conteudo do botao |
| `disabled` | `boolean` | Nao | Desabilita botao |
| `...rest` | `ButtonProps` | - | Props do button HTML |

**Uso:**
```tsx
<LoadingButton
  loading={isSubmitting}
  onClick={handleSubmit}
>
  Salvar
</LoadingButton>
```

---

### InstallPromptBanner.tsx
Banner para instalacao da PWA.

**Comportamento:**
- Aparece apos 2 visitas e 30s na pagina
- Pode ser dispensado (volta em 14 dias)
- Detecta se ja esta instalado
- Instrucoes especificas para iOS

---

### IOSInstallModal.tsx
Modal com instrucoes de instalacao para iOS.

**Comportamento:**
- Detecta Safari no iOS
- Mostra passo a passo visual
- Botao "Adicionar a Tela Inicial"

---

## Padroes de Componentes

### Convencoes de Nomenclatura
- Componentes: PascalCase (`BankSelector.tsx`)
- Props interfaces: `{Component}Props`
- Handlers: `handle{Action}` ou `on{Action}`

### Estrutura de Arquivo
```tsx
// 1. Imports
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Types
interface MyComponentProps {
  value: string;
  onChange: (value: string) => void;
}

// 3. Component
export function MyComponent({ value, onChange }: MyComponentProps) {
  // 3.1 Hooks
  const [state, setState] = useState('');

  // 3.2 Handlers
  const handleClick = () => { ... };

  // 3.3 Render
  return ( ... );
}
```

### Estilizacao
- Tailwind CSS para todos os estilos
- `clsx` ou `cn()` para classes condicionais
- Variaveis de tema via CSS custom properties
- Suporte a dark mode com `dark:` prefix
