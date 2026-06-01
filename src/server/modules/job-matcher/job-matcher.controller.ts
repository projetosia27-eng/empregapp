/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Type } from '@google/genai';
import { CacheIntegration } from '../../integrations/cache.integration';
import { generateContentWithRetry } from '../../utils/ai-retry';

/**
 * Módulo 5: Match entre perfil e vaga com Caching e Otimização
 */
export class JobMatcherController {
  static async analyzeProfile(req: any, res: any) {
    try {
      const data = req.body;

      // 1. Evitar reprocessamento de análise usando Cache
      const cached = CacheIntegration.get<any>('job-matcher', data);
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
              { text: `Analise o seguinte perfil profissional e forneça uma lista concisa para cada uma das categorias solicitadas.\n\nPerfil:\n${JSON.stringify(data)}` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pontosFortes: { type: Type.ARRAY, items: { type: Type.STRING } },
              palavrasChave: { type: Type.ARRAY, items: { type: Type.STRING } },
              areasCompativeis: { type: Type.ARRAY, items: { type: Type.STRING } },
              cargosRecomendados: { type: Type.ARRAY, items: { type: Type.STRING } },
              oQueMelhorar: { type: Type.ARRAY, items: { type: Type.STRING } },
              habilidadesParaDesenvolver: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('job-matcher', data, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error analyzing profile:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to analyze profile' });
      }
    }
  }
}
