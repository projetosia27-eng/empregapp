/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integração com extração de texto de PDF (com fallback multimodal inteligente)
 * Responsável por extrair o texto de arquivos PDF. Se o PDF for baseado em imagens (escaner)
 * ou se falhar localmente, a extração usa o canal de alta performance do OCR.space.
 */
export class OcrIntegration {
  static async extractTextFromPdfBase64(base64: string): Promise<string> {
    try {
      if (!base64) return '';

      console.log('[OcrIntegration] Iniciando extração de texto via OCR.space API (Vercel-Safe)...');
      
      // Tenta extrair diretamente com o OCR.space
      const ocrSpaceText = await OcrIntegration.extractTextViaOcrSpace(base64);
      if (ocrSpaceText && ocrSpaceText.length > 50) {
        console.log(`[OcrIntegration] OCR.space extraiu com sucesso ${ocrSpaceText.length} caracteres.`);
        return ocrSpaceText;
      }
    } catch (ocrErr) {
      console.error('[OcrIntegration] Falha ao executar OCR.space:', ocrErr);
    }

    console.log('[OcrIntegration] Não foi possível extrair o texto do PDF via OCR.space.');
    return '';
  }

  /**
   * Envia o PDF em base64 para a API do OCR.space e retorna o texto extraído.
   * Utiliza multipart/form-data para evitar limites de url-encode de PDFs grandes no Vercel.
   */
  static async extractTextViaOcrSpace(base64: string): Promise<string> {
    const apiKey = process.env['OCR_SPACE_API_KEY'] || 'helloworld';
    console.log(`[OcrIntegration] Enviando requisição para OCR.space (usando chave: ${apiKey === 'helloworld' ? 'helloworld (grátis)' : 'personalizada'})`);

    try {
      let base64Data = base64;
      // Garante que o prefixo base64 correto do PDF esteja presente para o OCR.space
      if (!base64Data.startsWith('data:')) {
        base64Data = `data:application/pdf;base64,${base64Data}`;
      }

      // Usando FormData nativo (disponível no Node.js 18+ / Vercel), evitando URLSearchParams / url-encoding de arquivo binário pesado
      const formData = new FormData();
      formData.append('apikey', apiKey);
      formData.append('base64Image', base64Data);
      formData.append('language', 'por'); // Escaneamento em Português
      formData.append('isOverlayRequired', 'false');
      formData.append('filetype', 'PDF');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData, // fetch configura automaticamente o boundary de multipart/form-data
      });

      if (!response.ok) {
        throw new Error(`Erro na chamada HTTP para o OCR.space: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as any;
      
      if (result.IsErroredOnProcessing) {
        console.warn('[OcrIntegration] OCR.space reportou erro no processamento:', result.ErrorMessage || result.ErrorDetails);
        return '';
      }

      if (result.ParsedResults && Array.isArray(result.ParsedResults) && result.ParsedResults.length > 0) {
        let extractedText = '';
        for (const page of result.ParsedResults) {
          if (page.ParsedText) {
            extractedText += page.ParsedText + '\n';
          }
        }
        return extractedText.trim();
      }
    } catch (error) {
      console.error('[OcrIntegration] Erro ao obter texto extraído via OCR.space API:', error);
    }
    return '';
  }
}
