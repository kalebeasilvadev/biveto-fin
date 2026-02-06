# 🎨 Mockup Visual: Interface de Ajuste de Saldo

## 📱 Tela 1: Lista de Cartões com Saldo Negativo

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Biveto                                    👤 Menu  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                     ┃
┃  💳 Cartões de Benefício                           ┃
┃                                                     ┃
┃  💰 Saldo Total: R$ 150,00      [➕ Novo Cartão]  ┃
┃  📊 Recarga Mensal: R$ 1.200,00                    ┃
┃                                                     ┃
┃  ┌───────────────────────────────────────────┐    ┃
┃  │ 🛒 Vale Alimentação Alelo         [ ⋮ ]   │    ┃
┃  ├───────────────────────────────────────────┤    ┃
┃  │ ⚠️  Saldo Negativo                        │    ┃  ← NOVO!
┃  │     Verifique o saldo real no app da      │    ┃
┃  │     operadora e ajuste                    │    ┃
┃  ├───────────────────────────────────────────┤    ┃
┃  │ Saldo disponível                          │    ┃
┃  │ R$ -200,00  ← EM VERMELHO                │    ┃  ← VERMELHO
┃  ├───────────────────────────────────────────┤    ┃
┃  │ 🟢 Alelo  Recarga dia 15  +R$ 600/mês    │    ┃
┃  └───────────────────────────────────────────┘    ┃
┃                                                     ┃
┃  ┌───────────────────────────────────────────┐    ┃
┃  │ 🍴 Vale Refeição Sodexo           [ ⋮ ]   │    ┃
┃  ├───────────────────────────────────────────┤    ┃
┃  │ Saldo disponível                          │    ┃
┃  │ R$ 350,00  ← EM VERDE                    │    ┃  ← VERDE (ok)
┃  ├───────────────────────────────────────────┤    ┃
┃  │ 🔴 Sodexo  Recarga dia 5  +R$ 600/mês    │    ┃
┃  └───────────────────────────────────────────┘    ┃
┃                                                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 🎯 Tela 2: Menu de Contexto

```
Usuário clica em [ ⋮ ] do cartão com saldo negativo:

┌─────────────────────────────┐
│ ✏️  Editar                  │
├─────────────────────────────┤
│ 💵 Ajustar Saldo            │ ← EM ÂMBAR (alerta urgente)
├─────────────────────────────┤
│ 🗑️  Excluir                 │
└─────────────────────────────┘
        ↑
        Opção nova destacada
        quando saldo negativo
```

---

## 📋 Tela 3: Modal de Ajuste de Saldo

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Ajustar Saldo                                    ✕  ┃
┃  Vale Alimentação Alelo                              ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                                                       ┃
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃
┃  ┃ ⚠️  Saldo Negativo Detectado                  ┃  ┃  ← Alerta
┃  ┃                                                ┃  ┃
┃  ┃ O saldo no sistema está negativo. Isso        ┃  ┃
┃  ┃ geralmente indica que houve compras sem       ┃  ┃
┃  ┃ lançamento de recarga, ou erro nos            ┃  ┃
┃  ┃ lançamentos anteriores.                       ┃  ┃
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃
┃                                                       ┃
┃  Saldo Atual no Sistema                              ┃
┃  ┌──────────────────────────────────────────────┐   ┃
┃  │                                              │   ┃
┃  │        R$ -200,00  ← EM VERMELHO            │   ┃
┃  │                                              │   ┃
┃  └──────────────────────────────────────────────┘   ┃
┃                                                       ┃
┃  Saldo Real no Cartão Físico *                       ┃
┃  ┌──────────────────────────────────────────────┐   ┃
┃  │ R$ 400,00                            [limpar]│   ┃  ← INPUT
┃  └──────────────────────────────────────────────┘   ┃
┃  💡 Insira o saldo que aparece no aplicativo da      ┃
┃     operadora (Alelo, Sodexo, etc.)                  ┃
┃                                                       ┃
┃  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┃
┃  ┃ 📈 Ajuste a ser aplicado                      ┃  ┃  ← Calculado
┃  ┃                                                ┃  ┃     auto!
┃  ┃        + R$ 600,00  ← EM AZUL                 ┃  ┃
┃  ┃                                                ┃  ┃
┃  ┃ Adicionará este valor do saldo                ┃  ┃
┃  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  ┃
┃                                                       ┃
┃  Motivo do Ajuste *                                  ┃
┃  ┌──────────────────────────────────────────────┐   ┃
┃  │ Saldo divergente - valor correto          │   ┃
┃  │ verificado no app Alelo                   │   ┃  ← TEXTAREA
┃  │                                           │   ┃
┃  └──────────────────────────────────────────────┘   ┃
┃  Este motivo será registrado para auditoria          ┃
┃                                                       ┃
┃  ┌──────────────────────────────────────────────┐   ┃
┃  │ 👁️ Preview                                   │   ┃  ← Preview
┃  │                                              │   ┃
┃  │  De: R$ -200,00  →  Para: R$ 400,00         │   ┃
┃  └──────────────────────────────────────────────┘   ┃
┃                                                       ┃
┃  💡 Dica: Use o ajuste quando o saldo no sistema     ┃
┃     divergir do saldo real no cartão físico.         ┃
┃                                                       ┃
┃    [ Cancelar ]        [ 💵 Ajustar Saldo ]         ┃
┃                                 ↑                     ┃
┃                          Botão primário               ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## ✨ Tela 4: Durante o Ajuste (Loading)

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  Ajustar Saldo                                    ✕  ┃
┃  Vale Alimentação Alelo                              ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃                          .                            ┃
┃                          .                            ┃
┃                          .                            ┃
┃                                                       ┃
┃    [ Cancelar ]    [ ⏳ Ajustando... ]  ← Loading   ┃
┃                           ↑                           ┃
┃                    Spinner girando                    ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

