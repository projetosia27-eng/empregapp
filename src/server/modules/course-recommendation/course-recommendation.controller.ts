/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Type } from '@google/genai';
import { CacheIntegration } from '../../integrations/cache.integration';
import { generateContentWithRetry } from '../../utils/ai-retry';

/**
 * Módulo 6: Cursos recomendados com Caching e Otimização
 */
export class CourseRecommendationController {
  static async recommendCourses(req: any, res: any) {
    try {
      const data = req.body;

      // 1. Obter resposta rápida do cache para poupar faturamento de API
      const cached = CacheIntegration.get<any>('course-recommendation', data);
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
              { text: `Com base no seguinte perfil de candidato, elabore um plano de ação de 3 meses focado em qualificação rápida e prática para ajudá-lo a conseguir as vagas desejadas na sua área. Para cada mês (Mês 1, Mês 2, Mês 3), defina um objetivo (foco) e recomende até 2 cursos GRATUITOS (online, rápidos). O resultado deve ser a trilha dividida em meses.\n\nPerfil:\n${JSON.stringify(data)}` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              trilha: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    mes: { type: Type.STRING },
                    foco: { type: Type.STRING },
                    cursos: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          nome: { type: Type.STRING },
                          plataforma: { type: Type.STRING },
                          duracao: { type: Type.STRING },
                          habilidadeDesenvolvida: { type: Type.STRING },
                          justificativa: { type: Type.STRING },
                          linkUrl: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('course-recommendation', data, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error recommending courses:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to recommend courses' });
      }
    }
  }
}
