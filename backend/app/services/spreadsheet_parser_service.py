"""Serviço de extração de dados de arquivos CSV e Excel"""
import csv
import re
import io
from datetime import datetime
from typing import Optional


class SpreadsheetParserService:
    """Extrai transações de arquivos CSV e Excel de bancos brasileiros"""

    # Padrões de parcelas para busca em descrições
    INSTALLMENT_PATTERNS = [
        # Inter: "(Parcela XX de YY)"
        r'\(Parcela\s+(\d{1,2})\s+de\s+(\d{1,2})\)',
        # Nubank/Genérico: "Parcela X de Y" ou "Parcela X/Y"
        r'Parcela\s+(\d{1,2})\s+de\s+(\d{1,2})',
        r'Parcela\s+(\d{1,2})/(\d{1,2})',
        # Bradesco: "XX/YY" no final ou meio
        r'\s(\d{2})/(\d{2})(?:\s|$)',
        # Padrões com LT, * etc
        r'LT(\d{2})/(\d{2})',
        r'\*\w+(\d{2})/(\d{2})',
        # Genérico: "Parc X/Y"
        r'Parc\s*(\d{1,2})/(\d{1,2})',
    ]

    # Categorias por palavras-chave
    CATEGORY_KEYWORDS = {
        'alimentacao': ['restaurante', 'pizzaria', 'lanche', 'delivery', 'ifood', 'mc donald', 'burger', 'gruta', 'padaria', 'cafe'],
        'transporte': ['posto', 'uber', '99', 'estacionamento', 'shellbox', 'pedagio', 'combustivel', 'gasolina'],
        'moradia': ['luz', 'agua', 'gas', 'aluguel', 'condominio', 'energia', 'enel', 'sabesp', 'neoenergia', 'cemig'],
        'saude': ['farmacia', 'hospital', 'medico', 'drogaria', 'droga raia', 'ultrafarma', 'panvel', 'drogasil'],
        'lazer': ['cinema', 'streaming', 'jogos', 'bar', 'spotify', 'netflix', 'steam', 'nuuvem', 'inside games', 'shopee', 'daiso', 'amazon prime', 'disney'],
        'eletronicos': ['magazine', 'americanas', 'casas bahia', 'kabum', 'pichau', 'amazon', 'ciatoy', 'mercado livre', 'ml '],
        'roupas': ['renner', 'c&a', 'riachuelo', 'zara', 'shein', 'boticario', 'hering', 'marisa'],
        'servicos': ['eletrica', 'hidraulica', 'manutencao', 'instalacao', 'conserto'],
        'mercado': ['supermercado', 'mercado', 'atacado', 'pao de acucar', 'carrefour', 'extra', 'distribuidora', 'assai', 'dia'],
        'assinaturas': ['spotify', 'netflix', 'amazon prime', 'disney', 'gympass', 'wellhub', 'hotmart', 'apple.com', 'hbomax', 'max.com', 'youtube'],
        'cartao': ['anuidade', 'taxa', 'iof', 'seguro cartao', 'tarifa'],
        'educacao': ['hotmart', 'curso', 'academy', 'udemy', 'escola', 'faculdade'],
    }

    async def parse_file(self, content: bytes, filename: str, mime_type: str) -> dict:
        """Parse arquivo CSV ou Excel e extrai transações"""
        try:
            if mime_type in ['text/csv', 'application/csv'] or filename.endswith('.csv'):
                return await self._parse_csv(content)
            elif mime_type in [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel'
            ] or filename.endswith(('.xlsx', '.xls')):
                return await self._parse_excel(content, filename)
            else:
                return {'items': [], 'error': f'Formato não suportado: {mime_type}'}
        except Exception as e:
            return {'items': [], 'error': str(e)}

    async def _parse_csv(self, content: bytes) -> dict:
        """Parse arquivo CSV"""
        # Tentar diferentes encodings
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                text = content.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            return {'items': [], 'error': 'Não foi possível decodificar o arquivo CSV'}

        # Detectar delimitador
        sample = text[:2000]
        delimiter = ','
        if sample.count(';') > sample.count(','):
            delimiter = ';'
        elif sample.count('\t') > sample.count(','):
            delimiter = '\t'

        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

        items = []
        for row in reader:
            item = self._extract_transaction_from_row(row)
            if item:
                items.append(item)

        return {
            'items': items,
            'document_type': 'extrato',
        }

    async def _parse_excel(self, content: bytes, filename: str) -> dict:
        """Parse arquivo Excel"""
        try:
            import openpyxl
        except ImportError:
            return {'items': [], 'error': 'Biblioteca openpyxl não instalada. Execute: pip install openpyxl'}

        try:
            workbook = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
            sheet = workbook.active

            # Extrair headers da primeira linha
            headers = []
            for cell in sheet[1]:
                headers.append(str(cell.value).lower() if cell.value else '')

            items = []
            for row in sheet.iter_rows(min_row=2, values_only=True):
                row_dict = {headers[i]: row[i] for i in range(min(len(headers), len(row)))}
                item = self._extract_transaction_from_row(row_dict)
                if item:
                    items.append(item)

            return {
                'items': items,
                'document_type': 'extrato',
            }
        except Exception as e:
            return {'items': [], 'error': f'Erro ao processar Excel: {str(e)}'}

    def _extract_transaction_from_row(self, row: dict) -> Optional[dict]:
        """Extrai transação de uma linha do CSV/Excel"""
        # Normalizar keys para lowercase
        row = {k.lower().strip() if k else '': v for k, v in row.items()}

        # Mapear campos comuns de diferentes bancos
        description = None
        amount = None
        date = None

        # Campos de descrição
        desc_fields = ['descricao', 'descrição', 'historico', 'histórico', 'lancamento',
                       'lançamento', 'estabelecimento', 'nome', 'merchant', 'description']
        for field in desc_fields:
            if field in row and row[field]:
                description = str(row[field]).strip()
                break

        # Campos de valor
        value_fields = ['valor', 'value', 'amount', 'quantia', 'total']
        for field in value_fields:
            if field in row and row[field]:
                amount = self._parse_amount(row[field])
                break

        # Se não encontrou, tentar débito/crédito separados
        if amount is None:
            if 'debito' in row or 'débito' in row:
                debit = row.get('debito') or row.get('débito')
                if debit:
                    amount = abs(self._parse_amount(debit))
            if 'credito' in row or 'crédito' in row:
                credit = row.get('credito') or row.get('crédito')
                if credit and self._parse_amount(credit):
                    amount = -abs(self._parse_amount(credit))

        # Campos de data
        date_fields = ['data', 'date', 'data lancamento', 'data lançamento', 'data_transacao']
        for field in date_fields:
            if field in row and row[field]:
                date = self._parse_date(row[field])
                break

        # Validar campos obrigatórios
        if not description or amount is None or amount == 0:
            return None

        # Detectar parcelas
        is_installment = False
        installment_current = None
        installment_total = None

        for pattern in self.INSTALLMENT_PATTERNS:
            match = re.search(pattern, description, re.IGNORECASE)
            if match:
                try:
                    installment_current = int(match.group(1))
                    installment_total = int(match.group(2))
                    if 1 <= installment_current <= installment_total <= 99:
                        is_installment = True
                        break
                except (ValueError, IndexError):
                    continue

        # Limpar descrição
        clean_description = self._clean_description(description)

        # Detectar categoria
        category = self._detect_category(clean_description)

        return {
            'description': clean_description[:200],
            'amount': amount,
            'date': date,
            'category': category,
            'confidence': 0.85,
            'is_installment': is_installment,
            'installment_current': installment_current,
            'installment_total': installment_total,
        }

    def _parse_amount(self, value) -> Optional[float]:
        """Converte valor para float"""
        if value is None:
            return None

        if isinstance(value, (int, float)):
            return float(value)

        if isinstance(value, str):
            # Remover símbolos de moeda e espaços
            clean = value.strip().replace('R$', '').replace('$', '').strip()

            # Detectar negativo
            is_negative = clean.startswith('-') or clean.endswith('-')
            clean = clean.replace('-', '').strip()

            # Formato brasileiro: 1.234,56
            if ',' in clean and '.' in clean:
                if clean.rfind(',') > clean.rfind('.'):
                    clean = clean.replace('.', '').replace(',', '.')
                else:
                    clean = clean.replace(',', '')
            elif ',' in clean:
                clean = clean.replace(',', '.')

            try:
                amount = float(clean)
                return -amount if is_negative else amount
            except ValueError:
                return None

        return None

    def _parse_date(self, value) -> Optional[str]:
        """Converte data para formato YYYY-MM-DD"""
        if value is None:
            return None

        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')

        if isinstance(value, str):
            value = value.strip()

            # Formatos comuns
            formats = [
                '%d/%m/%Y',  # 25/12/2025
                '%d-%m-%Y',  # 25-12-2025
                '%Y-%m-%d',  # 2025-12-25
                '%d/%m/%y',  # 25/12/25
                '%d %b %Y',  # 25 Dec 2025
                '%d de %b de %Y',  # 25 de dez de 2025
            ]

            for fmt in formats:
                try:
                    dt = datetime.strptime(value, fmt)
                    return dt.strftime('%Y-%m-%d')
                except ValueError:
                    continue

            # Tentar extrair com regex
            match = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})', value)
            if match:
                day, month, year = match.groups()
                if len(year) == 2:
                    year = '20' + year
                try:
                    return f'{year}-{month.zfill(2)}-{day.zfill(2)}'
                except:
                    pass

        return None

    def _clean_description(self, description: str) -> str:
        """Remove códigos e padrões de parcela da descrição"""
        clean = description

        # Remover padrões de parcela
        patterns_to_remove = [
            r'\(Parcela\s+\d{1,2}\s+de\s+\d{1,2}\)',
            r'Parcela\s+\d{1,2}\s+de\s+\d{1,2}',
            r'Parcela\s+\d{1,2}/\d{1,2}',
            r'\s\d{2}/\d{2}(?:\s|$)',
            r'LT\d{2}/\d{2}',
            r'\*\w+\d{2}/\d{2}',
            r'Parc\s*\d{1,2}/\d{1,2}',
        ]

        for pattern in patterns_to_remove:
            clean = re.sub(pattern, ' ', clean, flags=re.IGNORECASE)

        # Remover códigos comuns
        clean = re.sub(r'\*\w+', '', clean)  # *codigo
        clean = re.sub(r'DM\s*\*', '', clean)  # DM *
        clean = re.sub(r'PG\s*\*', '', clean)  # PG *
        clean = re.sub(r'PAG\s*\*', '', clean)  # PAG *

        # Limpar espaços extras
        clean = ' '.join(clean.split())

        return clean.strip() or description[:100]

    def _detect_category(self, description: str) -> str:
        """Detecta categoria baseado em palavras-chave"""
        desc_lower = description.lower()

        for category, keywords in self.CATEGORY_KEYWORDS.items():
            for keyword in keywords:
                if keyword in desc_lower:
                    return category

        return 'outros'