---

## 🎉 Tela 5: Toast de Sucesso

```
Após ajuste bem-sucedido:

┌─────────────────────────────────────────┐
│ ✅ Saldo ajustado com sucesso!         │  ← Toast verde
│                                         │     no topo
│ De: R$ -200,00                          │
│ Para: R$ 400,00                         │
└─────────────────────────────────────────┘

E o card atualiza automaticamente:

┌───────────────────────────────────────────┐
│ 🛒 Vale Alimentação Alelo         [ ⋮ ]   │
├───────────────────────────────────────────┤
│ Saldo disponível                          │
│ R$ 400,00  ← VERDE AGORA! ✓              │  ← Alerta sumiu
├───────────────────────────────────────────┤
│ 🟢 Alelo  Recarga dia 15  +R$ 600/mês    │
└───────────────────────────────────────────┘
```

---

## 🎨 Cores e Estados Visuais

### **Saldo Positivo (OK)**
```
Cor: Verde (#10B981 / #34D399)
Ícone: Nenhum
Estado: Normal
```

### **Saldo Zero**
```
Cor: Cinza (#6B7280)
Ícone: Nenhum
Estado: Neutro
```

### **Saldo Negativo (ALERTA)**
```
Cor: Vermelho (#DC2626 / #F87171)
Ícone: ⚠️ AlertTriangle
Alerta: Box vermelho claro com mensagem
Botão Menu: "Ajustar Saldo" em âmbar (urgente)
```

---

## 🔄 Interações Dinâmicas

### **Cálculo Automático de Ajuste**

```typescript
// Quando usuário digita no campo "Saldo Real":

Saldo Atual: R$ -200,00
Saldo Desejado: R$ [400,00] ← Usuário digitando
                    ↓
Ajuste = 400 - (-200) = +600
                    ↓
┌────────────────────────────┐
│ 📈 Ajuste a ser aplicado   │
│                            │
│ + R$ 600,00  ← Azul       │ ← Atualiza em tempo real
│                            │
│ Adicionará este valor      │
└────────────────────────────┘
```

### **Preview do Resultado**

```
┌────────────────────────────────────┐
│ 👁️ Preview                         │
│                                    │
│  De: R$ -200,00  →  Para: R$ 400,00│
│       Vermelho        Verde        │
└────────────────────────────────────┘
```

---

## 📱 Fluxo Completo do Usuário

### **Cenário: Saldo Divergente**

**Situação Inicial:**
- Sistema mostra: R$ -200,00
- Cartão físico tem: R$ 400,00 (verificado no app Alelo)

**Passo a Passo:**

1. **Usuário acessa Cartões de Benefício**
   ```
   http://localhost:3000/benefit-cards
   ```

2. **Vê alerta vermelho no card**
   ```
   ⚠️ Saldo Negativo
   Verifique o saldo real no app da operadora e ajuste
   ```

3. **Clica no menu [ ⋮ ]**
   ```
   Opções aparecem:
   - Editar
   - 💵 Ajustar Saldo ← Em âmbar (destaque)
   - Excluir
   ```

4. **Clica em "Ajustar Saldo"**
   ```
   Modal abre com:
   - Alerta explicando o problema
   - Saldo atual em vermelho
   - Campo para inserir saldo real
   ```

5. **Pega o celular e abre app Alelo**
   ```
   App Alelo mostra: R$ 400,00
   ```

6. **Digita R$ 400,00 no campo "Saldo Real"**
   ```
   Sistema calcula automaticamente:

   Ajuste = 400 - (-200) = +600

   Box azul aparece:
   📈 Ajuste a ser aplicado
   + R$ 600,00
   ```

7. **Preenche motivo**
   ```
   "Saldo divergente - verificado no app Alelo"
   ```

8. **Vê preview**
   ```
   De: R$ -200,00 → Para: R$ 400,00
   ```

9. **Clica "Ajustar Saldo"**
   ```
   Botão muda para: [ ⏳ Ajustando... ]
   Spinner aparece
   ```

10. **Backend processa**
    ```
    - Cria transação de ajuste
    - Atualiza account.balance
    - Registra auditoria
    - Retorna sucesso
    ```

11. **Toast de sucesso aparece**
    ```
    ┌─────────────────────────────────┐
    │ ✅ Saldo ajustado com sucesso! │
    │                                 │
    │ De: R$ -200,00                  │
    │ Para: R$ 400,00                 │
    └─────────────────────────────────┘
    ```

