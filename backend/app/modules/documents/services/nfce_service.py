"""
NFCe (Nota Fiscal de Consumidor Eletrônica) service for fetching data from SEFAZ.

This service attempts to fetch complete NFCe data from state SEFAZ systems.
Note: This implementation uses web scraping as a fallback. For production use,
consider using a commercial API like Infosimples or Webmania.
"""
import re
import logging
from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class NFCeItem(BaseModel):
    """Single item from NFCe"""
    codigo: str | None = None  # Product code
    descricao: str  # Product description (full name)
    quantidade: Decimal
    unidade: str
    valor_unitario: Decimal
    valor_total: Decimal
    ncm: str | None = None  # NCM code (useful for categorization)


class NFCeData(BaseModel):
    """Complete NFCe data"""
    chave_acesso: str  # 44-digit access key
    data_emissao: datetime
    cnpj_emitente: str
    nome_emitente: str
    valor_total: Decimal
    itens: list[NFCeItem]

    # Optional fields
    endereco_emitente: str | None = None
    forma_pagamento: str | None = None


class NFCeResult:
    """Result of NFCe consultation"""
    def __init__(
        self,
        data: NFCeData | None = None,
        error: str | None = None,
        error_type: str | None = None,  # 'not_found', 'not_available', 'timeout', 'parse_error'
    ):
        self.data = data
        self.error = error
        self.error_type = error_type

    @property
    def is_success(self) -> bool:
        return self.data is not None

    def to_dict(self) -> dict:
        return {
            "is_success": self.is_success,
            "error": self.error,
            "error_type": self.error_type,
            "data": self.data.model_dump() if self.data else None,
        }


