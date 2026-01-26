"""
Prompt for LLM-powered smart shopping list generation
"""

SMART_LIST_PROMPT = """Voce e um assistente de lista de compras de supermercado brasileiro.

DATA ATUAL: {current_date}
PERIODO DE ANALISE: {period_days} dias

TAREFA:
Analise o historico de compras dos ultimos {period_days} dias e gere uma lista de compras inteligente.

INSTRUCOES:

1. AGRUPAR PRODUTOS POR TIPO (ignorar marca):
   - "Coxinha Da Asa Fgo Cong Sadia 1Kg" + "File Frango Seara 1Kg" = "Frango Congelado"
   - "Det Liq Ype Maca 500Ml" + "Detergente Limpol 500ml" = "Detergente de Louça"
   - "Leite Integral Italac 1L" + "Leite Piracanjuba 1L" = "Leite Integral"
   - "Pao Frances" + "Pao de Forma Pullman" = Manter separados (tipos diferentes)

2. NORMALIZAR NOMES de cupons fiscais:
   - "Det Liq" = Detergente Liquido
   - "Fgo" = Frango
   - "Cong" = Congelado
   - "Ref" = Refrigerante
   - "Marg" = Margarina
   - Remover codigos de barras, pesos e marcas do nome final

3. FILTRAR ITENS QUE NAO SAO DE SUPERMERCADO:
   - Restaurantes: McDonald's, Burger King, Habib's, Subway, Outback
   - Fast Food: Big Mac, Whopper, McFlurry, McNuggets, McChicken
   - Delivery: iFood, Rappi, Uber Eats (quando for taxa/gorjeta)
   - Conveniencia: AM/PM (itens como cafe pronto)
   - Coloque esses itens na lista "excluded" com o motivo

4. CALCULAR URGENCIA baseada em frequencia e recencia:
   - Para cada tipo de produto agrupado:
     a) Identifique a data da ultima compra
     b) Calcule o intervalo medio entre compras do mesmo tipo
     c) Compare: (dias desde ultima compra) / (intervalo medio)

   - Niveis de urgencia:
     * HIGH: Passou do ciclo (ratio > 1.2) - "Passou do prazo de recompra"
     * MEDIUM: Proximo do fim do ciclo (ratio 0.8-1.2) - "Proximo de acabar"
     * LOW: Comprado recentemente (ratio < 0.8) - "Ainda tem em casa"

5. CALCULAR QUANTIDADES com base no historico real:
   - O campo "qty" no JSON representa a quantidade comprada de cada item
   - Para cada tipo de produto agrupado, SOME os valores "qty" de todos os itens
   - Calcule a media mensal: (soma total) / ({period_days} / 30)
   - A quantidade sugerida deve ser essa MEDIA MENSAL arredondada para cima

   EXEMPLOS DE CALCULO (para periodo de 90 dias = 3 meses):
   - Leite: 4 compras de 2L cada = 8L total / 3 meses = 2.67L/mes = sugerir 3 L
   - Arroz: 2 compras de 5kg cada = 10kg total / 3 meses = 3.33kg/mes = sugerir 4 kg
   - Ovos: 6 compras de 12 un cada = 72 un total / 3 meses = 24/mes = sugerir 24 un

   IMPORTANTE:
   - NAO sugerir quantidade 1 para todos os itens! Use os dados reais
   - Some as quantidades de produtos do mesmo tipo antes de calcular
   - Arredonde para cima para evitar falta de produtos

6. GERAR INSIGHTS uteis (max 5):
   - Padroes de consumo identificados
   - Sugestoes de economia
   - Produtos que podem estar acabando
   - Frequencia de compra de categorias

CATEGORIAS VALIDAS (use exatamente estes valores):
- fruits_vegetables (Frutas e Verduras)
- meat_fish (Carnes e Peixes)
- dairy (Laticinios)
- bakery (Padaria)
- beverages (Bebidas)
- snacks (Lanches/Salgadinhos)
- frozen (Congelados)
- canned (Enlatados)
- grains_pasta (Graos e Massas)
- grains (Graos como arroz, feijao)
- condiments (Temperos)
- cleaning (Limpeza)
- hygiene (Higiene Pessoal)
- personal_care (Cuidados Pessoais)
- baby (Bebe)
- pet (Pet)
- household (Utilidades)
- other (Outros)

TIPOS DE NECESSIDADE:
- essential (Essencial - necessidades basicas)
- non_essential (Superfluo - doces, refrigerantes, etc.)

HISTORICO DE COMPRAS (JSON):
{purchases_json}

FORMATO DE RESPOSTA (JSON):
Retorne EXATAMENTE neste formato, preenchendo os valores:
```json
{{
  "shopping_list": [
    {{
      "product_type": "Nome do tipo de produto (ex: Leite Integral)",
      "display_name": "Nome curto (ex: Leite)",
      "category": "uma das categorias validas listadas acima",
      "necessity_type": "essential ou non_essential",
      "suggested_quantity": 3,
      "unit": "L ou kg ou un",
      "estimated_price": 5.99,
      "urgency": "high ou medium ou low",
      "reasoning": "Explicacao da urgencia",
      "original_product_names": ["Nome original 1", "Nome original 2"],
      "purchase_count": 5,
      "days_since_last_purchase": 15,
      "avg_cycle_days": 20
    }}
  ],
  "excluded": [
    {{"name": "Nome do item", "reason": "Motivo da exclusao"}}
  ],
  "insights": [
    "Insight 1 sobre padroes de compra",
    "Insight 2 sobre economia"
  ]
}}
```

IMPORTANTE:
- product_type deve ser o nome REAL do produto agrupado (ex: "Arroz Branco", "Leite Integral", "Detergente")
- NAO use "Produto" como nome generico
- Preencha TODOS os campos obrigatorios
- suggested_quantity deve ser calculada com base no historico real, NAO use 1 para tudo

RESPONDA APENAS COM O JSON, sem texto antes ou depois.
"""