12. **Card atualiza automaticamente**
    ```
    Alerta vermelho SOME
    Saldo muda para R$ 400,00 em VERDE
    ```

---

## 🎬 Animações e Transições

### **Aparecimento do Alerta**
```css
Fade in suave (300ms)
Slide down (20px)
```

### **Abertura do Modal**
```css
Background: fade in (200ms)
Modal: scale(0.95) → scale(1) (300ms)
```

### **Cálculo de Ajuste**
```css
Número muda: transition (150ms ease-out)
Cor muda: transition (200ms)
```

### **Botão Loading**
```css
Spinner: rotate infinite (1s linear)
Texto muda: opacity transition (200ms)
```

---

## 🌙 Dark Mode

### **Light Mode**
```
Alerta Negativo:
- Background: #FEF2F2 (red-50)
- Border: #FECACA (red-200)
- Text: #991B1B (red-800)

Ajuste Positivo:
- Background: #EFF6FF (blue-50)
- Border: #BFDBFE (blue-200)
- Text: #1E40AF (blue-800)
```

### **Dark Mode**
```
Alerta Negativo:
- Background: rgba(127, 29, 29, 0.2) (red-900/20)
- Border: #991B1B (red-800)
- Text: #FCA5A5 (red-300)

Ajuste Positivo:
- Background: rgba(30, 58, 138, 0.2) (blue-900/20)
- Border: #1E40AF (blue-800)
- Text: #93C5FD (blue-400)
```

---

## 🧪 Como Testar Agora

### **1. Abrir no Navegador**
```
http://localhost:3000/benefit-cards
```

### **2. Verificar Compilação**
```bash
# Ver logs do Vite
tail -f /private/tmp/claude-501/-Users-kalebeandrade-Dev-geral-biveto-app/tasks/b3c2ee5.output

# Deve mostrar:
# [vite] hmr update /src/pages/BenefitCards.tsx
# ✓ Sem erros
```

### **3. Criar Cartão de Teste**
```
1. Clique "+ Novo Cartão"
2. Preencha:
   - Nome: "Teste Saldo Negativo"
   - Tipo: VA
   - Saldo Inicial: R$ 10,00
3. Salve
```

### **4. Forçar Saldo Negativo**
```
1. Confirme um recibo com valor alto (R$ 100)
2. Use o VA Teste no split payment
3. Saldo ficará: R$ -90,00
4. Veja o alerta vermelho aparecer!
```

### **5. Ajustar Saldo**
```
1. Clique [ ⋮ ] → "Ajustar Saldo"
2. Modal abre
3. Digite R$ 400,00
4. Veja ajuste calculado: +R$ 490,00
5. Escreva motivo
6. Clique "Ajustar Saldo"
7. Veja toast de sucesso
8. Card atualiza para R$ 400,00 verde
```

---

## 📊 Resumo da Implementação

### **Frontend (React/TypeScript)**

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `BalanceAdjustmentModal.tsx` | 250 | Modal de ajuste |
| `balanceAdjustment.schema.ts` | 28 | Validação Zod |
| `BenefitCards.tsx` (modificado) | +35 | Alerta + botão + estado |
| `api.ts` (modificado) | +2 | Endpoint adjustBalance |

### **Backend (Python/FastAPI)**

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `balance_monitor.py` | 180 | Monitor + auditoria |
| `validators.py` | 90 | Validadores |
| `benefit_cards.py` (router) | +60 | Endpoint ajuste |
| `benefit_card.py` (schema) | +15 | Schemas request/response |
| `receipt_service.py` (modificado) | +20 | Integração monitor |

### **Total**
- **Frontend:** +315 linhas (4 arquivos)
- **Backend:** +365 linhas (5 arquivos)
- **Total:** 680 linhas de código novo

---

## 🎯 Funcionalidades Entregues

✅ **Alerta Visual** - Saldo negativo em vermelho com ícone
✅ **Explicação Clara** - Mensagem orientando o usuário
✅ **Botão Destacado** - "Ajustar Saldo" em âmbar quando urgente
✅ **Modal Intuitivo** - Formulário guiado passo a passo
✅ **Cálculo Automático** - Ajuste calculado em tempo real
✅ **Preview** - Usuário vê resultado antes de confirmar
✅ **Validação** - Zod schema com mensagens em português
✅ **Auditoria** - Cada ajuste registrado com transação
✅ **Toast Feedback** - Confirmação visual de sucesso
✅ **Auto-Update** - React Query invalida cache
✅ **Dark Mode** - Totalmente suportado
✅ **Responsivo** - Mobile e desktop
✅ **Acessível** - Labels, ARIA, navegação por teclado

---

## 🎊 Status Final

**Frontend:** ✅ Compilando sem erros
**Backend:** ✅ Servidor rodando
**Hot Reload:** ✅ Atualizando automaticamente
**Endpoint:** ✅ `/api/v1/benefit-cards/{id}/adjust-balance`

**Pronto para usar em:** http://localhost:3000/benefit-cards
