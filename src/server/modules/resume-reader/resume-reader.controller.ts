/* eslint-disable @typescript-eslint/no-explicit-any */
import { OcrIntegration } from '../../integrations/ocr.integration';
import { CacheIntegration } from '../../integrations/cache.integration';

/**
 * Módulo 2: Leitura de Currículo com Caching e Otimização via OCR Gratuito
 */
export class ResumeReaderController {
  static async parseResume(req: any, res: any) {
    try {
      const { pdfBase64, extractedText } = req.body;
      if (!pdfBase64 && !extractedText) {
        res.status(400).json({ error: 'Missing PDF data or extracted text' });
        return;
      }

      // 1. Usar resposta salva (Cache) para evitar qualquer reprocessamento/custo
      if (pdfBase64) {
        const cached = CacheIntegration.get<any>('resume-reader', pdfBase64);
        if (cached) {
          res.json(cached);
          return;
        }
      }

      // 2. Tentar obter o texto limpo do PDF (pré-extraído pelo cliente ou OCR de servidor)
      let textExtra = '';
      if (extractedText && extractedText.trim().length > 150) {
        textExtra = extractedText;
        console.log(`[ResumeReaderController] Usando texto pré-extraído pelo cliente (comprimento: ${textExtra.length})`);
      } else if (pdfBase64) {
        console.log('[ResumeReaderController] Texto do cliente indisponível ou muito curto. Iniciando OCR no servidor...');
        textExtra = await OcrIntegration.extractTextFromPdfBase64(pdfBase64);
      }

      console.log('[ResumeReaderController] Processando preenchimento em modo Gratuito Sem IA (Heurística Local)');
      const parsed = ResumeReaderController.parseTextWithHeuristics(textExtra);
      
      const hasData = Object.values(parsed).some(val => val && String(val).trim().length > 0);
      if (hasData && pdfBase64) {
        CacheIntegration.set('resume-reader', pdfBase64, parsed);
      }
      
      res.json(parsed);
    } catch (error: any) {
      console.error('Error parsing resume:', error);
      res.status(500).json({ error: 'Falha ao processar o currículo com OCR gratuito.' });
    }
  }

  static parseTextWithHeuristics(cleanText: string): any {
    const result: any = {
      nome: '',
      email: '',
      telefone: '',
      cidadeEstado: '',
      areaInteresse: '',
      ultimoCargo: '',
      tempoExperiencia: '1 a 3 anos',
      escolaridade: 'Ensino Superior Completo',
      habilidades: '',
      experiencias: '',
      cursos: '',
      tipoVaga: 'remota'
    };

    if (!cleanText) return result;

    const lines = cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const textoLower = cleanText.toLowerCase();

    // 1. EXTRAIR E-MAIL
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i;
    const emailMatch = cleanText.match(emailRegex);
    if (emailMatch) {
      result.email = emailMatch[0].toLowerCase();
    }

    // 2. EXTRAIR TELEFONE
    const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}\b/g;
    const phoneMatches = cleanText.match(phoneRegex);
    if (phoneMatches) {
      const sortedPhones = phoneMatches.filter(p => {
        const digits = p.replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 15;
      });
      if (sortedPhones.length > 0) {
        result.telefone = sortedPhones[0].trim();
      }
    }

    // 3. EXTRAIR NOME
    const nameKeywordsToAvoid = [
      'curriculum', 'currículo', 'cv', 'resumo', 'contato', 'página', 'informações', 'email', 'telefone', 
      'celular', 'whatsapp', 'linkedin', 'github', 'nascimento', 'solteiro', 'casado', 'idade', 'endereço',
      'telefone', 'perfil', 'objetivo', 'experiência', 'formação', 'acadêmica', 'habilidades', 'idiomas',
      'atividades', 'cursos', 'projetos', 'histórico'
    ];
    
    let foundName = '';
    for (let i = 0; i < Math.min(lines.length, 12); i++) {
      const line = lines[i];
      const lower = line.toLowerCase();
      
      if (lower.includes('@') || lower.includes('/') || lower.includes('.com') || lower.includes('http') || line.match(/\d/)) {
        continue;
      }
      if (nameKeywordsToAvoid.some(word => lower.includes(word))) {
        continue;
      }

      const words = line.split(/\s+/);
      const isWordCountOk = words.length >= 2 && words.length <= 5;
      const startsWithCap = /^[A-ZÀ-ÖØ-ß]/.test(line);
      
      if (isWordCountOk && startsWithCap) {
        foundName = line;
        break;
      }
    }
    
