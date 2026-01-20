"""
QR Code extraction service for NFCe (Nota Fiscal de Consumidor Eletrônica)
"""
import io
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class QRCodeExtractionResult:
    """Result of QR code extraction"""
    def __init__(
        self,
        url: str | None = None,
        access_key: str | None = None,
        error: str | None = None,
    ):
        self.url = url
        self.access_key = access_key
        self.error = error

    @property
    def is_success(self) -> bool:
        return self.url is not None

    def to_dict(self) -> dict:
        return {
            "url": self.url,
            "access_key": self.access_key,
            "error": self.error,
            "is_success": self.is_success,
        }


class QRCodeService:
    """Service for extracting QR codes from images"""

    # Regex to extract access key (44 digits) from NFCe URL
    ACCESS_KEY_PATTERN = re.compile(r'chNFe=(\d{44})|p=(\d{44})')

    @classmethod
    def extract_from_image(cls, image_bytes: bytes) -> QRCodeExtractionResult:
        """
        Extract QR code URL from an image.

        Args:
            image_bytes: Raw image bytes

        Returns:
            QRCodeExtractionResult with URL and access key if found
        """
        try:
            from pyzbar.pyzbar import decode, ZBarSymbol
            from PIL import Image
        except ImportError as e:
            logger.error(f"Required libraries not installed: {e}")
            return QRCodeExtractionResult(
                error="Bibliotecas de QR Code não instaladas. Por favor, instale pyzbar."
            )

        try:
            # Open image from bytes
            image = Image.open(io.BytesIO(image_bytes))

            # Convert to RGB if necessary (pyzbar works better with RGB)
            if image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')

            # Decode QR codes from image
            decoded_objects = decode(image, symbols=[ZBarSymbol.QRCODE])

            if not decoded_objects:
                # Try with grayscale conversion for better detection
                gray_image = image.convert('L')
                decoded_objects = decode(gray_image, symbols=[ZBarSymbol.QRCODE])

            if not decoded_objects:
                return QRCodeExtractionResult(
                    error="Nenhum QR Code encontrado na imagem"
                )

            # Get the first QR code
            qr_data = decoded_objects[0].data.decode('utf-8')
            logger.info(f"QR Code found: {qr_data[:100]}...")

            # Validate it looks like an NFCe URL
            if not cls._is_nfce_url(qr_data):
                return QRCodeExtractionResult(
                    error="QR Code encontrado, mas não parece ser de uma NFCe"
                )

            # Extract access key
            access_key = cls._extract_access_key(qr_data)

            return QRCodeExtractionResult(
                url=qr_data,
                access_key=access_key,
            )

        except Exception as e:
            logger.error(f"Error extracting QR code: {e}", exc_info=True)
            return QRCodeExtractionResult(
                error=f"Erro ao processar imagem: {str(e)}"
            )

    @classmethod
    def _is_nfce_url(cls, url: str) -> bool:
        """Check if URL looks like an NFCe consultation URL"""
        nfce_indicators = [
            'nfce',
            'nfe',
            'sefaz',
            'fazenda',
            'portalsped',
            'sat.sef',
            'svrs.rs.gov',
        ]
        url_lower = url.lower()
        return any(indicator in url_lower for indicator in nfce_indicators)

    @classmethod
    def _extract_access_key(cls, url: str) -> str | None:
        """Extract the 44-digit access key from NFCe URL"""
        # Try the regex patterns
        match = cls.ACCESS_KEY_PATTERN.search(url)
        if match:
            return match.group(1) or match.group(2)

        # Try to find any 44-digit sequence
        all_digits = re.findall(r'\d{44}', url)
        if all_digits:
            return all_digits[0]

        return None

    @classmethod
    def extract_from_base64(cls, base64_data: str) -> QRCodeExtractionResult:
        """
        Extract QR code from base64-encoded image.

        Args:
            base64_data: Base64-encoded image (with or without data URI prefix)

        Returns:
            QRCodeExtractionResult
        """
        import base64

        # Remove data URI prefix if present
        if ',' in base64_data:
            base64_data = base64_data.split(',')[1]

        try:
            image_bytes = base64.b64decode(base64_data)
            return cls.extract_from_image(image_bytes)
        except Exception as e:
            logger.error(f"Error decoding base64 image: {e}")
            return QRCodeExtractionResult(
                error=f"Erro ao decodificar imagem: {str(e)}"
            )
