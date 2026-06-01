/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseIntegration } from '../../integrations/database.integration';

/**
 * Módulo 1: Cadastro do Usuário
 */
export class UserController {
  static async registerUser(req: any, res: any) {
    const data = req.body;
    await DatabaseIntegration.saveUser(data);
    res.json({ success: true, message: 'Usuário cadastrado com sucesso.' });
  }
}