    if (!foundName && lines.length > 0) {
      for (const line of lines.slice(0, 5)) {
        const lower = line.toLowerCase();
        if (!lower.includes('@') && !line.match(/\d{4,}/) && !nameKeywordsToAvoid.some(w => lower.includes(w)) && line.length > 3 && line.length < 50) {
          foundName = line;
          break;
        }
      }
    }
    result.nome = foundName || (lines[0] ? lines[0].substring(0, 50) : 'Profissional');

    // 4. CIDADE / ESTADO (Corrigido regex de [A-Za-b] para [A-Za-z] para pegar todas as letras!)
    const cityStateRegex = /([A-Za-zÀ-ÿ\s]{3,30})\s*[-/,\s]\s*([A-Z]{2})\b/i;
    const cityStateMatch = cleanText.match(cityStateRegex);
    if (cityStateMatch) {
      result.cidadeEstado = `${cityStateMatch[1].trim()} - ${cityStateMatch[2].toUpperCase().trim()}`;
    } else {
      const estados = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
      for (const line of lines) {
        const match = line.match(/\b([A-Z]{2})\b/);
        if (match && estados.includes(match[1])) {
          if (line.length < 50 && line.split(/\s+/).length < 6) {
            result.cidadeEstado = line;
            break;
          }
        }
      }
    }
    if (!result.cidadeEstado) {
      result.cidadeEstado = 'São Paulo - SP'; // Fallback nacional
    }

    // 5. CLASSIFICADOR EM SEÇÃO POR LINHAS
    let currentSection: 'experience' | 'education' | 'skills' | 'courses' | 'objective' | 'unknown' = 'unknown';
    const sectionLines: {
      experience: string[];
      education: string[];
      skills: string[];
      courses: string[];
      objective: string[];
      [key: string]: string[];
    } = {
      experience: [],
      education: [],
      skills: [],
      courses: [],
      objective: []
    };

    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      const len = line.length;

