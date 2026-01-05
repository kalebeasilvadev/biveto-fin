"""Serviço de OCR para extração de dados de documentos financeiros"""
import re
from datetime import datetime
from io import BytesIO
from PIL import Image
import pytesseract


class OCRService:
    """Extrai dados de imagens de documentos financeiros"""

    # Padrões para valores monetários brasileiros
    MONEY_PATTERNS = [
        r'R\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2}))',  # R$ 1.234,56
        r'R\$\s*(\d+(?:,\d{2}))',                    # R$ 123,56
        r'(\d{1,3}(?:\.\d{3})*(?:,\d{2}))\s*(?:reais|BRL)',  # 1.234,56 reais
    ]

    # Padrões para datas
    DATE_PATTERNS = [
        r'(\d{2}/\d{2}/\d{4})',  # 25/12/2024
        r'(\d{2}/\d{2}/\d{2})',  # 25/12/24
        r'(\d{2}-\d{2}-\d{4})',  # 25-12-2024
    ]

    def __init__(self):
        # Configuração do Tesseract para português
        self.tesseract_config = '--oem 3 --psm 6 -l por'

    def extract_from_image(self, image_content: bytes) -> dict:
        """Extrai dados de uma imagem"""
        try:
            image = Image.open(BytesIO(image_content))
            # Converter para RGB se necessário
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Executar OCR
            raw_text = pytesseract.image_to_string(image, config=self.tesseract_config)

            return self._parse_text(raw_text)
        except Exception as e:
            return {
                'raw_text': '',
                'error': str(e),
                'items': [],
                'total': None,
            }

    def _parse_text(self, text: str) -> dict:
        """Analisa o texto extraído e identifica valores e itens"""
        result = {
            'raw_text': text,
            'items': [],
            'total': None,
            'date': None,
            'merchant': None,
        }

        lines = text.split('\n')
        all_values = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Extrair valores monetários
            values = self._extract_money_values(line)
            for value in values:
                # Tentar identificar o que é (descrição + valor)
                item = self._parse_line_item(line, value)
                if item:
                    all_values.append(item)

        # Identificar total vs itens individuais
        if all_values:
            # Se houver um valor significativamente maior, provavelmente é o total
            sorted_values = sorted(all_values, key=lambda x: x['amount'], reverse=True)

            # Verificar se o maior valor é aproximadamente a soma dos outros
            if len(sorted_values) > 1:
                largest = sorted_values[0]['amount']
                sum_others = sum(v['amount'] for v in sorted_values[1:])

                # Se o maior valor for próximo da soma dos outros, é provavelmente o total
                if abs(largest - sum_others) < largest * 0.1:  # 10% de tolerância
                    result['total'] = sorted_values[0]
                    result['items'] = sorted_values[1:]
                else:
                    # Todos são itens individuais
                    result['items'] = sorted_values
                    # Calcular total
                    result['total'] = {
                        'description': 'Total calculado',
                        'amount': sum(v['amount'] for v in sorted_values),
                        'confidence': 0.7,
                    }
            else:
                # Apenas um valor encontrado
                result['total'] = sorted_values[0]

        # Extrair data
        result['date'] = self._extract_date(text)

        # Extrair merchant (primeira linha significativa)
        result['merchant'] = self._extract_merchant(lines)

        return result

    def _extract_money_values(self, text: str) -> list[float]:
        """Extrai valores monetários de uma string"""
        values = []
        for pattern in self.MONEY_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    # Converter formato brasileiro para float
                    value_str = match.replace('.', '').replace(',', '.')
                    value = float(value_str)
                    if value > 0:
                        values.append(value)
                except ValueError:
                    continue
        return values

    def _parse_line_item(self, line: str, value: float) -> dict | None:
        """Tenta identificar descrição e valor de uma linha"""
        # Remover o valor da linha para obter a descrição
        description = line
        for pattern in self.MONEY_PATTERNS:
            description = re.sub(pattern, '', description, flags=re.IGNORECASE)

        # Limpar descrição
        description = re.sub(r'[R$\s]+', ' ', description).strip()
        description = re.sub(r'\s+', ' ', description)

        # Remover caracteres especiais no início/fim
        description = description.strip('.-_:| ')

        if len(description) < 2:
            description = "Item"

        return {
            'description': description[:100],  # Limitar tamanho
            'amount': value,
            'confidence': 0.8,
        }

    def _extract_date(self, text: str) -> dict | None:
        """Extrai a primeira data encontrada no texto"""
        for pattern in self.DATE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                date_str = match.group(1)
                try:
                    # Tentar diferentes formatos
                    for fmt in ['%d/%m/%Y', '%d/%m/%y', '%d-%m-%Y']:
                        try:
                            dt = datetime.strptime(date_str, fmt)
                            return {
                                'value': dt,
                                'confidence': 0.9,
                            }
                        except ValueError:
                            continue
                except Exception:
                    continue
        return None

    def _extract_merchant(self, lines: list[str]) -> dict | None:
        """Tenta identificar o nome do estabelecimento"""
        # Procurar nas primeiras linhas não vazias
        for line in lines[:5]:
            line = line.strip()
            if len(line) > 3 and not re.match(r'^[\d\s\-/]+$', line):
                # Ignorar linhas que são apenas números/datas
                if not any(p in line.lower() for p in ['total', 'subtotal', 'troco', 'dinheiro']):
                    return {
                        'name': line[:100],
                        'confidence': 0.6,
                    }
        return None


# Função helper para uso direto
def extract_financial_data(image_content: bytes) -> dict:
    """Função helper para extrair dados financeiros de uma imagem"""
    service = OCRService()
    return service.extract_from_image(image_content)
