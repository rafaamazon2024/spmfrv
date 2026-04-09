
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LogOut, Search, Grid, List, Book, PlayCircle, Plus, Trash2, Edit3, 
  LayoutDashboard, MessageSquare, Eye, CheckCircle, X, Send, 
  ArrowRight, Users, Layers, Star, RotateCcw, Loader2, ExternalLink, 
  Database, AlertCircle, Image as ImageIcon, Info, FileText, UploadCloud,
  Settings as SettingsIcon, Monitor, Sparkles, Link as LinkIcon,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { 
  auth, 
  db, 
  googleProvider, 
  signOut, 
  onAuthStateChanged,
  collection,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  storage
} from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithPopup } from 'firebase/auth';
import { setDoc, doc, getDocFromServer } from 'firebase/firestore';
import { User, Material, AppSettings, CATEGORIES, CATEGORY_ICONS, MaterialType } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const uploadFile = async (file: File, path: string): Promise<string> => {
  const uploadPromise = (async () => {
    try {
      const user = auth.currentUser;
      console.log("Iniciando uploadFile...", { 
        fileName: file.name, 
        fileSize: file.size, 
        path, 
        userId: user?.uid,
        isAnonymous: user?.isAnonymous
      });

      if (!user) {
        throw new Error("Usuário não autenticado. Por favor, faça login novamente.");
      }

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const fileName = `${Date.now()}_${sanitizedName}`;
      const fileRef = ref(storage, `${path}/${fileName}`);
      console.log("Referência do arquivo criada:", fileRef.fullPath);
      
      const metadata = {
        contentType: file.type,
      };

      const result = await uploadBytes(fileRef, file, metadata);
      console.log("Upload concluído com sucesso:", result.metadata.fullPath);
      
      const url = await getDownloadURL(fileRef);
      console.log("URL de download obtida:", url);
      if (!url) throw new Error("O upload foi concluído, mas não conseguimos gerar o link da imagem.");
      return url;
    } catch (error: any) {
      console.error("Erro detalhado no uploadFile:", error);
      const code = error.code || "unknown";
      const message = error.message || "Erro desconhecido";
      
      if (code === 'storage/unauthorized') {
        throw new Error("Sem permissão para upload. Você precisa ativar o Firebase Storage no Console e definir as regras de segurança como públicas ou para usuários autenticados.");
      } else if (code === 'storage/canceled') {
        throw new Error("Upload cancelado pelo usuário.");
      } else if (code === 'storage/retry-limit-exceeded') {
        throw new Error("Limite de tentativas excedido. Verifique sua conexão.");
      } else if (code === 'storage/invalid-checksum') {
        throw new Error("Erro de integridade no arquivo. Tente novamente.");
      }
      
      throw new Error(`[${code}] ${message}`);
    }
  })();

  const timeoutPromise = new Promise<string>((_, reject) => 
    setTimeout(() => reject(new Error("O upload demorou demais (timeout de 30s). Verifique sua conexão ou o tamanho do arquivo.")), 30000)
  );

  return Promise.race([uploadPromise, timeoutPromise]);
};

const getRandomGradient = () => {
  const gradients = [
    'from-indigo-500 via-purple-500 to-pink-500',
    'from-amber-400 via-orange-500 to-red-600',
    'from-cyan-400 via-blue-500 to-indigo-600',
    'from-emerald-400 via-teal-500 to-cyan-600'
  ];
  return gradients[Math.floor(Math.random() * gradients.length)];
};

