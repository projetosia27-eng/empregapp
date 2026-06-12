import express from 'express';
import { UserController } from '../src/server/modules/user/user.controller';
import { ResumeReaderController } from '../src/server/modules/resume-reader/resume-reader.controller';
import { ResumeGeneratorController } from '../src/server/modules/resume-generator/resume-generator.controller';
import { JobSearchController } from '../src/server/modules/job-search/job-search.controller';
import { JobMatcherController } from '../src/server/modules/job-matcher/job-matcher.controller';
import { CourseRecommendationController } from '../src/server/modules/course-recommendation/course-recommendation.controller';
import { InterviewSimulatorController } from '../src/server/modules/interview-simulator/interview-simulator.controller';

const app = express();
app.use(express.json({ limit: '20mb' }));

// Configura cabeçalhos de CORS e preflight OPTIONS para compatibilidade com qualquer cliente
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Middleware crucial para corrigir caminhos reescritos pela plataforma Vercel.
// Restaura o path original de headers como x-matched-path para garantir que o Express coincida com a rota correta.
app.use((req, res, next) => {
  const matchedPath = req.headers['x-matched-path'];
  const originalUrl = req.headers['x-original-url'];
  
  if (typeof matchedPath === 'string' && matchedPath.startsWith('/api')) {
    req.url = matchedPath;
  } else if (typeof originalUrl === 'string' && originalUrl.startsWith('/api')) {
    req.url = originalUrl;
  }
  next();
});

// Registrar rotas de API do backend (Módulos 1 a 7)
app.post('/api/register', UserController.registerUser);
app.post('/api/parse-resume', ResumeReaderController.parseResume);
app.post('/api/generate-resume', ResumeGeneratorController.generateResumeContent);
app.post('/api/generate-resume-pdf', ResumeGeneratorController.downloadPdf);
app.post('/api/linkedin-optimize', ResumeGeneratorController.optimizeLinkedIn);
app.post('/api/search-jobs', JobSearchController.searchJobs);
app.post('/api/analyze-profile', JobMatcherController.analyzeProfile);
app.post('/api/recommend-courses', CourseRecommendationController.recommendCourses);
app.post('/api/interview-prep', InterviewSimulatorController.interviewPrep);
app.post('/api/interview-feedback', InterviewSimulatorController.interviewFeedback);

// Rota de ping para monitoramento de saúde do backend
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tratamento de rotas inexistentes
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada no backend: ${req.url}` });
});

// Tratamento centralizado de erros para logs robustos no Vercel
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Vercel API Error]', err);
  res.status(500).json({ error: 'Erro interno no backend do Vercel.' });
});

export default app;
