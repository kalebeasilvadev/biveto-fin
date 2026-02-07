# Como Reiniciar o Servidor para Aplicar as Mudanças

## 🔧 Passos Obrigatórios

### 1. Parar o servidor atual
```bash
# Se estiver rodando em terminal, pressione: Ctrl+C
# Se estiver rodando em background, encontre o processo:
ps aux | grep uvicorn
# E mate o processo:
kill -9 <PID>
```

### 2. Limpar cache Python (IMPORTANTE!)
```bash
cd /Users/kalebeandrade/Dev/geral/biveto-app/backend

# Limpar todos os arquivos __pycache__
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Limpar arquivos .pyc
find . -type f -name "*.pyc" -delete
```

### 3. Reiniciar o servidor
```bash
cd /Users/kalebeandrade/Dev/geral/biveto-app/backend

# Se usar uvicorn diretamente:
uvicorn app.main:app --reload --port 8000

# OU se usar o script de start:
./start.sh  # ou o comando que você usa normalmente
```

### 4. Verificar se as mudanças foram carregadas

Execute o script de debug:
```bash
cd /Users/kalebeandrade/Dev/geral/biveto-app/backend
python debug_duplicate_detection.py
```

**Você deve ver:**
```
✅ HARD RULE 1: Diferença Absoluta de Valor
   Valor A: R$ 47.61
   Valor B: R$ 119.04
   Diferença Absoluta: R$ 71.43
   Threshold: R$ 0.05
   Bloqueado: SIM ❌

   ⚠️  DEVERIA RETORNAR SCORE 0.0 E PARAR AQUI!

📈 Score calculado: 0.0000 (0.00%)
✅ CORRETO: Score é 0.0 (bloqueado pelas hard rules)
```

### 5. Testar a API novamente

Após reiniciar, chame o endpoint de detecção de duplicatas:
```bash
POST /installments/detect-duplicates
```

**Resultado esperado:**
```json
{
    "has_duplicates": false,
    "estimated_excess": 0,
    "affected_series_pairs": [],
    "duplicate_count": 0
}
```

## ⚠️ Se ainda não funcionar

### Verificar se o arquivo foi realmente modificado
```bash
cd /Users/kalebeandrade/Dev/geral/biveto-app/backend

# Verificar se as constantes estão no código:
grep -n "MAX_AMOUNT_DIFFERENCE_BRL" app/modules/installments/services/duplicate_detection_service.py

# Deve mostrar:
# 27:    MAX_AMOUNT_DIFFERENCE_BRL = 0.05
```

### Verificar se há múltiplas instâncias rodando
```bash
# Listar todos os processos Python
ps aux | grep python | grep uvicorn

# Se houver múltiplas linhas, mate TODOS os processos:
killall -9 uvicorn
# Depois reinicie apenas um
```

### Verificar logs do servidor
Quando o servidor iniciar, você deve ver algo como:
```
INFO:     Will watch for changes in these directories: ['/Users/kalebeandrade/Dev/geral/biveto-app/backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [12345] using StatReload
INFO:     Started server process [12346]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

## 🎯 Comportamento Esperado Após Correção

### ANTES (Bug):
```json
{
    "series_a_name": "CASAS BECKER,PLANALTINA-8/21",
    "series_b_name": "CASAS BECKER,PLANALTINA-8/21",
    "similarity_score": 0.70  ❌ ERRADO!
}
```

### DEPOIS (Correto):
- As séries **NÃO serão comparadas** (bloqueadas pela Hard Rule 1)
- Score: 0.0
- Não aparecem na lista de duplicatas ✅

---

## 📝 Checklist Final

- [ ] Parar servidor atual
- [ ] Limpar cache Python (`__pycache__`)
- [ ] Reiniciar servidor
- [ ] Executar script de debug
- [ ] Verificar score = 0.0
- [ ] Testar API
- [ ] Confirmar que CASAS BECKER não aparece mais como duplicata
