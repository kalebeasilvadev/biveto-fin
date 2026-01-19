# Backlog #1: Sistema de Alertas e Notificações

## Status: 📋 Planejado

## Descrição

Sistema completo de notificações que alerta usuários sobre eventos financeiros importantes em tempo oportuno, através de múltiplos canais (in-app, push, email).

## Infraestrutura Atual

| Componente | Status | Localização |
|------------|--------|-------------|
| Email Service | 80% | `backend/app/core/services/email_service.py` |
| Push Notifications | 20% | `frontend/public/sw.js:379-396` |
| Task Scheduler | 0% | Celery instalado mas não configurado |
| DB Models | 0% | Não existem tabelas |
| Toast UI | 80% | `frontend/src/stores/toastStore.ts` |

## Especificação Técnica

### Novas Tabelas

#### 1. notifications

```python
class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Conteúdo
    type: Mapped[str] = mapped_column(String(50))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(20))

    # Prioridade
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low/normal/high/urgent

    # Referências
    entity_type: Mapped[str | None] = mapped_column(String(50))  # invoice/budget/goal/etc
    entity_id: Mapped[int | None]
    action_url: Mapped[str | None] = mapped_column(String(500))
    action_label: Mapped[str | None] = mapped_column(String(100))

    # Status
    is_read: Mapped[bool] = mapped_column(default=False)
    read_at: Mapped[datetime | None]
    is_dismissed: Mapped[bool] = mapped_column(default=False)
    dismissed_at: Mapped[datetime | None]

    # Canais
    sent_in_app: Mapped[bool] = mapped_column(default=False)
    sent_email: Mapped[bool] = mapped_column(default=False)
    sent_push: Mapped[bool] = mapped_column(default=False)

    # Agendamento
    scheduled_for: Mapped[datetime | None]
    sent_at: Mapped[datetime | None]

    # Metadados
    metadata: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(default=func.now())

    __table_args__ = (
        Index('ix_notifications_user_read', 'user_id', 'is_read'),
        Index('ix_notifications_user_type', 'user_id', 'type'),
        Index('ix_notifications_scheduled', 'scheduled_for'),
    )
```

#### 2. notification_preferences

```python
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    notification_type: Mapped[str] = mapped_column(String(50))

    # Canais
    in_app_enabled: Mapped[bool] = mapped_column(default=True)
    email_enabled: Mapped[bool] = mapped_column(default=True)
    push_enabled: Mapped[bool] = mapped_column(default=True)

    # Frequência
    frequency: Mapped[str] = mapped_column(String(20), default="immediate")
    # immediate/daily_digest/weekly_digest/disabled

    # Customização
    custom_threshold: Mapped[Decimal | None]  # Para alertas de limite
    days_before: Mapped[int | None]  # Para alertas de vencimento

    __table_args__ = (
        UniqueConstraint('user_id', 'notification_type'),
    )
```

#### 3. notification_settings

```python
class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    # Horário silencioso
    quiet_hours_enabled: Mapped[bool] = mapped_column(default=False)
    quiet_hours_start: Mapped[time | None]  # Ex: 22:00
    quiet_hours_end: Mapped[time | None]    # Ex: 07:00

    # Timezone
    timezone: Mapped[str] = mapped_column(String(50), default="America/Sao_Paulo")

    # Digest
    digest_enabled: Mapped[bool] = mapped_column(default=True)
    digest_frequency: Mapped[str] = mapped_column(String(20), default="daily")
    digest_time: Mapped[time] = mapped_column(default=time(9, 0))

    # Global
    email_unsubscribed: Mapped[bool] = mapped_column(default=False)
    push_enabled: Mapped[bool] = mapped_column(default=True)
```

#### 4. push_subscriptions

```python
class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # Web Push API
    endpoint: Mapped[str] = mapped_column(String(500))
    p256dh_key: Mapped[str] = mapped_column(String(200))
    auth_key: Mapped[str] = mapped_column(String(100))

    # Metadados
    user_agent: Mapped[str | None] = mapped_column(String(500))
    device_name: Mapped[str | None] = mapped_column(String(100))

    # Status
    is_active: Mapped[bool] = mapped_column(default=True)
    failed_count: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    last_used_at: Mapped[datetime | None]
```

### Tipos de Alertas

```python
class NotificationType(str, Enum):
    # Faturas de Cartão
    INVOICE_DUE_7_DAYS = "invoice_due_7_days"
    INVOICE_DUE_3_DAYS = "invoice_due_3_days"
    INVOICE_DUE_1_DAY = "invoice_due_1_day"
    INVOICE_OVERDUE = "invoice_overdue"

    # Orçamento
    BUDGET_WARNING_80 = "budget_warning_80"
    BUDGET_EXCEEDED = "budget_exceeded"

    # Cartão de Crédito
    CREDIT_LIMIT_80 = "credit_limit_80"
    CREDIT_LIMIT_EXCEEDED = "credit_limit_exceeded"

    # Metas
    GOAL_MILESTONE_25 = "goal_milestone_25"
    GOAL_MILESTONE_50 = "goal_milestone_50"
    GOAL_MILESTONE_75 = "goal_milestone_75"
    GOAL_ACHIEVED = "goal_achieved"

    # Recorrências
    RECURRING_DUE_TOMORROW = "recurring_due_tomorrow"

    # Saldo
    BALANCE_LOW = "balance_low"
    BALANCE_NEGATIVE_RISK = "balance_negative_risk"

    # Sistema
    WEEKLY_DIGEST = "weekly_digest"
    DAILY_DIGEST = "daily_digest"
```

