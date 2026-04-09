
import { Material } from './types';

/**
 * BANCO DE DADOS GLOBAL DA ACADEMIA
 * Para adicionar novos conteúdos para TODOS os usuários:
 * 1. Copie um bloco de { ... } abaixo
 * 2. Cole antes do último colchete ]
 * 3. Altere os textos e o link da imagem (imageUrl)
 * 4. Salve e suba para o GitHub
 */

export const INITIAL_MATERIALS: Material[] = [
  {
    id: '1',
    title: 'Jogo da Vida - O Método 10 em 1',
    type: 'curso',
    category: 'Desenvolvimento Pessoal',
    description: 'A metodologia definitiva para dominar todas as áreas da sua vida e alcançar resultados extraordinários em tempo recorde.',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1471&auto=format&fit=crop',
    views: 1240,
    comments: [],
    isReadBy: [],
    gradient: 'from-purple-600 via-pink-500 to-red-500'
  },
  {
    id: '2',
    title: 'SPR7 - Multiplicação de Riqueza',
    type: 'curso',
    category: 'Finanças',
    description: 'Sete princípios fundamentais para reter e multiplicar sua riqueza através de investimentos inteligentes.',
    imageUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?q=80&w=1471&auto=format&fit=crop',
    views: 890,
    comments: [],
    isReadBy: [],
    gradient: 'from-orange-500 to-red-600'
  },
  {
    id: '4',
    title: 'Rico com Internet',
    type: 'curso',
    category: 'Marketing',
    description: 'Descubra as estratégias ocultas que os grandes players usam para faturar milhões todos os meses.',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1426&auto=format&fit=crop',
    views: 5430,
    comments: [],
    isReadBy: [],
    gradient: 'from-green-500 to-emerald-700'
  },
  {
    id: '5',
    title: 'IP do Milhão',
    type: 'curso',
    category: 'Finanças',
    description: 'Inteligência Patrimonial: O caminho para o primeiro milhão começando do zero absoluto.',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1611&auto=format&fit=crop',
    views: 3200,
    comments: [],
    isReadBy: [],
    gradient: 'from-yellow-400 to-orange-500'
  },
  {
    id: '6',
    title: 'SPR - Segredos dos Pequenos Ricos',
    type: 'ebook',
    category: 'Finanças',
    description: 'O livro digital que revela como pessoas comuns estão construindo fortunas silenciosamente.',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1374&auto=format&fit=crop',
    views: 120,
    comments: [],
    isReadBy: [],
    gradient: 'from-pink-500 to-rose-700'
  },
  {
    id: '9',
    title: 'SPD - Sono e Produtividade',
    type: 'curso',
    category: 'Produtividade',
    description: 'O equilíbrio perfeito entre alta performance e qualidade de vida.',
    imageUrl: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?q=80&w=1467&auto=format&fit=crop',
    views: 1560,
    comments: [],
    isReadBy: [],
    gradient: 'from-violet-500 to-purple-800'
  }
];
