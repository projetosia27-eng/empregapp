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
// No Vercel, o 'x-original-url' contém a rota real requisitada (ex: "/api/parse-resume").
// Já o 'x-matched-path' contém o arquivo físico do servidor que interceptou (ex: "/api/index.ts" ou "/api/index").
// Se reescrevermos para 'x-matched-path', o roteamento do Express quebra, redirecionando tudo para 404.
app.use((req, res, next) => {
  const originalUrl = req.headers['x-original-url'] || req.headers['x-vercel-original-url'];
  console.log(`[Vercel Route Debug] ${req.method} ${req.url} | x-original-url: ${originalUrl} | x-matched-path: ${req.headers['x-matched-path']}`);

  if (typeof originalUrl === 'string' && originalUrl.startsWith('/api')) {
    req.url = originalUrl;
  }
  next();
});

// Registrar rotas de API do backend via Router para compatibilidade total no Vercel (tanto com prefixo /api quanto sem)
const apiRouter = express.Router();

apiRouter.post('/register', UserController.registerUser);
apiRouter.post('/parse-resume', ResumeReaderController.parseResume);
apiRouter.post('/generate-resume', ResumeGeneratorController.generateResumeContent);
apiRouter.post('/generate-resume-pdf', ResumeGeneratorController.downloadPdf);
apiRouter.post('/linkedin-optimize', ResumeGeneratorController.optimizeLinkedIn);
apiRouter.post('/search-jobs', JobSearchController.searchJobs);
apiRouter.post('/analyze-profile', JobMatcherController.analyzeProfile);
apiRouter.post('/recommend-courses', CourseRecommendationController.recommendCourses);
apiRouter.post('/interview-prep', InterviewSimulatorController.interviewPrep);
apiRouter.post('/interview-feedback', InterviewSimulatorController.interviewFeedback);

// Rota de ping para monitoramento de saúde do backend
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', apiRouter);
app.use('/', apiRouter);

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
