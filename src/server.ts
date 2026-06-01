import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

// Importando os Controladores dos Módulos
import { UserController } from './server/modules/user/user.controller';
import { ResumeReaderController } from './server/modules/resume-reader/resume-reader.controller';
import { ResumeGeneratorController } from './server/modules/resume-generator/resume-generator.controller';
import { JobSearchController } from './server/modules/job-search/job-search.controller';
import { JobMatcherController } from './server/modules/job-matcher/job-matcher.controller';
import { CourseRecommendationController } from './server/modules/course-recommendation/course-recommendation.controller';
import { InterviewSimulatorController } from './server/modules/interview-simulator/interview-simulator.controller';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json({ limit: '20mb' }));

// Módulo 1: Cadastro do Usuário
app.post('/api/register', UserController.registerUser);

// Módulo 2: Leitura de Currículo
app.post('/api/parse-resume', ResumeReaderController.parseResume);

// Módulo 3: Geração de Currículo e Exportação para PDF
app.post('/api/generate-resume', ResumeGeneratorController.generateResumeContent);
app.post('/api/generate-resume-pdf', ResumeGeneratorController.downloadPdf);
app.post('/api/linkedin-optimize', ResumeGeneratorController.optimizeLinkedIn);

// Módulo 4: Motor de busca de vagas
app.post('/api/search-jobs', JobSearchController.searchJobs);

// Módulo 5: Match entre perfil e vaga
app.post('/api/analyze-profile', JobMatcherController.analyzeProfile);

// Módulo 6: Cursos recomendados
app.post('/api/recommend-courses', CourseRecommendationController.recommendCourses);

// Módulo 7: Simulador de entrevista
app.post('/api/interview-prep', InterviewSimulatorController.interviewPrep);
app.post('/api/interview-feedback', InterviewSimulatorController.interviewFeedback);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