class NFCeService:
    """Service for fetching NFCe data from SEFAZ"""

    # User agent for requests
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )

    # Timeout for HTTP requests (seconds)
    REQUEST_TIMEOUT = 30

    @classmethod
    async def fetch_from_url(cls, url: str) -> NFCeResult:
        """
        Fetch NFCe data from SEFAZ consultation URL.

        Args:
            url: The NFCe consultation URL (from QR code)

        Returns:
            NFCeResult with data if successful
        """
        import httpx

        try:
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=cls.REQUEST_TIMEOUT,
                headers={"User-Agent": cls.USER_AGENT},
            ) as client:
                response = await client.get(url)

                if response.status_code == 404:
                    return NFCeResult(
                        error="NFCe não encontrada na base da Receita",
                        error_type="not_found",
                    )

                if response.status_code != 200:
                    return NFCeResult(
                        error=f"Erro ao consultar NFCe: HTTP {response.status_code}",
                        error_type="not_available",
                    )

                html_content = response.text

                # Check for common error messages
                if cls._has_error_message(html_content):
                    return NFCeResult(
                        error="NFCe ainda não disponível na base da Receita. Aguarde alguns minutos.",
                        error_type="not_available",
                    )

                # Try to parse the HTML
                try:
                    data = cls._parse_nfce_html(html_content, url)
                    if data:
                        return NFCeResult(data=data)
                    else:
                        return NFCeResult(
                            error="Não foi possível extrair os dados da NFCe",
                            error_type="parse_error",
                        )
                except Exception as e:
                    logger.error(f"Error parsing NFCe HTML: {e}", exc_info=True)
                    return NFCeResult(
                        error=f"Erro ao processar dados da NFCe: {str(e)}",
                        error_type="parse_error",
                    )

        except httpx.TimeoutException:
            return NFCeResult(
                error="Tempo limite excedido ao consultar SEFAZ",
                error_type="timeout",
            )
        except Exception as e:
            logger.error(f"Error fetching NFCe: {e}", exc_info=True)
            return NFCeResult(
                error=f"Erro ao consultar NFCe: {str(e)}",
                error_type="not_available",
            )

    @classmethod
    async def fetch_from_access_key(cls, access_key: str) -> NFCeResult:
        """
        Fetch NFCe data using only the access key.
        This attempts to determine the correct state and build the URL.

        Args:
            access_key: 44-digit NFCe access key

        Returns:
            NFCeResult with data if successful
        """
        if len(access_key) != 44:
            return NFCeResult(
                error="Chave de acesso deve ter 44 dígitos",
                error_type="parse_error",
            )

        # The first 2 digits of the access key indicate the state (UF)
        uf_code = access_key[:2]

        # Build consultation URL based on state
        url = cls._build_consultation_url(uf_code, access_key)

        if not url:
            return NFCeResult(
                error=f"Consulta automática não suportada para o estado (código {uf_code})",
                error_type="not_available",
            )

        return await cls.fetch_from_url(url)

    @classmethod
    def _has_error_message(cls, html: str) -> bool:
        """Check if HTML contains common error messages"""
        error_indicators = [
            "não foi possível",
            "não encontrada",
            "não localizada",
            "NFC-e em processamento",
            "aguarde",
            "tente novamente",
            "erro",
            "indisponível",
        ]
        html_lower = html.lower()
        return any(indicator in html_lower for indicator in error_indicators)

    @classmethod
    def _parse_nfce_html(cls, html: str, url: str) -> NFCeData | None:
        """
        Parse NFCe HTML page to extract data.
        This is a best-effort parser that works with common SEFAZ page layouts.
        """
        from html.parser import HTMLParser

        # Extract access key from URL if not in HTML
        access_key_match = re.search(r'chNFe=(\d{44})|p=(\d{44})', url)
        access_key = ""
        if access_key_match:
            access_key = access_key_match.group(1) or access_key_match.group(2) or ""

        # Try to find access key in HTML if not in URL
        if not access_key:
            key_match = re.search(r'(\d{4}\s*){11}', html)
            if key_match:
                access_key = re.sub(r'\s+', '', key_match.group(0))

        # Extract merchant info using regex patterns
        cnpj_match = re.search(r'CNPJ[:\s]*(\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2})', html, re.I)
        cnpj = re.sub(r'[^\d]', '', cnpj_match.group(1)) if cnpj_match else ""

        # Extract merchant name (usually in bold or header)
        name_patterns = [
            r'<span[^>]*class="[^"]*txtTopo[^"]*"[^>]*>([^<]+)</span>',
            r'<div[^>]*class="[^"]*txtTopo[^"]*"[^>]*>([^<]+)</div>',
            r'Razão Social[:\s]*</td>\s*<td[^>]*>([^<]+)</td>',
            r'Nome[:\s]*</td>\s*<td[^>]*>([^<]+)</td>',
        ]
        nome_emitente = ""
        for pattern in name_patterns:
            match = re.search(pattern, html, re.I)
            if match:
                nome_emitente = match.group(1).strip()
                break

        # Extract date
        date_match = re.search(r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})', html)
        data_emissao = datetime.now()
        if date_match:
            try:
                data_emissao = datetime.strptime(date_match.group(1), '%d/%m/%Y %H:%M:%S')
            except ValueError:
                pass

        # Extract total value
        total_patterns = [
            r'Valor total[:\s]*R?\$?\s*([\d.,]+)',
            r'VALOR TOTAL[:\s]*R?\$?\s*([\d.,]+)',
            r'Total[:\s]*R?\$?\s*([\d.,]+)',
        ]
        valor_total = Decimal("0")
        for pattern in total_patterns:
            match = re.search(pattern, html, re.I)
            if match:
                valor_str = match.group(1).replace('.', '').replace(',', '.')
                try:
                    valor_total = Decimal(valor_str)
                    break
                except:
                    pass

        # Extract items - this is the most complex part
        items = cls._extract_items_from_html(html)

        # Validate we have minimum required data
        if not items and valor_total == 0:
            return None

        return NFCeData(
            chave_acesso=access_key,
            data_emissao=data_emissao,
            cnpj_emitente=cnpj,
            nome_emitente=nome_emitente,
            valor_total=valor_total,
            itens=items,
        )

    @classmethod
    def _extract_items_from_html(cls, html: str) -> list[NFCeItem]:
        """Extract item list from NFCe HTML"""
        items = []

        # Common patterns for item rows in SEFAZ pages
        # Pattern 1: Table rows with item data
        table_pattern = r'<tr[^>]*class="[^"]*(?:item|produto)[^"]*"[^>]*>(.*?)</tr>'
        rows = re.findall(table_pattern, html, re.I | re.S)

        for row in rows:
            item = cls._parse_item_row(row)
            if item:
                items.append(item)

        # Pattern 2: Div-based layout (some states use this)
        if not items:
            div_pattern = r'<div[^>]*class="[^"]*(?:item|produto)[^"]*"[^>]*>(.*?)</div>'
            divs = re.findall(div_pattern, html, re.I | re.S)

            for div in divs:
                item = cls._parse_item_row(div)
                if item:
                    items.append(item)

        # Pattern 3: Try to find items in list format
        if not items:
            # Look for repeated structure with product name, quantity, price
            item_blocks = re.findall(
                r'([^<>\n]{3,50})\s*(?:Qtde|Qde|Quant)[.:\s]*(\d+[,.]?\d*)\s*(?:UN|PC|KG|L|M)\s*(?:Vl\.?\s*Unit|V\.?\s*Un)[.:\s]*R?\$?\s*(\d+[,.]?\d*)\s*(?:Vl\.?\s*Total|V\.?\s*Tot)[.:\s]*R?\$?\s*(\d+[,.]?\d*)',
                html, re.I
            )
            for block in item_blocks:
                try:
                    descricao, qtde, vl_unit, vl_total = block
                    items.append(NFCeItem(
                        descricao=descricao.strip(),
                        quantidade=Decimal(qtde.replace(',', '.')),
                        unidade="UN",
                        valor_unitario=Decimal(vl_unit.replace(',', '.')),
                        valor_total=Decimal(vl_total.replace(',', '.')),
                    ))
                except Exception as e:
                    logger.debug(f"Error parsing item block: {e}")

        return items

    @classmethod
    def _parse_item_row(cls, row_html: str) -> NFCeItem | None:
        """Parse a single item row from HTML"""
        # Extract text from HTML tags
        text = re.sub(r'<[^>]+>', ' ', row_html)
        text = re.sub(r'\s+', ' ', text).strip()

        if not text or len(text) < 10:
            return None

        # Try to parse the item data
        # Common format: "Product Name  Qty UN  Unit Price  Total Price"
        try:
            # Look for quantity pattern
            qty_match = re.search(r'(\d+[,.]?\d*)\s*(UN|PC|KG|L|M|G|ML)\s', text, re.I)
            if not qty_match:
                return None

            qty_str = qty_match.group(1).replace(',', '.')
            unit = qty_match.group(2).upper()

            # Product name is before quantity
            nome_end = qty_match.start()
            descricao = text[:nome_end].strip()

            # Prices are after quantity
            price_text = text[qty_match.end():]
            prices = re.findall(r'(\d+[,.]?\d*)', price_text)

            if len(prices) < 2:
                return None

            vl_unit = Decimal(prices[0].replace(',', '.'))
            vl_total = Decimal(prices[-1].replace(',', '.'))

            return NFCeItem(
                descricao=descricao,
                quantidade=Decimal(qty_str),
                unidade=unit,
                valor_unitario=vl_unit,
                valor_total=vl_total,
            )

        except Exception as e:
            logger.debug(f"Error parsing item row: {e}")
            return None

    @classmethod
    def _build_consultation_url(cls, uf_code: str, access_key: str) -> str | None:
        """
        Build NFCe consultation URL based on state code.

        Args:
            uf_code: 2-digit state code (first 2 digits of access key)
            access_key: 44-digit access key

        Returns:
            Consultation URL or None if state not supported
        """
        # State codes and their SEFAZ URLs
        # Note: This is a simplified mapping, real implementation would be more comprehensive
        url_templates = {
            # São Paulo
            "35": f"https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx?p={access_key}",
            # Minas Gerais
            "31": f"https://portalsped.fazenda.mg.gov.br/portalnfce/sistema/consultaarg.xhtml?p={access_key}",
            # Rio de Janeiro
            "33": f"https://www.nfce.fazenda.rj.gov.br/consulta?p={access_key}",
            # Rio Grande do Sul
            "43": f"https://www.sefaz.rs.gov.br/NFCE/NFCE-COM.aspx?p={access_key}",
            # Paraná
            "41": f"https://nfce.sefa.pr.gov.br/nfce-consulta/consultarNFCe?p={access_key}",
            # Santa Catarina
            "42": f"https://sat.sef.sc.gov.br/nfce/consulta?p={access_key}",
            # Bahia
            "29": f"https://nfe.sefaz.ba.gov.br/servicos/nfce/default.aspx?p={access_key}",
            # Goiás
            "52": f"https://nfce.sefaz.go.gov.br/nfeweb/jsp/ConsultarNFCe.jsf?p={access_key}",
            # Distrito Federal
            "53": f"https://dec.fazenda.df.gov.br/ConsultarNFCe.aspx?p={access_key}",
            # Ceará
            "23": f"https://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p={access_key}",
            # Pernambuco
            "26": f"https://nfce.sefaz.pe.gov.br/nfce/consulta?p={access_key}",
            # Amazonas
            "13": f"https://sistemas.sefaz.am.gov.br/nfceweb/consultarNFCe.jsp?p={access_key}",
            # Pará
            "15": f"https://appnfc.sefa.pa.gov.br/portal/view/consultas/nfce/consultanfce.seam?p={access_key}",
            # Mato Grosso
            "51": f"https://www.sefaz.mt.gov.br/nfce/consultanfce?p={access_key}",
            # Mato Grosso do Sul
            "50": f"https://nfce.sefaz.ms.gov.br/nfceweb/consultaNFCe.jsp?p={access_key}",
        }

        return url_templates.get(uf_code)
