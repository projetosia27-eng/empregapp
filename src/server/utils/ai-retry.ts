/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

export async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: GenerateContentParameters,
  maxRetries = 3
): Promise<GenerateContentResponse> {
  let initialModel: string | undefined;
  if (typeof params.model === 'string') {
    initialModel = params.model;
  }
  
  const modelsToTry = [initialModel, 'gemini-2.5-flash'].filter(Boolean) as string[];
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: any;

  for (const model of uniqueModels) {
    // If the primary model is gemini-3.5-flash and it experiences high demand/503/429,
    // we want to fall back to the ultra-stable 'gemini-2.5-flash' immediately (1 retry max)
    // to keep the app functional and fast.
    const effectiveMaxRetries = (model === 'gemini-3.5-flash' && uniqueModels.length > 1) ? 1 : maxRetries;

    for (let attempt = 1; attempt <= effectiveMaxRetries; attempt++) {
      try {
        const modelParams = { ...params, model };
        
        // Disable toolConfig (context circulation) and tools (like googleSearch) if the model is not a Gemini 3 series model
        // because gemini-2.5-flash and earlier do not support includeServerSideToolInvocations or context circulation.
        if (modelParams.config && !model.startsWith('gemini-3.')) {
          modelParams.config = { ...modelParams.config };
          if (modelParams.config.toolConfig) {
            console.log(`[AI Retry] Removing incompatible toolConfig from parameters for model ${model}`);
            delete modelParams.config.toolConfig;
          }
          if (modelParams.config.tools) {
            console.log(`[AI Retry] Removing incompatible tools from parameters for model ${model}`);
            delete modelParams.config.tools;
          }
        }

        const result = await ai.models.generateContent(modelParams);
        return result;
      } catch (error: any) {
        lastError = error;
        
        const isRateLimit = error?.status === 503 || 
                            error?.status === 'UNAVAILABLE' ||
                            error?.message?.includes('503') ||
                            error?.message?.includes('high demand') ||
                            error?.status === 429 ||
                            error?.message?.includes('429') ||
                            error?.message?.includes('quota');
                             
        if (isRateLimit) {
          if (attempt < effectiveMaxRetries) {
            console.log(`[AI Retry] Model ${model} failed with high demand/quota (attempt ${attempt}/${effectiveMaxRetries}). Retrying in ${attempt * 1500}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1500));
            continue;
          } else {
            console.log(`[AI Retry] Model ${model} failed. Falling back / moving to next model...`);
            break;
          }
        }
        
        // If it's a configuration or validation error and we have more models to try, move to next model instead of throwing immediately.
        if (uniqueModels.indexOf(model) < uniqueModels.length - 1) {
          console.warn(`[AI Retry] Model ${model} failed with error: ${error?.message || error}. Trying fallback model...`);
          break;
        }
        
        throw error;
      }
    }
  }

  throw lastError;
}
