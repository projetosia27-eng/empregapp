/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Type } from '@google/genai';
import { PdfIntegration } from '../../integrations/pdf.integration';
import { CacheIntegration } from '../../integrations/cache.integration';
import { generateContentWithRetry } from '../../utils/ai-retry';

/**
 * Módulo 3: Geração de Currículo com Caching e Otimização
 */
export class ResumeGeneratorController {
  static async generateResumeContent(req: any, res: any) {
    try {
      const data = req.body;

      // 1. Verificar cache local para evitar custos repetidos
      const cached = CacheIntegration.get<any>('resume-generator', data);
      if (cached) {
        res.json(cached);
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: process.env['GEMINI_API_KEY']!,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Dado o seguinte perfil profissional de um candidato, gere um "Resumo Profissional" (1 parágrafo persuasivo e direto) e um "Objetivo Profissional" (1 pequena frase) adequados para destacar o candidato em sistemas ATS (Applicant Tracking Systems) e para recrutadores.\n\nPerfil:\n${JSON.stringify(data)}` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              resumo: { type: Type.STRING },
              objetivo: { type: Type.STRING }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('resume-generator', data, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error generating resume data:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to generate resume' });
      }
    }
  }

  static async downloadPdf(req: any, res: any) {
    try {
      const pdfBuffer = await PdfIntegration.generateResumePdf(req.body);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="curriculo.pdf"');
      res.send(pdfBuffer);
    } catch {
      res.status(500).json({ error: 'Error generating PDF file' });
    }
  }

  static async optimizeLinkedIn(req: any, res: any) {
    try {
      const data = req.body;

      // 1. Verificar cache local para baixo custo operacional e resposta instantânea
      const cached = CacheIntegration.get<any>('linkedin-optimize', data);
      if (cached) {
        res.json(cached);
        return;
      }

      const ai = new GoogleGenAI({
        apiKey: process.env['GEMINI_API_KEY']!,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Dado o seguinte perfil profissional de um candidato, gere um "Título para LinkedIn" altamente otimizado para SEO/Recrutadores e um texto para o campo "Sobre Mim" do LinkedIn que destaque as habilidades e seja atrativo.\n\nPerfil:\n${JSON.stringify(data)}` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING, description: "Punchy, modern LinkedIn title (e.g., Cargo | Habilidade | Valor entregue)" },
              aboutMe: { type: Type.STRING, description: "Stunning About section for LinkedIn (2-3 short, clean paragraphs + skills list)" },
              advice: { type: Type.STRING, description: "Practical advice on settings, URL, custom flags for LinkedIn" }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('linkedin-optimize', data, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error optimizing LinkedIn profile:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to optimize LinkedIn profile' });
      }
    }
  }
}