      if (len < 50) {
        // Remove prefixos de listas e pontuação comum (ex: "1.", "-", "*", "##", ":")
        const cleanLower = lower.replace(/^[•\s*-○■#\d.]+\s*/, '').replace(/:$/, '').trim();

        if (
          cleanLower === 'experiência' || cleanLower === 'experiencia' || 
          cleanLower === 'experiência profissional' || cleanLower === 'experiências' || 
          cleanLower === 'experiências profissionais' || cleanLower.includes('histórico profissional') || 
          cleanLower.includes('trajetória profissional') || cleanLower.includes('atuação profissional') || 
          cleanLower === 'experiência de trabalho' || cleanLower === 'histórico de trabalho' ||
          cleanLower.startsWith('onde trabalhei') || cleanLower === 'experiencia laboral' ||
          cleanLower === 'experiencias' || cleanLower === 'professional experience' || cleanLower === 'experience'
        ) {
          currentSection = 'experience';
          continue;
        }
        if (
          cleanLower === 'formação' || cleanLower === 'formacao' || 
          cleanLower === 'formação acadêmica' || cleanLower === 'formação academica' || 
          cleanLower === 'educação' || cleanLower === 'educacao' || 
          cleanLower === 'escolaridade' || cleanLower.includes('acadêmic') ||
          cleanLower.includes('academica') || cleanLower === 'estudos' || cleanLower === 'instrução' ||
          cleanLower === 'education'
        ) {
          currentSection = 'education';
          continue;
        }
        if (
          cleanLower === 'habilidades' || cleanLower === 'competências' || 
          cleanLower === 'competencias' || cleanLower === 'skills' || 
          cleanLower.includes('habilidades técnicas') || cleanLower.includes('tecnologias') ||
          cleanLower.includes('conhecimentos técnicos') || cleanLower.includes('conhecimento técnico') ||
          cleanLower === 'ferramentas' || cleanLower === 'áreas de domínio' ||
          cleanLower === 'skills' || cleanLower === 'habiliades'
        ) {
          currentSection = 'skills';
          continue;
        }
        if (
          cleanLower === 'cursos' || cleanLower === 'certificados' || 
          cleanLower === 'certificações' || cleanLower === 'certificacoes' || 
          cleanLower.includes('cursos complementar') || cleanLower.includes('cursos de aperfeiçoamento') ||
          cleanLower.includes('aperfeiçoamento') || cleanLower.includes('idiomas') ||
          cleanLower === 'formação complementar' || cleanLower === 'atividades complementares' ||
          cleanLower === 'certifications' || cleanLower === 'courses'
        ) {
          currentSection = 'courses';
          continue;
        }
        if (
          cleanLower === 'objetivo' || cleanLower === 'objetivo profissional' || 
          cleanLower === 'sobre mim' || cleanLower === 'perfil' || 
          cleanLower === 'perfil profissional' || cleanLower === 'resumo' ||
          cleanLower === 'resumo profissional' || cleanLower === 'about me' || cleanLower === 'objective'
        ) {
          currentSection = 'objective';
          continue;
        }
      }

      if (currentSection !== 'unknown') {
        sectionLines[currentSection].push(line);
      }
    }

    // 6. ÚLTIMO CARGO & ÁREA INTERESSE INTELIGENTE
    let foundCargo = '';
    const cargoKeywords = [
      'desenvolvedor', 'programador', 'analista', 'gerente', 'coordenador', 'supervisor', 
      'assistente', 'auxiliar', 'consultor', 'engenheiro', 'designer', 'técnico', 'suporte',
      'vendedor', 'atendente', 'recepcionista', 'diretor', 'estagiário', 'aprendiz',
      'administrador', 'social media', 'psicólogo', 'médico', 'advogado', 'professor',
      'secretária', 'operador', 'motorista', 'líder', 'liderança', 'promotor', 'caixa'
    ];

    if (sectionLines.experience.length > 0) {
      for (const line of sectionLines.experience.slice(0, 4)) {
        const lower = line.toLowerCase();
        if (cargoKeywords.some(kw => lower.includes(kw)) && line.length < 50) {
          foundCargo = line;
          break;
        }
      }
    }
    if (!foundCargo && sectionLines.objective.length > 0) {
      for (const line of sectionLines.objective.slice(0, 3)) {
        const lower = line.toLowerCase();
        if (cargoKeywords.some(kw => lower.includes(kw)) && line.length < 50) {
          foundCargo = line;
          break;
        }
      }
    }
    if (!foundCargo) {
      for (let i = 1; i < Math.min(lines.length, 12); i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        if (cargoKeywords.some(kw => lower.includes(kw)) && line.length < 50) {
          foundCargo = line;
          break;
        }
      }
    }

    result.ultimoCargo = foundCargo ? foundCargo.replace(/^[•\s*-○■]+/, '').trim() : '';
    if (!result.ultimoCargo) {
      result.ultimoCargo = 'Desenvolvedor / profissional';
    }
    result.areaInteresse = result.ultimoCargo.replace(/Junior|Pleno|Senior|Júnior|Sênior|Jr|Pl|Sr/gi, '').trim();
    if (!result.areaInteresse || result.areaInteresse.length < 3) {
      result.areaInteresse = 'Tecnologia / Suporte';
    }

    // 7. ESCOLARIDADE
    let extractedEducation = 'Ensino Superior Completo';
    const eduText = (sectionLines.education.join('\n') + '\n' + cleanText).toLowerCase();
    
    if (eduText.includes('pós-graduação') || eduText.includes('pos-graducao') || eduText.includes('especialização') || eduText.includes('mba') || eduText.includes('mestrado') || eduText.includes('doutorado') || eduText.includes('pós graduação')) {
      extractedEducation = 'Pós-graduação / Especialização';
    } else if (eduText.includes('superior completo') || eduText.includes('bacharel') || eduText.includes('graduado em') || eduText.includes('graduou-se') || eduText.includes('licenciatura em') || eduText.includes('tecnólogo em') || eduText.includes('formado em')) {
      extractedEducation = 'Ensino Superior Completo';
    } else if (eduText.includes('superior incompleto') || (eduText.includes('cursando') && (eduText.includes('faculdade') || eduText.includes('universidade') || eduText.includes('graduação') || eduText.includes('superior')))) {
      extractedEducation = 'Ensino Superior Incompleto';
    } else if (eduText.includes('médio completo') || eduText.includes('ensino médio') || eduText.includes('colegial')) {
      extractedEducation = 'Ensino Médio Completo';
    } else if (eduText.includes('médio incompleto')) {
      extractedEducation = 'Ensino Médio Incompleto';
    } else if (eduText.includes('fundamental')) {
      extractedEducation = 'Ensino Fundamental';
    }
    result.escolaridade = extractedEducation;

    // 8. TEMPO EXPERIENCIA
    const hasMultipleJobs = (cleanText.match(/experiência|histórico profissional|empresas|anterior/gi) || []).length > 1;
    if (textoLower.includes('5 anos') || textoLower.includes('10 anos') || textoLower.includes('mais de 5') || textoLower.includes('anos de experiência') && (textoLower.includes(' 5 ') || textoLower.includes(' 6 ') || textoLower.includes(' 7 ') || textoLower.includes(' 8 ') || textoLower.includes(' 9 '))) {
      result.tempoExperiencia = 'Mais de 5 anos';
    } else if (textoLower.includes('3 anos') || textoLower.includes('4 anos') || textoLower.includes('3 a 5')) {
      result.tempoExperiencia = '3 a 5 anos';
    } else if (textoLower.includes('1 ano') || textoLower.includes('2 anos') || textoLower.includes('1 a 3')) {
      result.tempoExperiencia = '1 a 3 anos';
    } else if (textoLower.includes('meses') || textoLower.includes('menos de 1')) {
      result.tempoExperiencia = 'Menos de 1 ano';
    } else if (hasMultipleJobs) {
      result.tempoExperiencia = '3 a 5 anos';
    } else {
      result.tempoExperiencia = 'Sem experiência';
    }

    // 9. HABILIDADES COMPLEXAS
    const matchesSkills: string[] = [];
    if (sectionLines.skills.length > 0) {
      for (const line of sectionLines.skills) {
        const items = line.split(/[;,/|•○■*-]/).map(x => x.trim()).filter(x => x.length > 1 && x.length < 30);
        for (const item of items) {
          if (!matchesSkills.some(s => s.toLowerCase() === item.toLowerCase()) && matchesSkills.length < 15) {
            matchesSkills.push(item);
          }
        }
      }
    }
    
    const skillsList = [
      'HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Angular', 'Vue', 'Node.js', 'Express',
      'Python', 'Java', 'C#', 'SQL', 'MySQL', 'MongoDB', 'PostgreSQL', 'Git', 'GitHub', 'Docker',
      'Excel', 'Word', 'PowerPoint', 'Office', 'Scrum', 'WordPress', 'Google Analytics', 'SEO',
      'Atendimento', 'Vendas', 'Liderança', 'Trabalho em Equipe', 'Comunicação', 'Resolução de Problemas',
      'Inglês', 'Espanhol', 'Português', 'Gestão', 'Projetos', 'Finanças', 'Negociação', 'Marketing',
      'Figma', 'Photoshop', 'Canva', 'Copywriting', 'Redes', 'Suporte'
    ];
    for (const skill of skillsList) {
      const reg = new RegExp('\\b' + skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
      if (reg.test(cleanText) && !matchesSkills.some(s => s.toLowerCase() === skill.toLowerCase()) && matchesSkills.length < 15) {
        matchesSkills.push(skill);
      }
    }
    result.habilidades = matchesSkills.slice(0, 12).join(', ');
    if (!result.habilidades) {
      result.habilidades = 'Comunicação, Proatividade, Pacote Office, Trabalho em Equipe';
    }

    // 10. EXPERIENCIAS COMPLETAS
    if (sectionLines.experience.length > 0) {
      result.experiencias = sectionLines.experience.join('\n').trim();
    } else {
      const candidateLines = lines.filter(l => l.length > 15 && !l.includes('@') && !l.includes('http'));
      result.experiencias = candidateLines.slice(Math.floor(candidateLines.length / 4), Math.floor(candidateLines.length / 4) + 6).join('\n');
    }
    if (result.experiencias.length > 1500) {
      result.experiencias = result.experiencias.substring(0, 1497) + '...';
    }

    // 11. CURSOS E CERTIFICAÇÕES COMPLETAS
    if (sectionLines.courses.length > 0) {
      result.cursos = sectionLines.courses.join('\n').trim();
    } else {
      result.cursos = 'Cursos e capacitações listados no anexo do currículo profissional.';
    }
    if (result.cursos.length > 1000) {
      result.cursos = result.cursos.substring(0, 997) + '...';
    }

    // 12. TIPO DE VAGA
    if (textoLower.includes('remoto') || textoLower.includes('home office') || textoLower.includes('homeoffice') || textoLower.includes('distância')) {
      result.tipoVaga = 'remota';
    } else if (textoLower.includes('híbrido') || textoLower.includes('hibrido') || textoLower.includes('hybrid')) {
      result.tipoVaga = 'hibrida';
    } else {
      result.tipoVaga = 'presencial';
    }

    return result;
  }
}
