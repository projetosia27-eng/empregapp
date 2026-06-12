/* eslint-disable @typescript-eslint/no-explicit-any */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Integração de Caching Inteligente do Servidor
 * Evita chamadas duplicadas à API do Gemini e minimiza custos de processamento.
 */
export class CacheIntegration {
  private static cacheMap = new Map<string, any>();
  private static getCachePath(): string | null {
    // No Vercel e ambientes serverless, o sistema de arquivos é virtual ou de leitura apenas.
    // Evitamos totalmente E/S de arquivos para evitar exceções de permissão ou lentidão.
    if (process.env['VERCEL'] || process.env['NOW_REGION']) {
      return null;
    }
    try {
      if (fs.existsSync('/tmp')) {
        return path.join('/tmp', 'ai_cache_store.json');
      }
    } catch {
      // Silencioso fallback
    }
    return path.join(process.cwd(), 'ai_cache_store.json');
  }

  private static cacheFilePath = CacheIntegration.getCachePath();

  static {
    this.loadCacheFromFile();
  }

  private static loadCacheFromFile() {
    try {
      if (this.cacheFilePath && fs.existsSync(this.cacheFilePath)) {
        const fileContent = fs.readFileSync(this.cacheFilePath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        for (const [key, val] of Object.entries(parsed)) {
          this.cacheMap.set(key, val);
        }
        console.log(`[CacheIntegration] ${this.cacheMap.size} itens carregados do cache local persistente.`);
      }
    } catch (e) {
      console.error('[CacheIntegration] Falha ao carregar cache do arquivo:', e);
    }
  }

  private static saveCacheToFile() {
    try {
      if (!this.cacheFilePath) {
        return; // Rodando no Vercel/Serverless, manter apenas na RAM
      }
      const obj: Record<string, any> = {};
      for (const [key, val] of this.cacheMap.entries()) {
        obj[key] = val;
      }
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.error('[CacheIntegration] Falha ao persistir cache local:', e);
    }
  }

  static generateHash(payload: any): string {
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHash('md5').update(serialized).digest('hex');
  }

  static get<T>(namespace: string, keyPayload: any): T | null {
    const hash = this.generateHash(keyPayload);
    const compoundKey = `${namespace}:${hash}`;
    const result = this.cacheMap.get(compoundKey);
    if (result) {
      console.log(`[CacheIntegration] Cache HIT em [${namespace}] -> Hash: ${hash}`);
      return result as T;
    }
    return null;
  }

  static set(namespace: string, keyPayload: any, value: any): void {
    const hash = this.generateHash(keyPayload);
    const compoundKey = `${namespace}:${hash}`;
    this.cacheMap.set(compoundKey, value);
    console.log(`[CacheIntegration] Gravando Cache em [${namespace}] -> Hash: ${hash}`);
    this.saveCacheToFile();
  }
}
