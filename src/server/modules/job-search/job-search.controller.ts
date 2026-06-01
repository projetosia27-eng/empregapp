/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Type } from '@google/genai';
import { CacheIntegration } from '../../integrations/cache.integration';
import { generateContentWithRetry } from '../../utils/ai-retry';

/**
 * Módulo 4: Motor de busca de vagas com Caching e Otimização
 */
export class JobSearchController {
  static async searchJobs(req: any, res: any) {
    try {
      const data = req.body;

      // 1. Verificar cache local para poupar IA
      const cached = CacheIntegration.get<any[]>('real-job-search-v1', data);
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
              { text: `Faça uma pesquisa real na internet em sites como LinkedIn, Catho, Infojobs, ou Gupy por vagas reais e recentes adequadas ao perfil do candidato abaixo.
Gere 4 vagas de emprego REAIS encontradas na busca. Para cada vaga, inclua o título oficial, a empresa real contratante, a localização, a URL de acesso da vaga (se possível), o tipo de trabalho (Remoto, Presencial, Híbrido), uma lista de requisitos e conhecimentos exigidos pela vaga, um grau de compatibilidade (0 a 100) com o currículo fornecido e uma explicação do porquê o match. 
O resultado DEVE ser um array JSON estrito correspondente ao schema fornecido.

Perfil do Candidato:
${JSON.stringify(data)}` }
            ]
          }
        ],
        config: {
          tools: [{ googleSearch: {} }],
          toolConfig: { includeServerSideToolInvocations: true },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                titulo: { type: Type.STRING },
                empresa: { type: Type.STRING },
                localizacao: { type: Type.STRING },
                tipoTrabalho: { type: Type.STRING },
                url: { type: Type.STRING, description: 'A URL real do link da vaga encontrada' },
                requisitos: { type: Type.ARRAY, items: { type: Type.STRING } },
                compatibilidade: { type: Type.INTEGER },
                explicacao: { type: Type.STRING }
              }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('real-job-search-v1', data, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error searching jobs:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to search jobs' });
      }
    }
  }
}
