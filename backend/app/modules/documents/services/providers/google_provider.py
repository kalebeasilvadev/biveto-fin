"""Google Gemini provider para extracao de documentos"""
import asyncio
import base64
import os
import tempfile

from app.core.config import settings
from .base import BaseProvider


# Configuracao de retry
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 2.0


class GoogleProvider(BaseProvider):
    """Provider Google Gemini para extracao de documentos"""

    def __init__(self, model: str | None = None, prompt: str = "", response_schema=None, parse_response_fn=None):
        super().__init__(model or settings.vision_model or 'gemini-2.0-flash')
        self.max_retries = DEFAULT_MAX_RETRIES
        self.retry_delay = DEFAULT_RETRY_DELAY
        self._client = None
        self.prompt = prompt
        self.response_schema = response_schema
        self._parse_response = parse_response_fn or (lambda x: {'items': [], 'error': 'No parser'})

    def _get_client(self):
        """Obtem cliente Google Genai (lazy initialization)"""
        if self._client is None:
            try:
                from google import genai
                api_key = settings.google_api_key
                if not api_key:
                    raise ValueError("GOOGLE_API_KEY nao configurada")
                self._client = genai.Client(api_key=api_key)
            except ImportError:
                raise ImportError("google-genai nao instalado. Execute: pip install google-genai")
        return self._client

    async def extract_from_image(self, image_content: bytes, mime_type: str) -> dict:
        """Extrai dados de uma imagem usando Google Gemini"""
        try:
            from google.genai import types
        except ImportError:
            return await self._call_httpx(image_content, mime_type)

        client = self._get_client()

        last_error = None
        for attempt in range(self.max_retries):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=[
                        types.Part.from_bytes(data=image_content, mime_type=mime_type),
                        self.prompt,
                    ],
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        max_output_tokens=16000,
                    ),
                )
                return self._parse_response(response.text)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def extract_from_pdf(self, pdf_content: bytes, filename: str = "document.pdf") -> dict:
        """Extrai dados de um PDF via upload para o Gemini"""
        try:
            from google.genai import types
        except ImportError:
            print("[GoogleProvider] google.genai not available, falling back to image conversion")
            return None  # Sinaliza para usar fallback

        client = self._get_client()
        print(f"[GoogleProvider] Using PDF upload method, model={self.model}")

        temp_file = None
        try:
            # Salvar PDF em arquivo temporario (em thread separada)
            def _write_temp():
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as f:
                    f.write(pdf_content)
                    return f.name

            temp_file = await asyncio.to_thread(_write_temp)

            # Upload do PDF para o Gemini
            print(f"[GoogleProvider] Uploading PDF to Gemini...")
            uploaded_file = client.files.upload(
                file=temp_file,
                config={"mime_type": "application/pdf"},
            )
            print(f"[GoogleProvider] PDF uploaded: uri={uploaded_file.uri}")

            last_error = None
            for attempt in range(self.max_retries):
                try:
                    print(f"[GoogleProvider] Calling Gemini API (attempt {attempt + 1}/{self.max_retries})...")
                    response = client.models.generate_content(
                        model=self.model,
                        contents=[
                            types.Part.from_uri(
                                file_uri=uploaded_file.uri,
                                mime_type=uploaded_file.mime_type,
                            ),
                            self.prompt,
                        ],
                        config=types.GenerateContentConfig(
                            temperature=0.1,
                            response_mime_type="application/json",
                            response_schema=self.response_schema,
                        ),
                    )

                    response_text = response.text if response else ""
                    print(f"[GoogleProvider] Response length: {len(response_text)} chars")
                    return self._parse_response(response_text)

                except Exception as e:
                    last_error = e
                    print(f"[GoogleProvider] API error (attempt {attempt + 1}): {type(e).__name__}: {e}")
                    if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                        wait_time = self.retry_delay * (2 ** attempt)
                        print(f"[GoogleProvider] Retrying in {wait_time}s...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise

            return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

        finally:
            if temp_file and os.path.exists(temp_file):
                await asyncio.to_thread(os.unlink, temp_file)

    async def extract_multi_page(self, images: list[tuple[bytes, str]]) -> dict:
        """Extrai dados de multiplas paginas usando SDK oficial"""
        try:
            from google.genai import types
        except ImportError:
            print("[GoogleProvider] google.genai not available, using httpx fallback")
            return await self._call_multi_page_httpx(images)

        client = self._get_client()
        print(f"[GoogleProvider] Using Google SDK, model={self.model}")

        parts = [self.prompt + "\n\n ATENCAO: Este documento tem MULTIPLAS PAGINAS. Extraia TODAS as transacoes de TODAS as paginas!"]

        for i, (img_content, img_mime) in enumerate(images):
            parts.append(types.Part.from_bytes(data=img_content, mime_type=img_mime))
            parts.append(f'[Pagina {i+1} de {len(images)}]')

        last_error = None
        for attempt in range(self.max_retries):
            try:
                print(f"[GoogleProvider] Calling Gemini API (attempt {attempt + 1}/{self.max_retries})...")
                response = client.models.generate_content(
                    model=self.model,
                    contents=parts,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json",
                        response_schema=self.response_schema,
                    ),
                )

                response_text = response.text if response else ""
                print(f"[GoogleProvider] Response length: {len(response_text)} chars")
                return self._parse_response(response_text)

            except Exception as e:
                last_error = e
                print(f"[GoogleProvider] API error (attempt {attempt + 1}): {type(e).__name__}: {e}")
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    print(f"[GoogleProvider] Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    raise

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def _call_httpx(self, image_content: bytes, mime_type: str) -> dict:
        """Fallback: Chama Google Gemini API via httpx"""
        import httpx

        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY nao configurada'}

        image_base64 = base64.b64encode(image_content).decode('utf-8')

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent',
                        headers={
                            'x-goog-api-key': api_key,
                            'Content-Type': 'application/json',
                        },
                        json={
                            'contents': [{
                                'parts': [
                                    {'text': self.prompt},
                                    {
                                        'inline_data': {
                                            'mime_type': mime_type,
                                            'data': image_base64,
                                        }
                                    }
                                ]
                            }],
                            'generationConfig': {
                                'temperature': 0.1,
                                'maxOutputTokens': 16000,
                            }
                        },
                    )

                    if response.status_code != 200:
                        error_msg = f'Google API error: {response.status_code}'
                        if response.status_code in [503, 429]:
                            raise Exception(error_msg)
                        return {'items': [], 'error': error_msg}

                    result = response.json()
                    content = result['candidates'][0]['content']['parts'][0]['text']
                    return self._parse_response(content)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                elif 'httpx' not in str(type(e).__module__):
                    raise

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}

    async def _call_multi_page_httpx(self, images: list[tuple[bytes, str]]) -> dict:
        """Fallback: Chama Google Gemini API com multiplas paginas via httpx"""
        import httpx

        api_key = settings.google_api_key
        if not api_key:
            return {'items': [], 'error': 'GOOGLE_API_KEY nao configurada'}

        parts = [{'text': self.prompt + "\n\n ATENCAO: Este documento tem MULTIPLAS PAGINAS. Extraia TODAS as transacoes de TODAS as paginas!"}]

        for i, (img_content, img_mime) in enumerate(images):
            image_base64 = base64.b64encode(img_content).decode('utf-8')
            parts.append({
                'inline_data': {
                    'mime_type': img_mime,
                    'data': image_base64,
                }
            })
            parts.append({'text': f'[Pagina {i+1} de {len(images)}]'})

        last_error = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f'https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent',
                        headers={
                            'x-goog-api-key': api_key,
                            'Content-Type': 'application/json',
                        },
                        json={
                            'contents': [{'parts': parts}],
                            'generationConfig': {
                                'temperature': 0.1,
                                'maxOutputTokens': 32000,
                            }
                        },
                    )

                    if response.status_code != 200:
                        error_msg = f'Google API error: {response.status_code}'
                        if response.status_code in [503, 429]:
                            raise Exception(error_msg)
                        return {'items': [], 'error': error_msg}

                    result = response.json()
                    if not result.get('candidates'):
                        return {'items': [], 'error': 'Google API retornou resposta vazia'}

                    content = result['candidates'][0]['content']['parts'][0]['text']
                    return self._parse_response(content)

            except Exception as e:
                last_error = e
                if self._is_retryable_error(e) and attempt < self.max_retries - 1:
                    wait_time = self.retry_delay * (2 ** attempt)
                    await asyncio.sleep(wait_time)
                    continue
                elif 'httpx' not in str(type(e).__module__):
                    raise

        return {'items': [], 'error': f'Falha apos {self.max_retries} tentativas: {last_error}'}
