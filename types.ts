
export type MaterialType = 'curso' | 'ebook';

export interface Comment {
  id: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  pdfUrl?: string;
  order: number;
}

export interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Material {
  id: string;
  title: string;
  type: MaterialType;
  category: string;
  description: string;
  imageUrl: string;
  videoUrl?: string; // For simple courses or preview
  views: number;
  comments: Comment[];
  isReadBy: string[];
  gradient: string;
  modules?: Module[]; // For full courses
  createdAt?: string;
}

export interface AppSettings {
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroButtonText: string;
  heroButtonLink: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status?: 'pending' | 'active' | 'blocked';
  role?: 'admin' | 'user';
}

export const CATEGORIES = [
  'Desenvolvimento Pessoal',
  'Finanças',
  'Produtividade',
  'Bem-estar',
  'Marketing',
  'Filosofia',
  'Tecnologia'
];

import { 
  User as UserIcon, 
  DollarSign, 
  Zap, 
  Heart, 
  TrendingUp, 
  BookOpen, 
  Code,
  Layout
} from 'lucide-react';

export const CATEGORY_ICONS: Record<string, any> = {
  'Todos': Layout,
  'Desenvolvimento Pessoal': UserIcon,
  'Finanças': DollarSign,
  'Produtividade': Zap,
  'Bem-estar': Heart,
  'Marketing': TrendingUp,
  'Filosofia': BookOpen,
  'Tecnologia': Code
};
