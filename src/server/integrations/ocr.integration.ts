/* eslint-disable @typescript-eslint/no-explicit-any */
import * as pdfParse from 'pdf-parse';

/**
 * Integração com extração de texto de PDF (com fallback multimodal inteligente)
 * Responsável por extrair o texto de arquivos PDF. Se o PDF for baseado em imagens (escaner),
 * a extração retorna texto mínimo e delega ao poder multimodal nativo do Gemini (Visão/PDF).
 */
export class OcrIntegration {
  static async extractTextFromPdfBase64(base64: string): Promise<string> {
    try {
      if (!base64) return '';
      
      const buffer = Buffer.from(base64, 'base64');
      
      // Resolve compatibilidade de importação padrão/ESM de pdf-parse
      const parsePdf = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any).default || pdfParse;
      
      if (typeof parsePdf !== 'function') {
        console.warn('[OcrIntegration] pdf-parse não pôde ser resolvido como função.');
        return '';
      }
      
      const parsedData = await parsePdf(buffer);
      if (parsedData && parsedData.text) {
        const cleanText = parsedData.text.trim();
        if (cleanText.length > 50) {
          console.log(`[OcrIntegration] pdf-parse extraiu com sucesso ${cleanText.length} caracteres do PDF.`);
          return cleanText;
        }
      }
    } catch (e) {
      console.warn('[OcrIntegration] pdf-parse falhou ao ler PDF, aplicando heurística de fallback:', e);
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
      console.warn('[OcrIntegration] Método alternativo de extração falhou:', e);
    }

    console.log('[OcrIntegration] Não foi possível extrair texto diretamente. Delegando processamento ao motor multimodal nativo do Gemini.');
    return '';
  }
}
