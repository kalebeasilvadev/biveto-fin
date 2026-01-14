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

            result = {
                'items': items,
                'document_type': data.get('document_type'),
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
        result = {
            'card_issuer': card_info.get('card_issuer'),
            'card_last_digits': str(card_info.get('card_last_digits', ''))[-4:] if card_info.get('card_last_digits') else None,
            'card_name': card_info.get('card_name'),
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
