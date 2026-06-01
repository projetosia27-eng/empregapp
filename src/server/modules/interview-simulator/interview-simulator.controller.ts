/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, Type } from '@google/genai';
import { CacheIntegration } from '../../integrations/cache.integration';
import { generateContentWithRetry } from '../../utils/ai-retry';

/**
 * Módulo 7: Simulador de entrevista com Caching, Validação Inteligente e Otimização
 */
export class InterviewSimulatorController {
  
  static async interviewPrep(req: any, res: any) {
    try {
      const { profile, job } = req.body;

      // 1. Verificar cache da preparação da entrevista para economizar tokens
      const cached = CacheIntegration.get<any>('interview-prep', { profile, job });
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
              { text: `Gere um guia de preparação para entrevista baseado no currículo e na vaga.
Candidato: ${JSON.stringify(profile)}
Vaga: ${JSON.stringify(job)}
Forneça:
1. 3 perguntas prováveis de entrevista e sugestão de resposta para cada.
2. 3 pontos fortes do candidato que devem ser destacados na entrevista.
3. 3 assuntos rápidos a evitar.
4. 3 sugestões de postura e comportamento.` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              perguntasProvaveis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { pergunta: { type: Type.STRING }, sugestaoResposta: { type: Type.STRING } } } },
              pontosDestacar: { type: Type.ARRAY, items: { type: Type.STRING } },
              oQueEvitar: { type: Type.ARRAY, items: { type: Type.STRING } },
              dicasComportamentais: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('interview-prep', { profile, job }, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error in interview-prep:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to generate interview prep' });
      }
    }
  }

  static async interviewFeedback(req: any, res: any) {
    try {
      const { pergunta, respostaUsuario, job } = req.body;

      const trimmedAns = (respostaUsuario || '').trim();

      // REGRA: Lógica simples antes de IA
      // Se a resposta for vazia, muito curta ou meramente de recusa (ex: "não sei"), responder localmente sem acionar API
      if (!trimmedAns || trimmedAns.length < 5 || ['não sei', 'nao sei', 'sei la', 'sei lá', 'n sei', 'nada'].includes(trimmedAns.toLowerCase())) {
        console.log('[InterviewSimulator] Interceptado: resposta trivial. Retornando feedback local (Economia de 100% de IA!)');
        res.json({
          feedback: "A sua resposta parece curta ou vaga demais para uma simulação real de entrevista. Lembre-se que recrutadores procuram exemplos práticos da sua trajetória profissional.",
          melhorias: "Escreva uma resposta detalhando uma situação em que você usou suas habilidades para resolver um problema. Use o método STAR (Situação, Tarefa, Ação, Resultado) para estruturar sua fala.",
          nota: 3
        });
        return;
      }

      // 2. Verificar cache para respostas idênticas
      const cached = CacheIntegration.get<any>('interview-feedback', { pergunta, respostaUsuario, job });
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
              { text: `Avalie a resposta do candidato para uma entrevista de emprego de forma encorajadora e construtiva.
Vaga: ${JSON.stringify(job)}
Pergunta feita: "${pergunta}"
Resposta do candidato: "${respostaUsuario}"
Dê um feedback acolhedor, sugira melhorias pontuais na resposta e atribua uma nota de 0 a 10.` }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              feedback: { type: Type.STRING },
              melhorias: { type: Type.STRING },
              nota: { type: Type.INTEGER }
            }
          }
        }
      });

      const result = response.text;
      if (result) {
        const parsed = JSON.parse(result);
        
        // Guardar no cache local
        CacheIntegration.set('interview-feedback', { pergunta, respostaUsuario, job }, parsed);
        
        res.json(parsed);
      } else {
        res.status(500).json({ error: 'No output from model' });
      }
    } catch (error: any) {
      console.error('Error in interview-feedback:', error);
      if (error?.status === 503 || error?.status === 'UNAVAILABLE') {
        res.status(503).json({ error: 'Os servidores de IA estão com alta demanda. Por favor, tente novamente em alguns instantes.' });
      } else {
        res.status(500).json({ error: 'Failed to generate feedback' });
      }
    }
  }
}
