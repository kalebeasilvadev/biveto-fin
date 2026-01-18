# Documentacao de Stores

## Visao Geral

O frontend utiliza **Zustand** para gerenciamento de estado global. As stores sao organizadas por dominio e algumas utilizam persistencia via localStorage.

## Arquitetura

```
stores/
├── authStore.ts              # Autenticacao e sessao
├── toastStore.ts             # Notificacoes toast
├── themeStore.ts             # Tema claro/escuro
├── pwaStore.ts               # Estado de instalacao PWA
└── quickTransactionStore.ts  # Modal de transacao rapida
```

---

## authStore

Store principal de autenticacao e sessao do usuario.

### Estado

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `user` | `User \| null` | Usuario logado |
| `accessToken` | `string \| null` | Token JWT de acesso |
| `refreshToken` | `string \| null` | Token de refresh |
| `isAuthenticated` | `boolean` | Se esta autenticado |
| `isRefreshing` | `boolean` | Se esta renovando token |

### Acoes

```typescript
// Definir usuario
setUser(user: User | null)

// Definir tokens
setTokens(accessToken: string, refreshToken: string)

// Logout (limpa tudo)
logout()
```

### Metodos Auxiliares

```typescript
// Verifica se access token expirou (com buffer de 30s)
isTokenExpired(): boolean

// Verifica se refresh token expirou (com buffer de 60s)
isRefreshTokenExpired(): boolean

// Verifica se tem sessao valida
hasValidSession(): boolean
```

### Persistencia

- **Storage Key**: `auth-storage`
- **Campos Persistidos**: `user`, `accessToken`, `refreshToken`
- **Partialize**: Sim (nao persiste `isRefreshing`)

### Uso

```tsx
import { useAuthStore } from '@/stores/authStore';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div>
      <p>Ola, {user?.name}!</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

### Selectors (Performance)

```tsx
// Evita re-renders desnecessarios usando selectors
const user = useAuthStore((state) => state.user);
const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
```

---

## toastStore

Store para gerenciamento de notificacoes toast.

### Estado

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `toasts` | `Toast[]` | Lista de toasts ativos |

### Interface Toast

```typescript
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;  // ms, default 5000
}
```

### Acoes

```typescript
// Adiciona toast generico
addToast(toast: Omit<Toast, 'id'>)

// Remove toast por ID
removeToast(id: string)

// Helpers tipados
success(message: string, duration?: number)
error(message: string, duration?: number)
warning(message: string, duration?: number)
info(message: string, duration?: number)
```

### Uso

```tsx
import { useToastStore } from '@/stores/toastStore';

function MyComponent() {
  const { success, error } = useToastStore();

  const handleSave = async () => {
    try {
      await saveData();
      success('Dados salvos com sucesso!');
    } catch (err) {
      error('Erro ao salvar dados');
    }
  };

  return <button onClick={handleSave}>Salvar</button>;
}
```

### Duracao Padrao

- Default: 5000ms (5 segundos)
- Customizavel por toast

### Auto-Dismiss

Toasts sao removidos automaticamente apos a duracao configurada via `setTimeout` no momento da adicao.

---

## themeStore

Store para gerenciamento de tema da aplicacao.

### Estado

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `theme` | `'light' \| 'dark' \| 'system'` | Tema atual |

### Acoes

```typescript
// Define tema especifico
setTheme(theme: 'light' | 'dark' | 'system')

// Alterna entre light e dark
toggleTheme()
```

### Persistencia

- **Storage Key**: `biveto-theme`
- **Campos Persistidos**: `theme`

### Comportamento

1. **Inicializacao**: Carrega tema do localStorage ou usa 'system'
2. **System Theme**: Detecta preferencia do sistema via `prefers-color-scheme`
3. **CSS Class**: Adiciona/remove classe `dark` no `<html>`

### Uso

```tsx
import { useThemeStore } from '@/stores/themeStore';

