"""Parser de respostas JSON das LLMs"""
import json
import re
from datetime import datetime

from .extraction_validator import ExtractionValidator


class ResponseParser:
    """Parseia e normaliza respostas JSON das LLMs"""

    def __init__(self):
        self.validator = ExtractionValidator()

    def parse(self, content: str) -> dict:
        """Parseia a resposta JSON da LLM"""
        try:
            content = content.strip()
            if '```' in content:
                match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
                if match:
                    content = match.group(1)

            data = json.loads(content)

            items = []
            for item in data.get('items', []):
                normalized = self._normalize_item(item)
                if normalized and normalized['amount'] != 0:
                    items.append(normalized)

            # DEBUG: Log para verificar o que veio do LLM
            print(f"[Parser] DEBUG: data keys={list(data.keys())}")
            print(f"[Parser] DEBUG: data.get('total_amount')={data.get('total_amount')}")
            print(f"[Parser] DEBUG: document_type={data.get('document_type')}")

            result = {
                'items': items,
                'document_type': data.get('document_type'),
                'total_amount': data.get('total_amount'),  # Total do cupom fiscal
            }

            card_info = data.get('card_info')
            if card_info and isinstance(card_info, dict):
                result['card_info'] = self._normalize_card_info(card_info)

            return result

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            return {
                'items': [],
                'error': f'Erro ao processar resposta: {str(e)}',
                'raw': content[:500] if content else '',
            }

    def _normalize_item(self, item: dict) -> dict | None:
        """Normaliza um item extraido"""
        amount = item.get('amount', 0)
        if isinstance(amount, str):
            amount = float(amount.replace('.', '').replace(',', '.').replace('R$', '').strip())

        is_installment = item.get('is_installment', False)
        installment_current = None
        installment_total = None

        if is_installment:
            installment_current = item.get('installment_current')
            installment_total = item.get('installment_total')

            if installment_current and installment_total:
                try:
                    installment_current = int(installment_current)
                    installment_total = int(installment_total)
                    if installment_current < 1 or installment_current > installment_total:
                        is_installment = False
                        installment_current = None
                        installment_total = None
                except (ValueError, TypeError):
                    is_installment = False
                    installment_current = None
                    installment_total = None
            else:
                is_installment = False

        description = str(item.get('description', 'Item'))[:200]

        if self.validator.is_invalid_description(description):
            return None

        transaction_type = item.get('transaction_type', 'compra')
        category = item.get('category', 'outros')

        if transaction_type == 'compra':
            if category in ['pagamento']:
                transaction_type = 'pagamento'
            elif category in ['estorno']:
                transaction_type = 'estorno'
            elif category in ['credito']:
                transaction_type = 'credito'
            elif category in ['saldo_anterior']:
                transaction_type = 'saldo_anterior'
            elif 'anuidade' in description.lower():
                transaction_type = 'anuidade'

        valid_types = ['compra', 'anuidade', 'encargo', 'estorno', 'credito', 'pagamento', 'saldo_anterior']
        if transaction_type not in valid_types:
            transaction_type = 'compra'

        normalized = {
            'description': description,
            'amount': float(amount) if amount else 0,
            'date': item.get('date'),
            'category': category,
            'transaction_type': transaction_type,
            'confidence': 0.9,
            'is_installment': is_installment,
            'installment_current': installment_current,
            'installment_total': installment_total,
        }

        future_installments = item.get('future_installments')
        if future_installments and isinstance(future_installments, list):
            normalized['future_installments'] = future_installments

        return normalized

    def _normalize_card_info(self, card_info: dict) -> dict:
        """Normaliza informacoes do cartao"""
        # Valida card_name para evitar nomes de pessoas
        card_name = card_info.get('card_name')
        if card_name:
            card_name = self._validate_card_name(card_name, card_info)

        result = {
            'card_issuer': card_info.get('card_issuer'),
            'card_last_digits': str(card_info.get('card_last_digits', ''))[-4:] if card_info.get('card_last_digits') else None,
            'card_name': card_name,
            'card_bank': card_info.get('card_bank'),
            'card_brand': card_info.get('card_brand'),
            'card_partner': card_info.get('card_partner'),
            'invoice_month': card_info.get('invoice_month'),
            'invoice_year': card_info.get('invoice_year'),
            'closing_date': card_info.get('closing_date'),
            'due_date': card_info.get('due_date'),
            'total_amount': float(card_info.get('total_amount', 0)) if card_info.get('total_amount') else None,
            'credit_limit': card_info.get('credit_limit'),
            'credit_used': card_info.get('credit_used'),
            'credit_available': card_info.get('credit_available'),
        }

        if result.get('closing_date'):
            try:
                closing = datetime.strptime(result['closing_date'], '%Y-%m-%d')
                result['closing_day'] = closing.day
            except ValueError:
                pass

        if result.get('due_date'):
            try:
                due = datetime.strptime(result['due_date'], '%Y-%m-%d')
                result['due_day'] = due.day
                old_month = result.get('invoice_month')
                old_year = result.get('invoice_year')
                result['invoice_month'] = due.month
                result['invoice_year'] = due.year
                if old_month != due.month or old_year != due.year:
                    print(f"[Parser] Corrigido invoice_month/year de {old_month}/{old_year} para {due.month}/{due.year}")
            except ValueError as e:
                print(f"[Parser] Erro ao extrair due_day: {e}")

        return {k: v for k, v in result.items() if v is not None}

    def _validate_card_name(self, card_name: str, card_info: dict) -> str | None:
        """
        Valida se o card_name e realmente um nome de cartao e nao o nome do titular.
        Retorna None se parecer ser nome de pessoa, ou gera um nome correto.
        """
        if not card_name:
            return None

        card_name_upper = card_name.upper().strip()

        # Palavras que indicam que e um nome de cartao valido
        valid_card_keywords = [
            'VISA', 'MASTERCARD', 'ELO', 'HIPERCARD', 'AMEX', 'DINERS',
            'GOLD', 'PLATINUM', 'BLACK', 'INFINITE', 'SIGNATURE',
            'NUBANK', 'ITAU', 'BRADESCO', 'SANTANDER', 'INTER', 'C6',
            'AMAZON', 'SMILES', 'LATAM', 'RAPPI', 'IFOOD',
            'CARTAO', 'CREDITO', 'DEBITO', 'CARD'
        ]

        # Se contem alguma palavra-chave de cartao, provavelmente e valido
        has_card_keyword = any(kw in card_name_upper for kw in valid_card_keywords)
        if has_card_keyword:
            return card_name

        # Verifica se parece ser nome de pessoa (apenas palavras sem numeros/simbolos)
        # Nomes de pessoas geralmente sao 2-4 palavras, todas alfabeticas
        words = card_name_upper.split()
        if len(words) >= 2 and len(words) <= 4:
            # Todas as palavras sao apenas letras (nome de pessoa)
            all_alpha = all(word.replace(' ', '').isalpha() for word in words)
            if all_alpha:
                # Parece ser nome de pessoa - gerar nome do cartao a partir de outros campos
                print(f"[Parser] card_name '{card_name}' parece ser nome de pessoa, gerando nome do cartao...")
                return self._generate_card_name(card_info)

        return card_name

    def _generate_card_name(self, card_info: dict) -> str | None:
        """Gera um nome de cartao a partir dos outros campos disponiveis"""
        parts = []

        # Banco
        issuer = card_info.get('card_issuer') or card_info.get('card_bank')
        if issuer:
            issuer_names = {
                'nubank': 'Nubank', 'itau': 'Itaú', 'bradesco': 'Bradesco',
                'santander': 'Santander', 'inter': 'Inter', 'bb': 'Banco do Brasil',
                'caixa': 'Caixa', 'c6': 'C6 Bank', 'bradescard': 'Bradescard',
            }
            parts.append(issuer_names.get(issuer.lower(), issuer.title()))

        # Parceiro (Amazon, Smiles, etc)
        partner = card_info.get('card_partner')
        if partner:
            parts.append(partner.title())

        # Bandeira
        brand = card_info.get('card_brand')
        if brand:
            parts.append(brand.upper())

        if parts:
            return ' '.join(parts)

        return None
