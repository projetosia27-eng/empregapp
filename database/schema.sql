-- Estrutura de Banco de Dados PostgreSQL (Otimizado para Supabase)

-- 1. Usuários (Integrado com Supabase Auth)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Currículos
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL, -- Ex: "Desenvolvedor Frontend"
  summary TEXT,
  target_role VARCHAR(150),
  pdf_storage_path TEXT, -- Caminho no Supabase Storage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Experiências Profissionais
CREATE TABLE experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  company_name VARCHAR(200) NOT NULL,
  role VARCHAR(150) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilidades
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(50) -- Ex: 'Soft Skill', 'Hard Skill'
);

-- Relacionamento N:N entre Currículos e Habilidades
CREATE TABLE resume_skills (
  resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  proficiency_level INT CHECK (proficiency_level BETWEEN 1 AND 5),
  PRIMARY KEY (resume_id, skill_id)
);

-- 5. Vagas
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  company VARCHAR(200) NOT NULL,
  location VARCHAR(150),
  description TEXT,
  requirements TEXT[],
  salary_range VARCHAR(100),
  job_type VARCHAR(50), -- Remote, Hybrid, On-site
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Candidaturas / Vagas Salvas
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'saved', -- 'saved', 'applied', 'interviewing', 'rejected', 'hired'
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_id)
);

-- 7. Cursos (Catálogo)
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  provider VARCHAR(150) NOT NULL, -- Ex: Coursera, Udemy
  url TEXT NOT NULL,
  duration_hours INT,
  level VARCHAR(50), -- Beginner, Intermediate, Advanced
  skills_covered TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relacionamento de Cursos Recomendados aos Usuários
CREATE TABLE user_courses (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'recommended', -- 'recommended', 'in_progress', 'completed'
  progress_percentage INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, course_id)
);

-- 8. Análises de IA
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL, -- Se a análise for específica para uma vaga
  match_score INT CHECK (match_score BETWEEN 0 AND 100),
  strengths TEXT[],
  weaknesses TEXT[],
  improvement_tips TEXT,
  raw_response JSONB, -- Resposta bruta do Gemini
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Entrevistas Simuladas
CREATE TABLE mock_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed'
  overall_score INT CHECK (overall_score BETWEEN 0 AND 100),
  general_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Respostas individuais das entrevistas
CREATE TABLE mock_interview_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID REFERENCES mock_interviews(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  user_answer_text TEXT,
  audio_storage_path TEXT, -- Caminho no Storage para resposta em áudio (opcional)
  score INT CHECK (score BETWEEN 0 AND 100),
  ai_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para otimização de performance
CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_experiences_resume_id ON experiences(resume_id);
CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_ai_analyses_user_id ON ai_analyses(user_id);
CREATE INDEX idx_mock_interviews_user_id ON mock_interviews(user_id);

-- Row Level Security (RLS) - Exemplo básico para usuários e currículos
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem ver o próprio perfil" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Usuários podem atualizar o próprio perfil" ON users FOR UPDATE USING (auth.uid() = id);

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários gerenciam próprios currículos" ON resumes FOR ALL USING (auth.uid() = user_id);
