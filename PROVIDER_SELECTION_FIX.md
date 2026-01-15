# Fix: Provider Selection Based on File Type

## Problema Identificado
Quando usuários enviavam imagens de cupom (JPEG), o sistema falhava com erro 500:
```
[DOC_SVC] LLM OCR result: items=0, error=Mistral provider suporta apenas PDFs via OCR
[DOC_SVC] Document 145 marked as FAILED
```

**Causa:** O `VISION_PROVIDER` estava configurado como `mistral` no Fly.io, mas o Mistral só suporta PDFs via OCR, não imagens diretas.

## Solução Implementada
Implementada seleção automática de provider baseada no tipo de arquivo:

### Mudanças em `llm_ocr_service.py`
- Adicionado parâmetros opcionais `provider` e `model` no construtor
- Permite override do provider padrão mantendo compatibilidade

### Mudanças em `document_service.py`
Lógica de seleção inteligente no método `_extract_data()`:
```python
# Para PDFs: preferir Mistral (melhor OCR estruturado)
# Para imagens: usar Google (gratuito e suporta visão direta)
if is_pdf and settings.mistral_api_key:
    selected_provider = 'mistral'
    selected_model = settings.mistral_llm_model
else:
    selected_provider = 'google'
    selected_model = settings.vision_model or 'gemini-2.0-flash'
```

## Resultado
- **Imagens (JPEG, PNG)**: usam Google (gratuito, suporta visão)
- **PDFs**: usam Mistral (melhor OCR estruturado)
- Ambos os tipos de documento são processados corretamente
- Mantém compatibilidade com código existente

## Deploy
Não é necessário alterar variáveis de ambiente no Fly.io. A seleção é automática baseada no tipo de arquivo.
