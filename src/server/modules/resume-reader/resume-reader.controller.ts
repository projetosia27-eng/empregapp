/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Type } from '@google/genai';
import { OcrIntegration } from '../../integrations/ocr.integration';
import { CacheIntegration } from '../../integrations/cache.integration';
import { generateContentWithRetry } from '../../utils/ai-retry';

/**
 * Módulo 2: Leitura de Currículo com Caching e Otimização de Tokens
 */
export class ResumeReaderController {
  static async parseResume(req: any, res: any) {
    try {
      const { pdfBase64 } = req.body;
      if (!pdfBase64) {
        res.status(400).json({ error: 'Missing PDF data' });
        return;
      }

      // 1. Usar resposta salva (Cache) para evitar qualquer custo de IA/Processamento
      const cached = CacheIntegration.get<any>('resume-reader', pdfBase64);
      if (cached) {
        res.json(cached);
        return;
      }

      // 2. Tentar extrair o texto limpo do PDF (Economia massiva de tokens vs PDF binário)
      const textExtra = await OcrIntegration.extractTextFromPdfBase64(pdfBase64);

      const ai = new GoogleGenAI({
        apiKey: process.env['GEMINI_API_KEY']!,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      
      let contents: any;
      if (textExtra && textExtra !== "Texto extraído simulado via OCR" && textExtra.length > 50) {
        // Se temos o texto, enviamos apenas o texto no prompt - reduz consumo de tokens em 90%
        contents = [
          {
            role: 'user',
            parts: [
              { text: `Extraia as seguintes informações estruturadas do currículo fornecido abaixo. Se um campo não for identificado, deixe-o em branco.\n\nConteúdo do Currículo:\n${textExtra}` }
            ]
          }
        ];
      } else {
        // Fallback para arquivo PDF binário, se for imagem pura, mas com instruções simplificadas
        contents = [
          {
            role: 'user',
            parts: [
              { text: 'Extraia os campos em JSON deste currículo.' },
              { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }
            ]
          }
        ];
      }

      // Usar gemini-3.5-flash recomendado para tarefas de texto
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-flash',
        contents: contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nome: { type: Type.STRING },
              email: { type: Type.STRING },
              telefone: { type: Type.STRING },
              cidadeEstado: { type: Type.STRING },
              areaInteresse: { type: Type.STRING },
              ultimoCargo: { type: Type.STRING },
              tempoExperiencia: { type: Type.STRING, description: "Exactly: 'Sem experiência', 'Menos de 1 ano', '1 a 3 anos', '3 a 5 anos', 'Mais de 5 anos'" },
              escolaridade: { type: Type.STRING, description: "Exactly: 'Ensino Fundamental', 'Ensino Médio Incompleto', 'Ensino Médio Completo', 'Ensino Superior Incompleto', 'Ensino Superior Completo', 'Pós-graduação / Especialização'" },
              habilidades: { type: Type.STRING, description: "Comma separated list of main skills" },
              experiencias: { type: Type.STRING, description: "Summary of professional experiences" },
              cursos: { type: Type.STRING, description: "List of courses and certificates" },
              tipoVaga: { type: Type.STRING, description: "Exactly: 'presencial', 'hibrida', 'remota'." }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Registrar no Cache para futuras chamadas apenas se contiver dados reais
        const hasData = Object.values(parsed).some(val => val && String(val).trim().length > 0);
        if (hasData) {
          CacheIntegration.set('resume-reader', pdfBase64, parsed);
        } else {
          console.log('[ResumeReaderController] Ignorando salvamento em cache pois o perfil extraído está vazio.');
        }
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error parsing resume:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to parse resume' });
      }
    }
  }
}
