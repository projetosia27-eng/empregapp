/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Integração com extração de texto de PDF (com fallback multimodal inteligente)
 * Responsável por extrair o texto de arquivos PDF. Se o PDF for baseado em imagens (escaner),
 * a extração usa o OCR.space ou o poder multimodal nativo do Gemini (Visão/PDF).
 */
export class OcrIntegration {
  static async extractTextFromPdfBase64(base64: string): Promise<string> {
    try {
      if (!base64) return '';
      
      const buffer = Buffer.from(base64, 'base64');
      
      let pdfParseModule: any;
      try {
        pdfParseModule = await import('pdf-parse');
      } catch (importErr) {
        console.warn('[OcrIntegration] Falha ao importar pdf-parse dinamicamente:', importErr);
      }

      const pdfParse = pdfParseModule ? (pdfParseModule.default || pdfParseModule) : null;
      
      if (!pdfParse) {
        console.warn('[OcrIntegration] pdf-parse não pôde ser resolvido.');
      } else {
        // Resolve compatibilidade de importação padrão/ESM de pdf-parse
        const parsePdf = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || pdfParse;
        
        if (typeof parsePdf !== 'function') {
          console.warn('[OcrIntegration] pdf-parse não pôde ser resolvido como função.');
        } else {
          const parsedData = await parsePdf(buffer);
          if (parsedData && parsedData.text) {
            const cleanText = parsedData.text.trim();
            if (cleanText.length > 150) {
              console.log(`[OcrIntegration] pdf-parse extraiu com sucesso ${cleanText.length} caracteres do PDF.`);
              return cleanText;
            } else {
              console.log(`[OcrIntegration] pdf-parse extraiu apenas ${cleanText.length} caracteres do PDF (provável escâner/imagem).`);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[OcrIntegration] pdf-parse falhou ao ler PDF:', e);
    }

    // Se falhar ou extrair pouco texto, tenta OCR.space!
    try {
      console.log('[OcrIntegration] Tentando extração de texto via OCR.space API...');
      const ocrSpaceText = await OcrIntegration.extractTextViaOcrSpace(base64);
      if (ocrSpaceText && ocrSpaceText.length > 50) {
        console.log(`[OcrIntegration] OCR.space extraiu com sucesso ${ocrSpaceText.length} caracteres.`);
        return ocrSpaceText;
      }
    } catch (ocrErr) {
      console.error('[OcrIntegration] Falha ao executar OCR.space:', ocrErr);
    }

    console.log('[OcrIntegration] Não foi possível extrair texto diretamente via pdf-parse ou OCR.space. Delegando processamento.');
    return '';
  }

  /**
   * Envia o PDF em base64 para a API do OCR.space e retorna o texto extraído.
   */
  static async extractTextViaOcrSpace(base64: string): Promise<string> {
    const apiKey = process.env['OCR_SPACE_API_KEY'] || 'helloworld';
    console.log(`[OcrIntegration] Enviando requisição para OCR.space (usando chave: ${apiKey === 'helloworld' ? 'helloworld (grátis)' : 'personalizada'})`);

    try {
      let base64Data = base64;
      if (!base64Data.startsWith('data:')) {
        base64Data = `data:application/pdf;base64,${base64Data}`;
      }

      const params = new URLSearchParams();
      params.append('apikey', apiKey);
      params.append('base64Image', base64Data);
      params.append('language', 'por'); // Tradução / Leitura em Português
      params.append('isOverlayRequired', 'false');
      params.append('filetype', 'PDF');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
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
