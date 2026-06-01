import { Injectable, signal } from '@angular/core';

/**
 * Serviço responsável por gerenciar a autenticação de usuários (SaaS)
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // O ideal é carregar essa config do env, mas como já existe um firebase-applet-config.json,
  // usaríamos isso. Para simplificar, estamos estruturando.
  
  currentUser = signal<unknown>(null);
  isLoading = signal(true);

  async loginWithGoogle() {
    // Implementar lógica do provedor Google auth
  }

  async logout() {
    // Implementar logout
  }
}