# Schema for structured JSON response from Gemini
SMART_LIST_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "shopping_list": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "product_type": {
                        "type": "string",
                        "description": "Tipo normalizado do produto (ex: 'Frango Congelado')"
                    },
                    "display_name": {
                        "type": "string",
                        "description": "Nome curto para exibicao (ex: 'Frango')"
                    },
                    "category": {
                        "type": "string",
                        "enum": [
                            "fruits_vegetables", "meat_fish", "dairy", "bakery",
                            "beverages", "snacks", "frozen", "canned",
                            "grains_pasta", "grains", "condiments", "cleaning",
                            "hygiene", "personal_care", "baby", "pet",
                            "household", "other"
                        ]
                    },
                    "necessity_type": {
                        "type": "string",
                        "enum": ["essential", "non_essential"]
                    },
                    "suggested_quantity": {
                        "type": "number",
                        "description": "Quantidade sugerida baseada no padrao"
                    },
                    "unit": {
                        "type": "string",
                        "description": "Unidade (un, kg, L, etc.)"
                    },
                    "estimated_price": {
                        "type": "number",
                        "nullable": True,
                        "description": "Preco estimado por unidade"
                    },
                    "urgency": {
                        "type": "string",
                        "enum": ["high", "medium", "low"]
                    },
                    "reasoning": {
                        "type": "string",
                        "description": "Justificativa da urgencia"
                    },
                    "original_product_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de nomes originais dos produtos agrupados"
                    },
                    "purchase_count": {
                        "type": "integer",
                        "description": "Quantidade de compras do tipo"
                    },
                    "days_since_last_purchase": {
                        "type": "integer",
                        "description": "Dias desde a ultima compra"
                    },
                    "avg_cycle_days": {
                        "type": "number",
                        "nullable": True,
                        "description": "Ciclo medio de recompra em dias"
                    }
                },
                "required": [
                    "product_type", "display_name", "category", "necessity_type",
                    "suggested_quantity", "unit", "urgency", "reasoning",
                    "original_product_names", "purchase_count", "days_since_last_purchase"
                ]
            }
        },
        "excluded": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Nome do item excluido"
                    },
                    "reason": {
                        "type": "string",
                        "description": "Motivo da exclusao"
                    }
                },
                "required": ["name", "reason"]
            }
        },
        "insights": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Lista de insights sobre habitos de compra (max 5)"
        }
    },
    "required": ["shopping_list", "excluded", "insights"]
}