const DEFAULT_SETTINGS: AppSettings = {
  heroTitle: "Domine\nO Próximo Nível.",
  heroSubtitle: "Sua biblioteca privada de alta performance.",
  heroImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1964&auto=format&fit=crop",
  heroButtonText: "Começar Agora",
  heroButtonLink: "#vitrine"
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthMode, setIsAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAppInit, setIsAppInit] = useState(true);
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  const [items, setItems] = useState<Material[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isAdminTab, setIsAdminTab] = useState<'library' | 'users' | 'settings'>('library');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'todos' | 'curso' | 'ebook'>('todos');
  const [selectedItem, setSelectedItem] = useState<Material | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<{moduleId: string, lessonId: string} | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isViewerMenuOpen, setIsViewerMenuOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState<Partial<Material>>({
    title: '',
    type: 'curso',
    category: CATEGORIES[0],
    description: '',
    imageUrl: '',
    videoUrl: '',
    views: 0,
    modules: [],
    imageFit: 'cover'
  });
  const [toasts, setToasts] = useState<{id: string, message: string, type?: 'success' | 'error'}[]>([]);

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firebase connection established successfully.");
      } catch (error: any) {
        if (error.message && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client appears to be offline.");
          setDbStatus('error');
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isAdmin = user.email === 'admin@academia.com' || user.email === 'rafa.araujo.27@gmail.com';
        
        // Get user data from Firestore to check status
        let userStatus: 'pending' | 'active' | 'blocked' = 'pending';
        try {
          const userDoc = await getDocFromServer(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            userStatus = userDoc.data().status || 'pending';
          } else {
            // New user, create with pending status
            await setDoc(doc(db, 'users', user.uid), {
              id: user.uid,
              name: user.displayName || user.email?.split('@')[0] || 'Membro',
              email: user.email || '',
              isAdmin,
              role: isAdmin ? 'admin' : 'user',
              status: isAdmin ? 'active' : 'pending',
              createdAt: new Date().toISOString()
            });
            userStatus = isAdmin ? 'active' : 'pending';
          }
        } catch (e) {
          console.error("Error checking user status:", e);
        }

        const userData: User = {
          id: user.uid,
          name: user.displayName || user.email?.split('@')[0] || 'Membro',
          email: user.email || '',
          isAdmin,
          status: userStatus,
          role: isAdmin ? 'admin' : 'user'
        };
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setIsAppInit(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let unsubscribeMaterials: (() => void) | undefined;
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeSettings: (() => void) | undefined;

    if (currentUser) {
      // Fetch Settings
      unsubscribeSettings = onSnapshot(doc(db, 'settings', 'app'), (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSettings);
        }
      });

      // Fetch Materials
      const materialsPath = 'materials';
      const qMaterials = query(collection(db, materialsPath), orderBy('title'));
      unsubscribeMaterials = onSnapshot(qMaterials, (snapshot) => {
        const data = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data(),
          gradient: docSnap.data().gradient || getRandomGradient(),
        } as unknown as Material));
        setItems(data);
        setDbStatus('connected');
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, materialsPath);
        setDbStatus('error');
      });

      // Fetch Users (Admin only)
      if (currentUser.isAdmin) {
        const usersPath = 'users';
        const qUsers = query(collection(db, usersPath), orderBy('email'));
        unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
          const data = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...docSnap.data()
          } as User));
          setAllUsers(data);
        }, (error) => {
          console.error("Error fetching users:", error);
        });
      }
    }

    return () => {
      if (unsubscribeMaterials) unsubscribeMaterials();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, [currentUser]);

  const handleSaveSettings = async (newSettings: AppSettings) => {
    if (!currentUser?.isAdmin) return;
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'app'), newSettings);
      addToast("Configurações salvas com sucesso!");
    } catch (e: any) {
      addToast("Erro ao salvar configurações", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: 'active' | 'blocked' | 'pending') => {
    if (!currentUser?.isAdmin) return;
    try {
      await setDoc(doc(db, 'users', userId), { status }, { merge: true });
      addToast(`Status do usuário atualizado para ${status}`);
    } catch (e: any) {
      addToast("Erro ao atualizar status", 'error');
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isAuthMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (authName) {
          await updateProfile(userCredential.user, { displayName: authName });
        }
        addToast("Cadastro realizado com sucesso!");
      }
    } catch (e: any) {
      addToast(e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      console.log("Iniciando login com Google...", { auth, googleProvider });
      if (!auth || !googleProvider) {
        throw new Error("Serviço de autenticação não inicializado corretamente.");
      }
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Google login error details:", e);
      addToast("Erro no login com Google: " + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Iniciando handleAddMaterial...", { currentUser, newMaterial });
    
    if (!currentUser?.isAdmin) {
      console.error("Acesso negado: Usuário não é administrador.");
      addToast("Erro: Você não tem permissão para adicionar materiais.", 'error');
      return;
    }
    
    if (!newMaterial.title || !newMaterial.title.trim()) {
      addToast("O título é obrigatório.", 'error');
      return;
    }

    setIsLoading(true);
    addToast("Criando material...");
    try {
      const path = 'materials';
      const materialId = Date.now().toString();
      const materialData = {
        ...newMaterial,
        id: materialId,
        createdAt: new Date().toISOString(),
        views: 0,
        gradient: getRandomGradient()
      };

      console.log("Salvando material no Firestore...", materialData);
      const docRef = doc(db, path, materialId);
      console.log("Caminho do documento:", docRef.path);
      await setDoc(docRef, materialData);
      console.log("Material salvo com sucesso!");
      addToast("Material adicionado com sucesso!");
      setIsAddModalOpen(false);
      setNewMaterial({
        title: '',
        type: 'curso',
        category: CATEGORIES[0],
        description: '',
        imageUrl: '',
        videoUrl: '',
        views: 0,
        modules: [],
        imageFit: 'cover'
      });
    } catch (e: any) {
      console.error("Erro ao adicionar material:", e);
      addToast("Erro ao adicionar material: " + (e.message || "Erro desconhecido"), 'error');
      handleFirestoreError(e, OperationType.WRITE, 'materials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file', callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      addToast("O arquivo é muito grande. O limite é 10MB.", 'error');
      return;
    }
    
    console.log("Arquivo selecionado para upload:", {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    setIsUploading(true);
    try {
      const folder = type === 'image' ? 'covers' : 'materials';
      const url = await uploadFile(file, folder);
      callback(url);
      addToast("Arquivo enviado com sucesso!");
    } catch (e: any) {
      console.error("Upload error:", e);
      const errorMessage = e?.message || "Erro desconhecido";
      addToast(`Erro ao enviar: ${errorMessage}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveCourse = async (courseData: Material) => {
    if (!currentUser?.isAdmin) return;
    setIsLoading(true);
    try {
      await setDoc(doc(db, 'materials', courseData.id), courseData, { merge: true });
      addToast("Curso salvo com sucesso!");
      setIsEditingCourse(false);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'materials');
      addToast("Erro ao salvar curso", 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const addModule = () => {
    const modules = [...(newMaterial.modules || [])];
    modules.push({
      id: Date.now().toString(),
      title: `Módulo ${modules.length + 1}`,
      order: modules.length,
      lessons: []
    });
    setNewMaterial({ ...newMaterial, modules });
  };

  const addLesson = (moduleId: string) => {
    const modules = [...(newMaterial.modules || [])];
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    if (moduleIndex === -1) return;

    modules[moduleIndex].lessons.push({
      id: Date.now().toString(),
      title: `Aula ${modules[moduleIndex].lessons.length + 1}`,
      order: modules[moduleIndex].lessons.length
    });
    setNewMaterial({ ...newMaterial, modules });
  };

  const updateLesson = (moduleId: string, lessonId: string, updates: Partial<any>) => {
    const modules = [...(newMaterial.modules || [])];
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    const lessonIndex = modules[moduleIndex].lessons.findIndex(l => l.id === lessonId);
    
    modules[moduleIndex].lessons[lessonIndex] = {
      ...modules[moduleIndex].lessons[lessonIndex],
      ...updates
    };
    setNewMaterial({ ...newMaterial, modules });
  };

  // Filter items based on search
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const title = item.title?.toLowerCase() || '';
      const description = item.description?.toLowerCase() || '';
      const search = searchTerm.toLowerCase();
      return title.includes(search) || description.includes(search);
    });
  }, [items, searchTerm]);

  const currentLessonData = useMemo(() => {
    if (!selectedItem || !selectedLesson) return null;
    const module = selectedItem.modules?.find(m => m.id === selectedLesson.moduleId);
    return module?.lessons.find(l => l.id === selectedLesson.lessonId);
  }, [selectedItem, selectedLesson]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId) 
        : [...prev, moduleId]
    );
  };

  useEffect(() => {
    if (selectedLesson && !expandedModules.includes(selectedLesson.moduleId)) {
      setExpandedModules(prev => [...prev, selectedLesson.moduleId]);
    }
  }, [selectedLesson]);

  if (isAppInit) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-purple-600" size={40} /></div>;

  if (!currentUser) {
    // ... (Login screen remains same)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="glass max-w-md w-full p-8 lg:p-12 rounded-[2.5rem] lg:rounded-[3rem] text-center space-y-8 bg-zinc-950 lg:bg-white/5">
          <Layers size={48} className="mx-auto text-purple-500" />
          <h1 className="text-3xl font-black">ACESSO VITALÍCIO</h1>
          
          <button onClick={handleGoogleLogin} className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-3 hover:scale-105 transition-all">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google Login
          </button>

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <input type="email" placeholder="E-mail" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10" required />
            <input type="password" placeholder="Senha" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10" required />
            <button type="submit" disabled={isLoading} className="w-full py-4 bg-purple-600 font-bold rounded-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
              {isLoading && <Loader2 className="animate-spin" size={18} />} Entrar
            </button>
          </form>
          <p className="text-xs text-gray-500">Dica Admin: admin@academia.com / admin123</p>
          <div className="fixed top-4 right-4 space-y-2">
            {toasts.map(t => <div key={t.id} className={`p-4 rounded-xl text-xs font-bold ${t.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>{t.message}</div>)}
          </div>
        </div>
      </div>
    );
  }

  if (currentUser.status === 'pending' && !currentUser.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="glass max-w-md w-full p-12 rounded-[3rem] text-center space-y-8">
          <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="animate-spin text-purple-500" size={40} />
          </div>
          <h1 className="text-3xl font-black">ACESSO PENDENTE</h1>
          <p className="text-gray-400">Olá, {currentUser.name}! Seu cadastro foi recebido, mas o administrador ainda precisa liberar seu acesso.</p>
          <p className="text-sm text-purple-400 font-bold">Aguarde a liberação para acessar os conteúdos.</p>
          <button onClick={() => signOut(auth)} className="w-full py-4 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all">Sair da Conta</button>
        </div>
      </div>
    );
  }

  if (currentUser.status === 'blocked' && !currentUser.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="glass max-w-md w-full p-12 rounded-[3rem] text-center space-y-8">
          <AlertCircle size={64} className="mx-auto text-red-500" />
          <h1 className="text-3xl font-black text-red-500">ACESSO BLOQUEADO</h1>
          <p className="text-gray-400">Sua conta foi suspensa. Entre em contato com o suporte para mais informações.</p>
          <button onClick={() => signOut(auth)} className="w-full py-4 bg-white/5 text-white font-bold rounded-xl hover:bg-white/10 transition-all">Sair da Conta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* HEADER PRINCIPAL */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5 px-6 lg:px-12 py-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative w-12 h-12 bg-black rounded-2xl flex items-center justify-center font-black text-2xl border border-white/10">
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-white to-gray-500">S</span>
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black uppercase tracking-[-0.05em] leading-none mb-1">SPMFRV</h1>
            <p className="text-[10px] text-purple-500/80 font-black uppercase tracking-[0.2em]">Premium Experience</p>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-8 hidden md:block">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Buscar curso ou material..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {currentUser?.isAdmin && (
            <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
              <button 
                onClick={() => setIsAdminTab('library')}
                className={`p-2.5 rounded-xl transition-all ${isAdminTab === 'library' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}
                title="Biblioteca"
              >
                <Grid size={18} />
              </button>
              <button 
                onClick={() => setIsAdminTab('users')}
                className={`p-2.5 rounded-xl transition-all ${isAdminTab === 'users' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}
                title="Usuários"
              >
                <Users size={18} />
              </button>
              <button 
                onClick={() => setIsAdminTab('settings')}
                className={`p-2.5 rounded-xl transition-all ${isAdminTab === 'settings' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-gray-500 hover:text-white'}`}
                title="Configurações"
              >
                <SettingsIcon size={18} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold">{currentUser.name}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">{currentUser.isAdmin ? 'Admin' : 'Membro'}</p>
            </div>
            <button onClick={() => signOut(auth)} className="p-3 bg-white/5 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SEARCH */}
      <div className="md:hidden p-4 border-b border-white/5 bg-black/30">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm"
          />
        </div>
      </div>

      {/* CONTENT */}
      <main className="flex-1 p-6 lg:p-12 max-w-[1800px] mx-auto w-full overflow-y-auto relative">
        {/* Subtle Grain Overlay */}
        <div className="fixed inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-50"></div>
        
        {isAdminTab === 'users' && currentUser?.isAdmin ? (
          <div className="space-y-8 animate-fade-in">
            <header className="flex justify-between items-center">
              <h1 className="text-3xl lg:text-4xl font-black">Gerenciar Usuários</h1>
              <div className="bg-white/5 px-4 py-2 rounded-full text-xs font-bold text-gray-400">
                {allUsers.length} usuários cadastrados
              </div>
            </header>

            <div className="glass rounded-[2rem] overflow-hidden border border-white/10">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Usuário</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500">E-mail</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500">Status</th>
                    <th className="p-6 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allUsers.map(user => (
                    <tr key={user.id} className="hover:bg-white/5 transition-all">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center text-purple-500 font-bold">
                            {user.name[0]}
                          </div>
                          <span className="font-bold">{user.name}</span>
                        </div>
                      </td>
                      <td className="p-6 text-gray-400 text-sm">{user.email}</td>
                      <td className="p-6">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          user.status === 'active' ? 'bg-green-500/20 text-green-500' :
                          user.status === 'blocked' ? 'bg-red-500/20 text-red-500' :
                          'bg-amber-500/20 text-amber-500'
                        }`}>
                          {user.status || 'pending'}
                        </span>
                      </td>
                      <td className="p-6 text-right space-x-2">
                        {user.status !== 'active' && (
                          <button 
                            onClick={() => handleUpdateUserStatus(user.id, 'active')}
                            className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                            title="Ativar Acesso"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {user.status !== 'blocked' && user.email !== currentUser.email && (
                          <button 
                            onClick={() => handleUpdateUserStatus(user.id, 'blocked')}
                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            title="Bloquear Acesso"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : isAdminTab === 'settings' && currentUser?.isAdmin ? (
          <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
            <header>
              <h1 className="text-4xl font-black mb-2">Configurações do Sistema</h1>
              <p className="text-gray-500">Personalize o banner de destaque e outras opções.</p>
            </header>

            <div className="space-y-8">
              <section className="glass p-8 rounded-[2.5rem] border border-white/10 space-y-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-purple-500">
                  <Sparkles size={20} /> Banner de Destaque
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Título do Banner</label>
                    <input 
                      type="text"
                      value={settings.heroTitle}
                      onChange={e => setSettings({...settings, heroTitle: e.target.value})}
                      className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Subtítulo</label>
                    <input 
                      type="text"
                      value={settings.heroSubtitle}
                      onChange={e => setSettings({...settings, heroSubtitle: e.target.value})}
                      className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">URL da Imagem de Fundo</label>
                  <div className="flex gap-4">
                    <input 
                      type="url"
                      value={settings.heroImageUrl}
                      onChange={e => setSettings({...settings, heroImageUrl: e.target.value})}
                      className="flex-1 bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                    />
                    <label className="p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                      <UploadCloud size={20} />
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'image', (url) => setSettings({...settings, heroImageUrl: url}))} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Texto do Botão</label>
                    <input 
                      type="text"
                      value={settings.heroButtonText}
                      onChange={e => setSettings({...settings, heroButtonText: e.target.value})}
                      className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase">Link do Botão (Opcional)</label>
                    <input 
                      type="text"
                      value={settings.heroButtonLink}
                      onChange={e => setSettings({...settings, heroButtonLink: e.target.value})}
                      placeholder="#vitrine"
                      className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Curso em Destaque (Ação do Botão)</label>
                  <select 
                    value={settings.featuredCourseId || ''}
                    onChange={e => setSettings({...settings, featuredCourseId: e.target.value})}
                    className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                  >
                    <option value="">Nenhum curso selecionado</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>
                        [{item.type.toUpperCase()}] {item.title}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500">Ao selecionar um curso, o botão do banner abrirá as aulas dele automaticamente.</p>
                </div>

                <button 
                  onClick={() => handleSaveSettings(settings)}
                  disabled={isLoading}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-purple-600/20"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                  SALVAR CONFIGURAÇÕES
                </button>
              </section>
            </div>
          </div>
        ) : (
          <>
            {/* HERO BANNER */}
            {!searchTerm && (
              <section className="mb-16 animate-fade-in">
                <div className="relative h-[400px] lg:h-[500px] rounded-[3rem] overflow-hidden border border-white/5 group shadow-2xl">
                  <img 
                    src={settings.heroImageUrl} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] ease-out"
                    referrerPolicy="no-referrer"
                    alt="Hero"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
                  
                  <div className="absolute inset-0 p-8 lg:p-16 flex flex-col justify-center max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 text-purple-400 rounded-full border border-purple-500/30 text-[10px] font-black uppercase tracking-[0.2em] mb-6 w-fit animate-bounce-slow">
                      <Star size={12} fill="currentColor" /> Destaque da Semana
                    </div>
                    <h2 className="text-4xl lg:text-6xl font-black mb-4 leading-tight whitespace-pre-line">
                      {settings.heroTitle}
                    </h2>
                    <p className="text-gray-400 text-lg lg:text-xl mb-8 font-medium">
                      {settings.heroSubtitle}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <button 
                        onClick={() => {
                          const featured = items.find(i => i.id === settings.featuredCourseId);
                          if (featured) {
                            setSelectedItem(featured);
                            if (featured.modules && featured.modules.length > 0 && featured.modules[0].lessons.length > 0) {
                              setSelectedLesson({ moduleId: featured.modules[0].id, lessonId: featured.modules[0].lessons[0].id });
                            }
                          }
                        }}
                        className="px-8 py-4 bg-white text-black font-black rounded-2xl flex items-center gap-3 hover:scale-105 transition-all shadow-xl shadow-white/10"
                      >
                        <PlayCircle size={20} /> {settings.heroButtonText}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
              <div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tighter mb-2">Biblioteca de Conteúdo</h1>
                <p className="text-gray-500 font-medium">Explore nossos cursos e materiais exclusivos.</p>
              </div>
              {currentUser?.isAdmin && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-purple-600 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/20 active:scale-95"
                >
                  <Plus size={20} /> Novo Material
                </button>
              )}
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
              {filteredItems.map(item => (
                <div 
                  key={item.id} 
                  className="group relative bg-[#0A0A0A] rounded-[2.5rem] overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-500 cursor-pointer flex flex-col hover:shadow-[0_0_40px_rgba(147,51,234,0.1)]" 
                  onClick={() => {
                    setSelectedItem(item);
                    setIsEditingCourse(false);
                    if (item.modules && item.modules.length > 0 && item.modules[0].lessons.length > 0) {
                      setSelectedLesson({ moduleId: item.modules[0].id, lessonId: item.modules[0].lessons[0].id });
                    } else {
                      setSelectedLesson(null);
                    }
                  }}
                >
                  <div className="aspect-[16/10] overflow-hidden relative">
                    {item.imageUrl ? (
                      <img 
                        src={item.imageUrl} 
                        className={`w-full h-full ${item.imageFit === 'contain' ? 'object-contain bg-zinc-900' : 'object-cover'} group-hover:scale-105 transition-transform duration-700`} 
                        referrerPolicy="no-referrer"
                        alt={item.title}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/800/450`;
                        }}
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${item.gradient} flex items-center justify-center opacity-40`}>
                        <ImageIcon size={48} className="text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                    <div className="absolute top-4 left-4">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        {item.type}
                      </span>
                    </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-purple-400 transition-colors">{item.title}</h3>
                    <p className="text-gray-500 text-sm line-clamp-2 mb-6 flex-1">
                      {item.description || "Acesse agora este conteúdo exclusivo da nossa plataforma."}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                        <PlayCircle size={14} className="text-purple-500" />
                        {item.modules?.reduce((acc, m) => acc + m.lessons.length, 0) || 0} Aulas
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-purple-600 transition-all duration-300">
                        <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* VIEWER DE CURSO (ALUNO) */}
      {selectedItem && !isEditingCourse && (
        <div className="fixed inset-0 bg-black z-[200] flex flex-col lg:flex-row animate-fade-in">
          {/* Mobile Viewer Header */}
          <header className="lg:hidden p-4 border-b border-white/10 flex justify-between items-center bg-zinc-950 sticky top-0 z-[210]">
            <button onClick={() => setSelectedItem(null)} className="p-2">
              <RotateCcw size={20} />
            </button>
            <h2 className="text-sm font-black truncate px-4">{selectedItem.title}</h2>
            <button onClick={() => setIsViewerMenuOpen(!isViewerMenuOpen)} className="p-2">
              {isViewerMenuOpen ? <X size={20} /> : <List size={20} />}
            </button>
          </header>

          {/* Sidebar do Curso */}
          <aside className={`
            fixed inset-0 lg:relative lg:inset-auto z-[220] lg:z-0
            w-full lg:w-96 border-r border-white/10 flex flex-col bg-zinc-950 lg:glass
            transition-transform duration-300 lg:translate-x-0
            ${isViewerMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <div className="p-6 lg:p-8 border-b border-white/10 flex justify-between items-center lg:block">
              <div className="lg:block">
                <button onClick={() => setSelectedItem(null)} className="hidden lg:flex items-center gap-2 text-gray-400 hover:text-white transition-all mb-4">
                  <RotateCcw size={16} /> Voltar à Biblioteca
                </button>
                <h2 className="text-xl lg:text-2xl font-black line-clamp-2 mb-4">{selectedItem.title}</h2>
                
                {currentUser?.isAdmin && (
                  <button 
                    onClick={() => setIsEditingCourse(true)}
                    className="w-full py-3 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-purple-600 hover:text-white transition-all mb-4"
                  >
                    <Edit3 size={14} /> MODO EDITOR
                  </button>
                )}
              </div>
              <button onClick={() => setIsViewerMenuOpen(false)} className="lg:hidden p-2">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedItem.modules?.map((module, mIdx) => {
                const isExpanded = expandedModules.includes(module.id);
                return (
                  <div key={module.id} className="space-y-1">
                    <button 
                      onClick={() => toggleModule(module.id)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all ${
                        isExpanded ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={14} className={isExpanded ? 'text-purple-500' : ''} />
                        <span className="text-left">Módulo {mIdx + 1}: {module.title}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {isExpanded && (
                      <div className="space-y-1 pl-4 animate-fade-in">
                        {module.lessons.map((lesson) => (
                          <button 
                            key={lesson.id}
                            onClick={() => {
                              setSelectedLesson({ moduleId: module.id, lessonId: lesson.id });
                              setIsViewerMenuOpen(false);
                            }}
                            className={`w-full text-left p-4 rounded-xl text-sm flex items-center gap-3 transition-all ${
                              selectedLesson?.lessonId === lesson.id ? 'bg-purple-600 text-white font-bold' : 'hover:bg-white/5 text-gray-400'
                            }`}
                          >
                            {lesson.videoUrl ? <PlayCircle size={16} /> : <FileText size={16} />}
                            <span className="flex-1 line-clamp-1">{lesson.title}</span>
                            {selectedLesson?.lessonId === lesson.id && <CheckCircle size={14} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Área de Conteúdo */}
          <main className="flex-1 flex flex-col bg-zinc-950 overflow-y-auto">
            {currentLessonData ? (
              <div className="flex-1 flex flex-col p-6 lg:p-12">
                <div className="max-w-5xl mx-auto w-full space-y-6 lg:space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                    <div>
                      <h3 className="text-[10px] lg:text-sm font-bold text-purple-500 uppercase tracking-widest mb-2">Conteúdo da Aula</h3>
                      <h1 className="text-2xl lg:text-4xl font-black">{currentLessonData.title}</h1>
                    </div>
                    {currentLessonData.pdfUrl && (
                      <a 
                        href={currentLessonData.pdfUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 px-6 py-3 rounded-xl font-bold transition-all border border-white/10"
                      >
                        <FileText size={18} /> Baixar PDF
                      </a>
                    )}
                  </div>

                  {currentLessonData.videoUrl ? (
                    <div className="aspect-video w-full bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative group">
                      {currentLessonData.videoUrl.includes('youtube.com') || currentLessonData.videoUrl.includes('vimeo.com') || currentLessonData.videoUrl.includes('drive.google.com/file/d/') ? (
                        <iframe 
                          src={
                            currentLessonData.videoUrl.includes('drive.google.com') 
                              ? currentLessonData.videoUrl.replace('/view', '/preview').replace('?usp=sharing', '')
                              : currentLessonData.videoUrl.replace('watch?v=', 'embed/')
                          } 
                          className="w-full h-full"
                          allowFullScreen
                          allow="autoplay"
                        />
                      ) : (
                        <video 
                          src={currentLessonData.videoUrl} 
                          controls 
                          className="w-full h-full object-contain"
                          poster={selectedItem.imageUrl}
                        >
                          Seu navegador não suporta a reprodução de vídeos.
                        </video>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-white/5 rounded-[2rem] flex flex-col items-center justify-center border border-white/10 border-dashed">
                      <ImageIcon size={48} className="text-gray-600 mb-4" />
                      <p className="text-gray-500 font-bold">Esta aula não possui vídeo.</p>
                      {currentLessonData.pdfUrl && <p className="text-purple-400 mt-2">Acesse o material de apoio acima.</p>}
                    </div>
                  )}

                  <div className="glass p-8 rounded-[2rem] border border-white/10">
                    <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Info size={18} className="text-purple-500" /> Sobre esta aula
                    </h4>
                    <p className="text-gray-400 leading-relaxed">
                      {currentLessonData.description || "Nenhuma descrição disponível para esta aula."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <Sparkles size={64} className="text-purple-500 mb-6 animate-pulse" />
                <h2 className="text-3xl font-black mb-4">Bem-vindo ao Curso</h2>
                <p className="text-gray-500 max-w-md">Selecione uma aula no menu lateral para começar sua jornada de aprendizado.</p>
              </div>
            )}
          </main>
        </div>
      )}
      
      {/* EDITOR DE CURSO (ADMIN) */}
      {selectedItem && isEditingCourse && (
        <div className="fixed inset-0 bg-black z-[250] flex flex-col animate-fade-in overflow-y-auto">
          <header className="p-6 lg:p-8 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass sticky top-0 z-10">
            <div className="flex items-center gap-4 lg:gap-6">
              <button onClick={() => { setIsEditingCourse(false); setSelectedItem(null); }} className="p-2 lg:p-3 hover:bg-white/10 rounded-full transition-all">
                <RotateCcw className="w-5 h-5 lg:w-6 lg:h-6" />
              </button>
              <h1 className="text-lg lg:text-2xl font-black truncate max-w-[200px] sm:max-w-none">Editando: {selectedItem.title}</h1>
            </div>
            <div className="w-full sm:w-auto flex gap-4">
              <button 
                onClick={() => handleSaveCourse(selectedItem)}
                disabled={isLoading}
                className="w-full sm:w-auto px-6 lg:px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                SALVAR
              </button>
            </div>
          </header>

          <main className="max-w-5xl mx-auto w-full p-6 lg:p-12 space-y-8 lg:space-y-12">
            {/* Informações Básicas */}
            <section className="space-y-6">
              <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2 text-purple-500">
                <Info size={20} /> Informações Básicas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Título do Curso</label>
                  <input 
                    type="text"
                    value={selectedItem.title}
                    onChange={e => setSelectedItem({...selectedItem, title: e.target.value})}
                    className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase">Categoria</label>
                  <select 
                    value={selectedItem.category}
                    onChange={e => setSelectedItem({...selectedItem, category: e.target.value})}
                    className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500 appearance-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-500 uppercase">Descrição</label>
                <textarea 
                  value={selectedItem.description}
                  onChange={e => setSelectedItem({...selectedItem, description: e.target.value})}
                  className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500 h-32 resize-none"
                />
              </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                    <span>Capa do Curso</span>
                    <span className="text-purple-500 lowercase">URL ou Upload</span>
                  </label>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-6 lg:gap-8">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                          <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                          <input 
                            type="url"
                            value={selectedItem.imageUrl}
                            onChange={e => setSelectedItem({...selectedItem, imageUrl: e.target.value})}
                            className="w-full bg-zinc-900 p-4 pl-12 rounded-xl outline-none border border-white/10 focus:border-purple-500"
                            placeholder="Cole o link da imagem aqui..."
                          />
                        </div>
                        <label className="p-4 bg-purple-600/10 border border-purple-500/30 text-purple-400 rounded-xl cursor-pointer hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center gap-2 shrink-0">
                          <UploadCloud size={20} className={isUploading ? 'animate-bounce' : ''} />
                          <span className="text-sm font-bold">{isUploading ? 'Subindo...' : 'Fazer Upload'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'image', (url) => {
                            setSelectedItem(prev => prev ? {...prev, imageUrl: url} : null);
                          })} />
                        </label>
                      </div>
                      <p className="text-[10px] text-gray-500 italic">Dica: Se o upload falhar, você pode hospedar a imagem em sites como ImgBB ou PostImages e colar o link acima.</p>
                      
                      <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Ajuste da Imagem:</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setSelectedItem({...selectedItem, imageFit: 'cover'})}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${selectedItem.imageFit !== 'contain' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                          >
                            PREENCHER (CORTAR)
                          </button>
                          <button 
                            onClick={() => setSelectedItem({...selectedItem, imageFit: 'contain'})}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${selectedItem.imageFit === 'contain' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                          >
                            INTEIRA (SEM CORTES)
                          </button>
                        </div>
                      </div>
                    </div>
                  
                  <div className="aspect-video bg-white/5 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center relative group">
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-purple-500" size={32} />
                        <span className="text-[10px] font-bold text-purple-500 uppercase">Subindo...</span>
                      </div>
                    ) : selectedItem.imageUrl ? (
                      <img 
                        src={selectedItem.imageUrl} 
                        className={`w-full h-full ${selectedItem.imageFit === 'contain' ? 'object-contain bg-zinc-900' : 'object-cover'}`} 
                        referrerPolicy="no-referrer"
                        alt="Preview"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://via.placeholder.com/800x450?text=Erro+ao+carregar+imagem";
                        }}
                      />
                    ) : (
                      <div className="text-center p-4">
                        <ImageIcon size={24} className="text-gray-600 mx-auto mb-2" />
                        <span className="text-[10px] text-gray-600 font-bold uppercase">Sem Capa</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white uppercase tracking-widest">Preview da Capa</span>
                    </div>
                  </div>
                </div>
                {selectedItem.imageUrl && !isUploading && (
                  <p className="text-[10px] text-amber-500 font-bold flex items-center gap-1 mt-2">
                    <AlertCircle size={12} /> Lembre-se de clicar em "SALVAR ALTERAÇÕES" no topo para confirmar a nova capa.
                  </p>
                )}
              </div>
            </section>

            {/* Estrutura de Módulos */}
            <section className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2 text-purple-500">
                  <Layers size={20} /> Módulos e Aulas
                </h2>
                <button 
                  onClick={() => {
                    const modules = [...(selectedItem.modules || [])];
                    modules.push({ id: Date.now().toString(), title: "Novo Módulo", order: modules.length, lessons: [] });
                    setSelectedItem({...selectedItem, modules});
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold flex items-center gap-2 transition-all border border-white/10"
                >
                  <Plus size={16} /> Adicionar Módulo
                </button>
              </div>

              <div className="space-y-6">
                {selectedItem.modules?.map((module, mIdx) => (
                  <div key={module.id} className="glass p-6 lg:p-8 rounded-[2rem] border border-white/10 space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center font-black shrink-0">{mIdx + 1}</div>
                        <input 
                          type="text"
                          value={module.title}
                          onChange={e => {
                            const modules = [...(selectedItem.modules || [])];
                            modules[mIdx].title = e.target.value;
                            setSelectedItem({...selectedItem, modules});
                          }}
                          className="flex-1 bg-transparent border-b border-white/10 outline-none text-lg lg:text-xl font-bold focus:border-purple-500"
                          placeholder="Título do Módulo"
                        />
                      </div>
                      <div className="flex gap-2 w-full md:w-auto justify-end">
                        <button 
                          onClick={() => {
                            const modules = [...(selectedItem.modules || [])];
                            modules[mIdx].lessons.push({ id: Date.now().toString(), title: "Nova Aula", order: modules[mIdx].lessons.length });
                            setSelectedItem({...selectedItem, modules});
                          }}
                          className="flex-1 md:flex-none px-4 py-2 bg-purple-600/20 text-purple-400 rounded-lg text-[10px] font-bold hover:bg-purple-600/30 transition-all"
                        >
                          + Aula
                        </button>
                        <button 
                          onClick={() => {
                            const modules = (selectedItem.modules || []).filter(m => m.id !== module.id);
                            setSelectedItem({...selectedItem, modules});
                          }}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="md:pl-14 space-y-4">
                      {module.lessons.map((lesson, lIdx) => (
                        <div key={lesson.id} className="bg-white/5 p-4 lg:p-6 rounded-2xl border border-white/5 space-y-4">
                          <div className="flex gap-4 items-center">
                            <input 
                              type="text"
                              value={lesson.title}
                              onChange={e => {
                                const modules = [...(selectedItem.modules || [])];
                                modules[mIdx].lessons[lIdx].title = e.target.value;
                                setSelectedItem({...selectedItem, modules});
                              }}
                              className="flex-1 bg-transparent border-b border-white/10 outline-none font-bold focus:border-purple-500 text-sm"
                              placeholder="Título da Aula"
                            />
                            <button 
                              onClick={() => {
                                const modules = [...(selectedItem.modules || [])];
                                modules[mIdx].lessons = modules[mIdx].lessons.filter(l => l.id !== lesson.id);
                                setSelectedItem({...selectedItem, modules});
                              }}
                              className="p-2 text-gray-500 hover:text-red-500 transition-all"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Link do Vídeo</label>
                              <input 
                                type="url"
                                value={lesson.videoUrl || ''}
                                onChange={e => {
                                  const modules = [...(selectedItem.modules || [])];
                                  modules[mIdx].lessons[lIdx].videoUrl = e.target.value;
                                  setSelectedItem({...selectedItem, modules});
                                }}
                                className="w-full bg-black/40 p-3 rounded-xl outline-none border border-white/5 text-xs"
                                placeholder="YouTube, Vimeo, etc."
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-gray-500 uppercase">Material de Apoio</label>
                              <div className="flex gap-2">
                                <input 
                                  type="url"
                                  value={lesson.pdfUrl || ''}
                                  onChange={e => {
                                    const modules = [...(selectedItem.modules || [])];
                                    modules[mIdx].lessons[lIdx].pdfUrl = e.target.value;
                                    setSelectedItem({...selectedItem, modules});
                                  }}
                                  className="flex-1 bg-black/40 p-3 rounded-xl outline-none border border-white/5 text-xs"
                                  placeholder="URL do arquivo"
                                />
                                <label className="p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 transition-all shrink-0">
                                  <FileText size={18} className={isUploading ? 'animate-bounce text-purple-500' : ''} />
                                  <input 
                                    type="file" 
                                    accept=".pdf,.xls,.xlsx,.png,.jpg,.jpeg" 
                                    className="hidden" 
                                    onChange={e => handleFileUpload(e, 'file', (url) => {
                                      setSelectedItem(prev => {
                                        if (!prev) return null;
                                        const modules = [...(prev.modules || [])];
                                        modules[mIdx].lessons[lIdx].pdfUrl = url;
                                        return {...prev, modules};
                                      });
                                    })} 
                                  />
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>
        </div>
      )}

      {/* MODAL ADICIONAR (SIMPLIFICADO) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4 lg:p-6">
          <div className="bg-zinc-950 lg:glass max-w-2xl w-full p-8 lg:p-10 rounded-[2rem] lg:rounded-[2.5rem] relative animate-fade-in">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-6 right-6 lg:top-8 lg:right-8 p-2 hover:bg-white/10 rounded-full transition-all">
              <X size={24} />
            </button>
            <h2 className="text-2xl lg:text-3xl font-black mb-8 flex items-center gap-3"><Plus className="text-purple-500" /> Novo Material</h2>
            <form onSubmit={handleAddMaterial} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Título</label>
                  <input type="text" value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tipo</label>
                  <select value={newMaterial.type} onChange={e => setNewMaterial({...newMaterial, type: e.target.value as any})} className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500 transition-all appearance-none">
                    <option value="curso" className="bg-zinc-900">Curso</option>
                    <option value="ebook" className="bg-zinc-900">E-book</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Categoria</label>
                <select value={newMaterial.category} onChange={e => setNewMaterial({...newMaterial, category: e.target.value})} className="w-full bg-zinc-900 p-4 rounded-xl outline-none border border-white/10 focus:border-purple-500 transition-all appearance-none">
                  {CATEGORIES.map(c => <option key={c} value={c} className="bg-zinc-900">{c}</option>)}
                </select>
              </div>
              <button type="submit" disabled={isLoading} className="w-full py-5 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-3">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                CRIAR E EDITAR DEPOIS
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="fixed top-4 right-4 space-y-2 z-[100]">
        {toasts.map(t => <div key={t.id} className={`p-4 rounded-xl text-xs font-bold shadow-2xl animate-slide-in ${t.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>{t.message}</div>)}
      </div>
    </div>
  );
};

export default App;
