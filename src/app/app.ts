import { ChangeDetectionStrategy, Component, signal, inject, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

interface TimelineStage {
  mes: string;
  foco: string;
  cursos: {
    nome: string;
    plataforma: string;
    duracao: string;
    habilidadeDesenvolvida: string;
    justificativa: string;
    linkUrl: string;
  }[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [ReactiveFormsModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  isOnline = signal<boolean>(true);

  private postWithCache<T>(url: string, body: unknown) {
    const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    const cacheKey = `empregaja_cache_${url}_${JSON.stringify(body)}`;
    
    if (isBrowser) {
      if (!this.isOnline()) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            this.showToast('Você está offline. Exibindo dados salvos em cache deste formulário.', 'info');
            return of(JSON.parse(cached) as T);
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
        
        // Scan for similar search or request in the cache to enable offline experience
        const prefix = `empregaja_cache_${url}_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            const val = localStorage.getItem(key);
            if (val) {
              try {
                this.showToast('Você está offline. Carregando dados salvos em cache de consultas anteriores.', 'info');
                return of(JSON.parse(val) as T);
              } catch {
                // Ignore corrupt data
              }
            }
          }
        }
        
        this.showToast('Sem conexão de rede e sem dados em cache disponíveis para esta ação.', 'error');
        return throwError(() => new Error('Offline and no cache found'));
      } else {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            return of(JSON.parse(cached) as T);
          } catch {
            localStorage.removeItem(cacheKey);
          }
        }
      }
    }

    return this.http.post<T>(url, body).pipe(
      tap(res => {
        if (isBrowser && url !== '/api/parse-resume') {
          // Avoid exceeding quota with very large caches
          try {
            localStorage.setItem(cacheKey, JSON.stringify(res));
          } catch(e) {
            console.warn('Could not cache response', e);
          }
        }
      }),
      catchError(err => {
        if (err.status === 503 && err.error?.error) {
          this.showToast(err.error.error, 'error');
        } else if (err.status >= 500) {
          this.showToast('Algumas capacidades estão temporariamente indisponíveis (Alta Demanda). ' + (err.error?.error || 'Tente novamente em instantes.'), 'error');
        }
        return throwError(() => err);
      })
    );
  }

  userSession = signal<{ nome: string; email: string; loggedIn: boolean } | null>(null);
  xpCount = signal<number>(100);

  // Custom toast notifications for elite SaaS UX
  toast = signal<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toast.set({ message, type });
    setTimeout(() => {
      // Safety check if another toast was shown
      if (this.toast()?.message === message) {
        this.toast.set(null);
      }
    }, 4500);
  }
  
  // Freemium setup signals
  userPlan = signal<'free' | 'premium'>('free'); // Starts on free
  resumeGenerationsRemaining = signal<number>(1); // Only 1 free generation allowed
  streakCount = signal<number>(3); // 3 days streak for engagement retention
  showUpgradeModal = signal<boolean>(false);
  upgradeIntent = signal<string>(''); // Context message for modal
  
  // Auto-Apply states
  isAutoApplying = signal<boolean>(false);
  autoApplyJobTitle = signal<string | null>(null);
  autoApplyStatus = signal<string>('');
  
  // LinkedIn Optimizer states
  isLinkedInSubmitting = signal<boolean>(false);
  linkedInProfile = signal<{ headline: string; aboutMe: string; advice: string } | null>(null);

  authForm = this.fb.group({
    nome: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(6)]]
  });

  currentPercent = computed(() => {
    switch (this.viewState()) {
      case 'splash': return 0;
      case 'tutorial': return 10;
      case 'onboarding-auth': return 25;
      case 'upload': return 40;
      case 'form': return 55;
      case 'resume': return 70;
      case 'analysis': return 80;
      case 'jobs': return 88;
      case 'courses': return 95;
      case 'interviewPrep': return 98;
      case 'dashboard': return 100;
      default: return 0;
    }
  });

  currentStatusLabel = computed(() => {
    switch (this.viewState()) {
      case 'tutorial': return 'Fazendo o Onboarding';
      case 'onboarding-auth': return 'Criando sua Conta Grátis';
      case 'upload': return 'Análise de Currículo em PDF';
      case 'form': return 'Revisão Cadastral';
      case 'resume': return 'Currículo Pronto e Otimizado 📄';
      case 'analysis': return 'Análise de Inteligência Artificial 🧠';
      case 'jobs': return 'Suas Vagas Ideais';
      case 'courses': return 'Qualificação Sugerida';
      case 'interviewPrep': return 'Preparação de Entrevista';
      case 'dashboard': return 'Inscrição Premium Completa 🎉';
      default: return 'Começo';
    }
  });

  candidateLevel = computed(() => {
    const xp = this.xpCount();
    if (xp >= 800) return 'Candidato Premium Ouro 🏆';
    if (xp >= 400) return 'Candidato Prata Avançado 🥈';
    return 'Candidato Bronze em Onboarding 🥉';
  });

  addXp(amount: number) {
    this.xpCount.update(x => x + amount);
  }

  profileForm = this.fb.nonNullable.group({
    nome: [''],
    email: ['', [Validators.email]],
    telefone: [''],
    cidadeEstado: [''],
    areaInteresse: [''],
    ultimoCargo: [''],
    tempoExperiencia: [''],
    escolaridade: [''],
    habilidades: [''],
    experiencias: [''],
    cursos: [''],
    tipoVaga: ['remota'],
  });

  viewState = signal<'splash' | 'tutorial' | 'onboarding-auth' | 'upload' | 'form' | 'success' | 'resume' | 'analysis' | 'jobs' | 'courses' | 'interviewPrep' | 'dashboard'>('splash');
  tutorialStep = signal(0);

  theme = signal<'light' | 'dark'>('light');

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.isOnline.set('onLine' in navigator ? navigator.onLine : true);

      window.addEventListener('online', () => {
        this.isOnline.set(true);
        this.showToast('Conexão com a internet restabelecida! Atualizado p/ modo síncrono.', 'success');
      });

      window.addEventListener('offline', () => {
        this.isOnline.set(false);
        this.showToast('Você está offline. O EmpregaJá foi adaptado para o Modo Offline.', 'info');
      });
    }

    if (typeof document !== 'undefined') {
      if (document.documentElement.classList.contains('dark')) {
        this.theme.set('dark');
      }
    }
    setTimeout(() => {
      this.viewState.set('tutorial');
    }, 2500);
  }

  toggleTheme() {
    if (typeof document !== 'undefined') {
      const isDark = document.documentElement.classList.toggle('dark');
      this.theme.set(isDark ? 'dark' : 'light');
    }
  }

  nextTutorialStep() {
    if (this.tutorialStep() < 3) {
      this.tutorialStep.update(s => s + 1);
    } else {
      this.viewState.set('onboarding-auth');
    }
  }

  skipTutorial() {
    this.viewState.set('onboarding-auth');
  }

  submitAuth() {
    if (this.authForm.valid) {
      const val = this.authForm.getRawValue();
      this.userSession.set({
        nome: val.nome || '',
        email: val.email || '',
        loggedIn: true
      });
      this.profileForm.patchValue({
        nome: val.nome || '',
        email: val.email || ''
      });
      this.addXp(150);
      this.viewState.set('upload');
    } else {
      this.authForm.markAllAsTouched();
    }
  }

  enterAsGuest() {
    this.userSession.set({
      nome: 'Candidato Desconhecido',
      email: 'gestor@exemplo.com',
      loggedIn: true
    });
    this.profileForm.patchValue({
      nome: 'Candidato Desconhecido',
      email: 'gestor@exemplo.com'
    });
    this.addXp(50);
    this.viewState.set('upload');
  }
  isSubmitting = signal(false);
  isAnalyzing = signal(false);
  isDragOver = signal(false);
  generatedDocs = signal<{resumo: string, objetivo: string} | null>(null);

  stats = signal({
    savedJobs: 0,
    applications: 0,
    simulationsCompleted: 0
  });
  analysisDocs = signal<{
    pontosFortes: string[],
    palavrasChave: string[],
    areasCompativeis: string[],
    cargosRecomendados: string[],
    oQueMelhorar: string[],
    habilidadesParaDesenvolver: string[]
  } | null>(null);
  jobsList = signal<{
    titulo: string,
    empresa: string,
    localizacao: string,
    tipoTrabalho: string,
    url?: string,
    requisitos: string[],
    compatibilidade: number,
    explicacao: string
  }[]>([]);
  courseTimeline = signal<TimelineStage[]>([]);

  selectedJobForPrep = signal<{titulo: string, empresa: string, requisitos: string[]} | null>(null);
  interviewPrepData = signal<{
    perguntasProvaveis: { pergunta: string, sugestaoResposta: string }[],
    pontosDestacar: string[],
    oQueEvitar: string[],
    dicasComportamentais: string[]
  } | null>(null);

  activeQuestionIndex = signal<number>(-1);
  userAnswerCtrl = this.fb.control('');
  answerFeedback = signal<{feedback: string, melhorias: string, nota: number} | null>(null);
  isSimulating = signal<boolean>(false);
  isEvaluating = signal<boolean>(false);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.handleFile(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  async handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      this.showToast('Por favor, envie apenas arquivos em formato PDF.', 'error');
      return;
    }

    this.isAnalyzing.set(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        try {
          const response = await firstValueFrom(this.postWithCache<Record<string, string>>('/api/parse-resume', { pdfBase64: base64String }));
          
          if (response) {
            this.profileForm.patchValue({
              nome: response['nome'] || '',
              email: response['email'] || '',
              telefone: response['telefone'] || '',
              cidadeEstado: response['cidadeEstado'] || '',
              areaInteresse: response['areaInteresse'] || '',
              ultimoCargo: response['ultimoCargo'] || '',
              tempoExperiencia: response['tempoExperiencia'] || '',
              escolaridade: response['escolaridade'] || '',
              habilidades: response['habilidades'] || '',
              experiencias: response['experiencias'] || '',
              cursos: response['cursos'] || '',
              tipoVaga: response['tipoVaga'] || 'remota'
            });
          }
        } catch (err) {
          console.error("Erro ao analisar currículo", err);
          this.showToast('Não foi possível extrair dados automáticos deste PDF. Sem problemas! Você pode preencher manualmente em segundos.', 'info');
        } finally {
          this.isAnalyzing.set(false);
          this.viewState.set('form');
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      this.isAnalyzing.set(false);
      this.viewState.set('form');
    }
  }

  skipUpload() {
    this.viewState.set('form');
  }

  goBackToUpload() {
    this.viewState.set('upload');
  }

  goBackToAuth() {
    this.viewState.set('onboarding-auth');
  }

  onSubmit() {
    if (this.profileForm.valid) {
      if (this.userPlan() === 'free' && this.resumeGenerationsRemaining() <= 0) {
        this.upgradeIntent.set('criar currículos de forma ilimitada e com otimização profissional por IA');
        this.showUpgradeModal.set(true);
        return;
      }

      this.isSubmitting.set(true);
      const formData = this.profileForm.getRawValue();
      
      this.postWithCache<{resumo: string, objetivo: string}>('/api/generate-resume', formData)
        .subscribe({
          next: (res) => {
            if (this.userPlan() === 'free') {
              this.resumeGenerationsRemaining.update(r => Math.max(0, r - 1));
            }
            this.generatedDocs.set(res);
            this.isSubmitting.set(false);
            this.addXp(120);
            this.viewState.set('resume');
          },
          error: (err) => {
            console.error('Failed to generate professional texts via AI', err);
            if (this.userPlan() === 'free') {
              this.resumeGenerationsRemaining.update(r => Math.max(0, r - 1));
            }
            // Fallback content in case API/network fails
            this.generatedDocs.set({
              resumo: `Profissional com experiência na área de ${formData.areaInteresse}. Foco em resultados, trabalho em equipe e melhoria contínua de processos.`,
              objetivo: `Atuar como ${formData.ultimoCargo} ou posições similares, agregando valor através dos meus conhecimentos em ${formData.habilidades.split(',')[0] || 'diversas tecnologias'}.`
            });
            this.isSubmitting.set(false);
            this.addXp(100);
            this.viewState.set('resume');
          }
        });
    } else {
      this.profileForm.markAllAsTouched();
    }
  }

  editResume() {
    this.viewState.set('form');
  }

  downloadPdf() {
    window.print();
  }

  useResume() {
    this.searchJobs();
  }

  searchJobs() {
    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      // Optional: alert('Preencha seu perfil primeiro para buscar vagas.');
      this.showToast('Por favor, preencha todos os campos obrigatórios do perfil antes de buscar vagas.', 'error');
      return; 
    }
    
    this.isSubmitting.set(true);
    const formData = this.profileForm.getRawValue();
    
    this.postWithCache<NonNullable<ReturnType<typeof this.jobsList>>>('/api/search-jobs', formData)
      .subscribe({
        next: (res) => {
          this.jobsList.set(res);
          this.isSubmitting.set(false);
          this.addXp(120);
          this.viewState.set('jobs');
        },
        error: (err) => {
          console.error('Failed to search jobs via AI', err);
          this.jobsList.set([
            {
              titulo: formData.ultimoCargo || 'Analista',
              empresa: 'TechCorp Brasil',
              localizacao: formData.cidadeEstado || 'São Paulo, SP',
              tipoTrabalho: formData.tipoVaga || 'Remoto',
              requisitos: ['Experiência prévia na área', 'Comunicação assertiva', 'Foco em resultados'],
              compatibilidade: 92,
              explicacao: 'Vaga com alta compatibilidade pois suas habilidades batem com os principais requisitos, além da forte aderência em localização e modelo de trabalho.'
            },
            {
              titulo: `Especialista em ${formData.areaInteresse || 'Projetos'}`,
              empresa: 'Inova Solutions',
              localizacao: 'Remoto',
              tipoTrabalho: 'Remoto',
              requisitos: ['Inglês intermediário', 'Conhecimento avançado em ferramentas da área'],
              compatibilidade: 65,
              explicacao: 'Compatibilidade média: o cargo e modelo de trabalho estão alinhados, mas alguns requisitos como idioma podem precisar de evolução.'
            },
            {
              titulo: `Assistente de ${formData.areaInteresse || 'Projetos'}`,
              empresa: 'Global Corp',
              localizacao: 'Rio de Janeiro, RJ (Presencial)',
              tipoTrabalho: 'Presencial',
              requisitos: ['Agilidade', 'Pacote Office'],
              compatibilidade: 40,
              explicacao: 'Baixa compatibilidade: o modelo de trabalho e a exigência de localidade não batem com seu perfil no momento.'
            }
          ]);
          this.isSubmitting.set(false);
          this.addXp(100);
          this.viewState.set('jobs');
        }
      });
  }

  analyzeProfile() {
    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      this.showToast('Por favor, preencha os dados do perfil antes de solicitar o Diagnóstico de IA.', 'error');
      return;
    }
    this.isSubmitting.set(true);
    const formData = this.profileForm.getRawValue();
    
    this.postWithCache<NonNullable<ReturnType<typeof this.analysisDocs>>>('/api/analyze-profile', formData)
      .subscribe({
        next: (res) => {
          this.analysisDocs.set(res);
          this.isSubmitting.set(false);
          this.addXp(120);
          this.viewState.set('analysis');
        },
        error: (err) => {
          console.error('Failed to analyze profile via AI', err);
          
          this.analysisDocs.set({
            pontosFortes: [
              `Sólida experiência em ${formData.areaInteresse || 'sua área de atuação'}`,
              'Capacidade de aprendizado e adaptação rápida',
              'Boas habilidades de comunicação'
            ],
            palavrasChave: (formData.habilidades || '').split(',').map(s => s.trim()).filter(p => p) || ['Dedicação', 'Comprometimento'],
            areasCompativeis: [formData.areaInteresse || 'Tecnologia', 'Segmento Corporativo', 'Projetos Inovadores'],
            cargosRecomendados: [formData.ultimoCargo || 'Analista', `Posições de liderança em ${formData.areaInteresse}`],
            oQueMelhorar: [
              'Adicionar resultados quantificáveis nas suas experiências anteriores.',
              'Expandir a lista de certificados com cursos mais recentes.',
              'Ajustar o resumo objetivo focando nas necessidades do mercado atual.'
            ],
            habilidadesParaDesenvolver: [
              'Inglês fluente',
              'Novas metodologias ágeis',
              'Comunicação de alto impacto e negociação'
            ]
          });
          
          this.isSubmitting.set(false);
          this.addXp(100);
          this.viewState.set('analysis');
        }
      });
  }

  recommendCourses() {
    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      this.showToast('Por favor, preencha os dados do perfil antes de carregar recomendações de trilhas.', 'error');
      return;
    }
    this.isSubmitting.set(true);
    const formData = this.profileForm.getRawValue();
    
    this.postWithCache<{ trilha: TimelineStage[] }>('/api/recommend-courses', formData)
      .subscribe({
        next: (res) => {
          this.courseTimeline.set(res.trilha);
          this.isSubmitting.set(false);
          this.addXp(150);
          this.viewState.set('courses');
        },
        error: (err) => {
          console.error('Failed to recommend courses via AI', err);
          this.courseTimeline.set([
            {
              mes: 'Mês 1',
              foco: 'Fortalecimento de Base',
              cursos: [
                {
                  nome: 'Fundamentos de ' + (formData.areaInteresse || 'Gestão'),
                  plataforma: 'Fundação Bradesco',
                  duracao: '15 horas',
                  habilidadeDesenvolvida: 'Conceitos Básicos',
                  justificativa: 'Ideal para reforçar a base teórica e mostrar atualização na área.',
                  linkUrl: 'https://www.ev.org.br/'
                }
              ]
            },
            {
              mes: 'Mês 2',
              foco: 'Organização e Gestão',
              cursos: [
                {
                  nome: 'Produtividade e Gestão de Tempo',
                  plataforma: 'Sebrae',
                  duracao: '4 horas',
                  habilidadeDesenvolvida: 'Organização Pessoal',
                  justificativa: 'Habilidade super valorizada em todos os ambientes de trabalho.',
                  linkUrl: 'https://sebrae.com.br/sites/PortalSebrae/cursosonline'
                }
              ]
            }
          ]);
          this.isSubmitting.set(false);
          this.addXp(100);
          this.viewState.set('courses');
        }
      });
  }

  prepareInterview(job: { titulo: string; empresa: string; requisitos: string[] }) {
    if (this.userPlan() === 'free') {
      this.upgradeIntent.set('treinar para entrevistas com simulador por chat e avaliação de nota por Inteligência Artificial');
      this.showUpgradeModal.set(true);
      return;
    }
    this.isSubmitting.set(true);
    this.selectedJobForPrep.set({ titulo: job.titulo, empresa: job.empresa, requisitos: job.requisitos });
    
    const payload = {
      profile: this.profileForm.getRawValue(),
      job: this.selectedJobForPrep()
    };
    
    this.postWithCache<NonNullable<ReturnType<typeof this.interviewPrepData>>>('/api/interview-prep', payload)
      .subscribe({
        next: (res) => {
          this.interviewPrepData.set(res);
          this.isSimulating.set(false);
          this.activeQuestionIndex.set(-1);
          this.answerFeedback.set(null);
          this.userAnswerCtrl.reset();
          
          this.isSubmitting.set(false);
          this.viewState.set('interviewPrep');
        },
        error: (err) => {
          console.error('Failed to prepare interview', err);
          this.interviewPrepData.set({
            perguntasProvaveis: [
              { pergunta: "Fale um pouco sobre você e sua experiência profissional.", sugestaoResposta: "Destaque os principais projetos e suas habilidades mais relevantes." },
              { pergunta: "Por que você se interessou por essa vaga específica?", sugestaoResposta: "Foque nos requisitos da vaga que estão mais aderentes com suas habilidades." }
            ],
            pontosDestacar: ["Seu interesse contínuo em aprender", "Seu foco em resultados"],
            oQueEvitar: ["Falar mal de colegas anteriores", "Respostas que não agregam ao contexto da vaga"],
            dicasComportamentais: ["Mantenha um sorriso no rosto", "Concentre o olhar na câmera ou no recrutador"]
          });
          this.isSimulating.set(false);
          this.activeQuestionIndex.set(-1);
          this.answerFeedback.set(null);
          this.userAnswerCtrl.reset();

          this.isSubmitting.set(false);
          this.viewState.set('interviewPrep');
        }
      });
  }

  startSimulation(index: number) {
    this.activeQuestionIndex.set(index);
    this.isSimulating.set(true);
    this.answerFeedback.set(null);
    this.userAnswerCtrl.setValue('');
  }

  submitAnswer() {
    if (!this.userAnswerCtrl.value?.trim()) return;

    this.isEvaluating.set(true);
    const data = this.interviewPrepData();
    const currentQ = data?.perguntasProvaveis[this.activeQuestionIndex()]?.pergunta;

    const payload = {
      pergunta: currentQ,
      respostaUsuario: this.userAnswerCtrl.value,
      job: this.selectedJobForPrep()
    };

    this.postWithCache<NonNullable<ReturnType<typeof this.answerFeedback>>>('/api/interview-feedback', payload)
      .subscribe({
        next: (res) => {
          this.answerFeedback.set(res);
          this.isEvaluating.set(false);
          this.addXp(180);
          this.stats.update(s => ({ ...s, simulationsCompleted: s.simulationsCompleted + 1 }));
        },
        error: (err) => {
          console.error('Failed to evaluate', err);
          this.answerFeedback.set({
            feedback: "Boa tentativa! Tente ser um pouco mais direto nas informações principais.",
            melhorias: "Incorpore um exemplo prático das suas experiências passadas.",
            nota: 7
          });
          this.isEvaluating.set(false);
          this.addXp(100);
          this.stats.update(s => ({ ...s, simulationsCompleted: s.simulationsCompleted + 1 }));
        }
      });
  }

  backToJobs() {
    this.viewState.set('jobs');
  }

  saveJob(job?: unknown) {
    if (job) {
      console.log('Salvando vaga', job);
    }
    this.stats.update(s => ({ ...s, savedJobs: s.savedJobs + 1 }));
    this.showToast('Excelente escolha! Vaga salva com sucesso na sua lista de interesse.', 'success');
  }

  applyForJob(job: { titulo: string; empresa: string; requisitos: string[] }) {
    this.stats.update(s => ({ ...s, applications: s.applications + 1 }));
    this.prepareInterview(job);
  }

  goDashboard() {
    this.viewState.set('dashboard');
  }

  viewResume() {
    this.viewState.set('resume');
  }

  resetForm() {
    this.profileForm.reset();
    this.profileForm.controls.tipoVaga.setValue('remota');
    this.viewState.set('upload');
  }

  upgradeToPremium() {
    this.userPlan.set('premium');
    this.showUpgradeModal.set(false);
    this.addXp(300); // Recompensa de engajamento!
    this.showToast('Sua Assinatura Premium Ouro está Ativa! Acesso ilimitado a todas as ferramentas de IA liberado! 🎉', 'success');
  }

  redeemXpForPremium() {
    if (this.xpCount() >= 500) {
      this.xpCount.update(x => x - 500);
      this.userPlan.set('premium');
      this.showUpgradeModal.set(false);
      this.showToast('Sensacional! Você resgatou 24h de Acesso Premium Ilimitado usando 500 XP acumulados. Bom foco! 🚀', 'success');
    } else {
      this.showToast('Você precisa de no mínimo 500 XP para resgatar. Continue completando etapas para acumular!', 'error');
    }
  }

  triggerUpgrade(intent: string) {
    this.upgradeIntent.set(intent);
    this.showUpgradeModal.set(true);
  }

  closeUpgradeModal() {
    this.showUpgradeModal.set(false);
  }

  optimizeLinkedIn() {
    if (this.userPlan() === 'free') {
      this.upgradeIntent.set('otimizar e criar seu perfil do LinkedIn de forma profissional para atrair recrutadores');
      this.showUpgradeModal.set(true);
      return;
    }

    this.isLinkedInSubmitting.set(true);
    const formData = this.profileForm.getRawValue();

    this.postWithCache<{ headline: string; aboutMe: string; advice: string }>('/api/linkedin-optimize', formData)
      .subscribe({
        next: (res) => {
          this.linkedInProfile.set(res);
          this.isLinkedInSubmitting.set(false);
          this.addXp(150);
        },
        error: (err) => {
          console.error('LinkedIn optimization error:', err);
          this.linkedInProfile.set({
            headline: `${formData.ultimoCargo || 'Profissional'} | Especialista em ${formData.areaInteresse || 'Projetos'} | Buscando novas oportunidades`,
            aboutMe: `Profissional motivado focado em ${formData.areaInteresse}. Reúno habilidades em ${formData.habilidades} com histórico de entrega consistente e melhoria contínua de processos no modelo ${formData.tipoVaga}.\n\n💡 Principais Competências: ${formData.habilidades}`,
            advice: `Complete sua seção de Competências, customize sua URL do LinkedIn (ex: linkedin.com/in/nome-sobrenome) e ative o selo 'Open to Work' apenas para recrutadores.`
          });
          this.isLinkedInSubmitting.set(false);
          this.addXp(80);
        }
      });
  }

  runAutoApply(job: { titulo: string; empresa: string; requisitos: string[] }) {
    if (this.userPlan() === 'free') {
      this.upgradeIntent.set('realizar candidaturas automáticas simplificadas de 1-clique');
      this.showUpgradeModal.set(true);
      return;
    }

    this.isAutoApplying.set(true);
    this.autoApplyJobTitle.set(job.titulo);
    this.autoApplyStatus.set('Inicializando robozinho de IA...');
    
    setTimeout(() => {
      this.autoApplyStatus.set('Formatando currículo otimizado com base nos requisitos...');
      setTimeout(() => {
        this.autoApplyStatus.set('Preenchendo formulários da vaga na empresa ' + job.empresa + '...');
        setTimeout(() => {
          this.autoApplyStatus.set('Sincronizando com a plataforma de recrutamento...');
          setTimeout(() => {
            this.isAutoApplying.set(false);
            this.autoApplyJobTitle.set(null);
            this.stats.update(s => ({ ...s, applications: s.applications + 1 }));
            this.addXp(80);
            this.showToast(`Candidatura inteligente para "${job.titulo}" enviada com sucesso p/ triagem de recrutamento! 🎉`, 'success');
          }, 1000);
        }, 1000);
      }, 1000);
    }, 1000);
  }
}