function ThemeToggle() {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  return (
    <div>
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
        <option value="system">Sistema</option>
      </select>

      <button onClick={toggleTheme}>
        Alternar Tema
      </button>
    </div>
  );
}
```

### Integracao com Tailwind

```css
/* Estilos condicionais */
.card {
  @apply bg-white dark:bg-gray-800;
}
```

---

## pwaStore

Store para gerenciamento do estado de instalacao da PWA.

### Estado

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `installPromptEvent` | `BeforeInstallPromptEvent \| null` | Evento de instalacao |
| `isInstalled` | `boolean` | Se a app esta instalada |
| `isDismissed` | `boolean` | Se o banner foi dispensado |
| `hasEngagement` | `boolean` | Se usuario engajou suficiente |

### Acoes

```typescript
// Armazena evento de instalacao
setInstallPromptEvent(event: BeforeInstallPromptEvent | null)

// Marca como instalado
setIsInstalled(installed: boolean)

// Dispensa banner (por 14 dias)
dismissBanner()

// Marca engajamento
setHasEngagement(engaged: boolean)

// Dispara prompt de instalacao
promptInstall(): Promise<void>
```

### Persistencia

O `isDismissed` e armazenado no localStorage com timestamp para expirar em 14 dias.

### Fluxo de Instalacao

```
1. Usuario visita app
2. Browser dispara 'beforeinstallprompt'
3. Store captura evento
4. Apos engajamento (2 visitas + 30s), mostra banner
5. Usuario clica "Instalar"
6. promptInstall() dispara evento.prompt()
7. Usuario aceita/recusa
8. Atualiza isInstalled
```

### Uso com Hook

```tsx
import { usePWAInstall } from '@/hooks/usePWAInstall';

function InstallBanner() {
  const {
    showBanner,
    promptInstall,
    dismissBanner,
    isIOS
  } = usePWAInstall();

  if (!showBanner) return null;

  if (isIOS) {
    return <IOSInstallModal onDismiss={dismissBanner} />;
  }

  return (
    <div>
      <p>Instale o Biveto!</p>
      <button onClick={promptInstall}>Instalar</button>
      <button onClick={dismissBanner}>Depois</button>
    </div>
  );
}
```

---

## quickTransactionStore

Store para controlar o modal de criacao rapida de transacoes.

### Estado

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `isOpen` | `boolean` | Se o modal esta aberto |

### Acoes

```typescript
// Abre o modal
open()

// Fecha o modal
close()
```

### Uso

```tsx
import { useQuickTransactionStore } from '@/stores/quickTransactionStore';

function MyComponent() {
  const openQuickTransaction = useQuickTransactionStore((state) => state.open);

  return (
    <button onClick={openQuickTransaction}>
      Nova Transacao
    </button>
  );
}
```

### Integracao

O modal e controlado globalmente pelo `Layout.tsx` e pode ser aberto de qualquer lugar:
- Botao "+" no mobile (bottom nav)
- Botao "Nova Transacao" na pagina de Transacoes (desktop)

---

## Boas Praticas

### 1. Selectors para Performance

```tsx
// Ruim - re-render em qualquer mudanca
const store = useAuthStore();

// Bom - re-render apenas quando user muda
const user = useAuthStore((state) => state.user);
```

### 2. Acoes Fora de Componentes

```tsx
// Em services/api.ts
import { useAuthStore } from '@/stores/authStore';

// Acesso direto ao estado
const { accessToken } = useAuthStore.getState();

// Chamada de acoes
useAuthStore.getState().logout();
```

### 3. Tipagem

```tsx
// Tipo do estado
type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

// Tipo das acoes
type AuthActions = {
  setUser: (user: User | null) => void;
  logout: () => void;
};

// Store tipada
type AuthStore = AuthState & AuthActions;
```

### 4. Middleware de Persistencia

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useMyStore = create(
  persist(
    (set) => ({
      data: null,
      setData: (data) => set({ data }),
    }),
    {
      name: 'my-storage-key',
      partialize: (state) => ({ data: state.data }), // campos a persistir
    }
  )
);
```

---

## Debugging

### Zustand DevTools

```tsx
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set) => ({ ... }),
    { name: 'MyStore' }
  )
);
```

### Logging de Mudancas

```tsx
const useStore = create((set) => ({
  data: null,
  setData: (data) => {
    console.log('setData called:', data);
    set({ data });
  },
}));
```
