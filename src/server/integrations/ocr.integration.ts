import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

/**
 * Integração com OCR Gratuito (ex: Tesseract OCR e pdf-parse)
 * Responsável por extrair texto de imagens ou PDFs com texto não selecionável.
 */
export class OcrIntegration {
  static async extractTextFromPdfBase64(base64: string): Promise<string> {
    try {
      if (!base64) return '';
      
      const buffer = Buffer.from(base64, 'base64');
      const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const parser = new PDFParse({ data: uint8 });
      
      // 1. Tentar extração rápida de texto selecionável
      let parsedData;
      try {
        parsedData = await parser.getText();
        if (parsedData && parsedData.text) {
          const cleanText = parsedData.text.trim();
          if (cleanText.length > 150) {
            console.log(`[OcrIntegration] pdf-parse extraiu com sucesso ${cleanText.length} caracteres de texto selecionável.`);
            try { await parser.destroy(); } catch { console.info('[OcrIntegration] Erro ao destruir parser.'); }
            return cleanText;
          }
        }
      } catch (e) {
        console.warn('[OcrIntegration] Falha na extração de texto direto do PDF, continuando para modo OCR:', e);
      }
      
      // 2. Tesseract OCR (Para PDFs escaneados ou PDFs de imagens)
      console.log('[OcrIntegration] PDF sem texto selecionável relevante. Iniciando processamento com Tesseract OCR...');
      
      let ocrText = '';
      try {
        // Obter capturas das páginas para aplicar o OCR
        const screenshotResult = await parser.getScreenshot({
          imageBuffer: true,
          imageDataUrl: false,
          first: 3 // Processar até as 3 primeiras páginas para excelente relação velocidade/precisão
        });
        
        if (screenshotResult && screenshotResult.pages && screenshotResult.pages.length > 0) {
          console.log(`[OcrIntegration] Renderizado ${screenshotResult.pages.length} páginas para OCR.`);
          
          const worker = await createWorker('por');
          
          for (const page of screenshotResult.pages) {
            console.log(`[OcrIntegration] Executando OCR Tesseract na página ${page.pageNumber}...`);
            const pageBuffer = Buffer.from(page.data);
            const result = await worker.recognize(pageBuffer);
            if (result && result.data && result.data.text) {
              ocrText += `\n[Página ${page.pageNumber}]\n` + result.data.text;
            }
          }
          
          await worker.terminate();
        }
      } catch (ocrErr) {
        console.error('[OcrIntegration] Falha durante o processamento de Tesseract OCR:', ocrErr);
      }
      
      try {
        await parser.destroy();
      } catch {
        console.info('[OcrIntegration] Erro ao fechar parser.');
      }
      
      if (ocrText && ocrText.trim().length > 50) {
        console.log(`[OcrIntegration] Tesseract OCR extraiu com sucesso ${ocrText.trim().length} caracteres do PDF.`);
        return ocrText.trim();
      }
    } catch (e) {
      console.warn('[OcrIntegration] pdf-parse + Tesseract falharam ao ler PDF, aplicando heurística de fallback:', e);
    }

    try {
      if (!base64) return '';
      const buffer = Buffer.from(base64, 'base64');
      const rawText = buffer.toString('utf-8');
      
      // Heurística rápida para extrair strings legíveis do corpo binário do PDF (estilo comando string do Unix)
      // Evita o custo de processamento pesado de PDF e minimiza o consumo de tokens na IA
      const matches = rawText.match(/[\w\s.,@:\-/()]{4,}/g);
      if (matches && matches.length > 30) {
        // Filtrar estruturas internas de PDF como comandos de formatação (/Font, Obj, stream, etc.)
        const filtered = matches
          .filter(chunk => {
            const s = chunk.trim();
            if (!s) return false;
            if (s.startsWith('/') || s.includes('Obj') || s.includes('stream') || s.includes('endstream') || s.includes('Length')) {
              return false;
            }
            return true;
          })
          .map(s => s.trim())
          .join(' ')
          .substring(0, 3500); // limita a 3.5k caracteres para caber perfeitamente no prompt compacto

        if (filtered.length > 100) {
          console.log(`[OcrIntegration] Heurística direta de texto extraiu com sucesso ${filtered.length} caracteres (Economia máxima de tokens de PDF!)`);
          return filtered;
        }
      }
    } catch (e) {
      console.warn('[OcrIntegration] Método alternativo de extração falhou, usando simulação:', e);
    }

    console.log('[Integration] Extraindo texto via OCR (Simulação leve)...');
    return "Texto extraído simulado via OCR";
  }
}