### Estrutura do Módulo

```
backend/app/modules/notifications/
├── __init__.py
├── models/
│   ├── __init__.py
│   ├── notification.py
│   ├── preference.py
│   └── push_subscription.py
├── schemas/
│   ├── __init__.py
│   ├── notification.py
│   ├── preference.py
│   └── push.py
├── routers/
│   ├── __init__.py
│   ├── notifications.py
│   ├── preferences.py
│   └── push.py
├── services/
│   ├── __init__.py
│   ├── notification_service.py
│   ├── push_service.py
│   ├── alert_engine.py
│   └── digest_service.py
└── tasks/
    ├── __init__.py
    ├── alert_tasks.py
    ├── delivery_tasks.py
    └── digest_tasks.py
```

### Configuração Celery

```python
# backend/app/core/celery_config.py
from celery import Celery
from celery.schedules import crontab

celery_app = Celery("biveto")

celery_app.conf.beat_schedule = {
    "check-invoice-due-dates": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_invoice_due_dates",
        "schedule": crontab(hour=8, minute=0),
    },
    "check-budget-thresholds": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_budget_thresholds",
        "schedule": crontab(hour="*/6", minute=15),
    },
    "check-credit-card-limits": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_credit_card_limits",
        "schedule": crontab(hour="*/6", minute=30),
    },
    "check-goal-milestones": {
        "task": "app.modules.notifications.tasks.alert_tasks.check_goal_milestones",
        "schedule": crontab(hour="9,18", minute=0),
    },
    "send-daily-digests": {
        "task": "app.modules.notifications.tasks.digest_tasks.send_daily_digests",
        "schedule": crontab(hour=9, minute=0),
    },
    "send-weekly-digests": {
        "task": "app.modules.notifications.tasks.digest_tasks.send_weekly_digests",
        "schedule": crontab(day_of_week=1, hour=9, minute=0),
    },
}
```

### API Endpoints

```
GET    /api/v1/notifications                    # Lista notificações
GET    /api/v1/notifications/unread-count       # Contagem de não lidas
POST   /api/v1/notifications/{id}/read          # Marcar como lida
POST   /api/v1/notifications/read-all           # Marcar todas como lidas
DELETE /api/v1/notifications/{id}               # Dispensar notificação

GET    /api/v1/notifications/preferences        # Listar preferências
PUT    /api/v1/notifications/preferences/{type} # Atualizar preferência
GET    /api/v1/notifications/settings           # Configurações globais
PUT    /api/v1/notifications/settings           # Atualizar configurações

GET    /api/v1/notifications/push/vapid-key     # Chave pública VAPID
POST   /api/v1/notifications/push/subscribe     # Inscrever para push
POST   /api/v1/notifications/push/unsubscribe   # Cancelar inscrição
```

### Frontend Components

```
frontend/src/components/notifications/
├── NotificationBell.tsx          # Ícone com badge no header
├── NotificationCenter.tsx        # Dropdown com lista
├── NotificationItem.tsx          # Item individual
├── NotificationPreferences.tsx   # Página de configurações
└── PushPermissionBanner.tsx      # Banner para solicitar permissão
```

### Dependências

```txt
# requirements.txt
celery>=5.3.0
redis>=5.0.0
pywebpush>=1.14.0
```

## Fases de Implementação

### Fase 1 (Semana 1-2): Foundation
- [ ] Criar migrations para tabelas
- [ ] Implementar models
- [ ] Criar NotificationService básico (CRUD)
- [ ] Frontend: NotificationBell + NotificationCenter

### Fase 2 (Semana 2-3): Alert Engine
- [ ] Implementar AlertEngine
- [ ] Detectores: invoice, budget, credit, goal, balance
- [ ] Integração com modelos existentes

### Fase 3 (Semana 3-4): Email Delivery
- [ ] Criar templates de email para cada tipo
- [ ] Implementar delivery service
- [ ] Estender email_service.py existente

### Fase 4 (Semana 4-5): Celery Setup
- [ ] Configurar Celery + Redis
- [ ] Implementar periodic tasks
- [ ] Criar worker scripts

### Fase 5 (Semana 5-6): Web Push
- [ ] Configurar VAPID keys
- [ ] Implementar PushService
- [ ] Integrar service worker existente

### Fase 6 (Semana 6-7): Preferences UI
- [ ] Página de preferências
- [ ] Controles por tipo de notificação
- [ ] Horário silencioso

### Fase 7 (Semana 7-8): Polish
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] WebSocket para real-time (opcional)

## Impacto em Módulos Existentes

| Arquivo | Modificação |
|---------|-------------|
| `models/user.py` | Adicionar relationships |
| `routers/__init__.py` | Incluir notification router |
| `core/config.py` | Settings Celery/VAPID |
| `Layout.tsx` | Adicionar NotificationBell |

## Critérios de Aceitação

1. [ ] Usuário recebe alerta 3 dias antes de fatura vencer
2. [ ] Usuário é notificado ao atingir 80% do orçamento
3. [ ] Notificações push funcionam em Chrome/Firefox/Safari
4. [ ] Preferências por tipo de notificação funcionam
5. [ ] Digest diário é enviado às 9h
6. [ ] Horário silencioso respeita timezone do usuário
