import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDoc, getDocs, addDoc, onSnapshot, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { Package, AlertTriangle, CheckCircle, Truck, Info, Camera, Clock, MapPin, Activity, Wifi, Factory, LogOut, User, BarChart3, TrendingUp, Award, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const firebaseConfig = {
  apiKey: "AIzaSyBMHgf9gtc9NZbJXxODxVWfB17Y81geUfo",
  authDomain: "tte-tenkan-lean.firebaseapp.com",
  projectId: "tte-tenkan-lean",
  storageBucket: "tte-tenkan-lean.firebasestorage.app",
  messagingSenderId: "379567823994",
  appId: "1:379567823994:web:e34423c78c1a1ecff3afc3",
  measurementId: "G-6VM1K3P7KK"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

// Utility: Check if order is urgent (>15 min pending)
const isUrgent = (timestamp, status) => {
  if (status !== 'PENDING' || !timestamp) return false;
  const now = Date.now();
  const orderTime = timestamp.toDate().getTime();
  return (now - orderTime) > 15 * 60 * 1000;
};

// Utility: Format timestamp
const formatTime = (timestamp) => {
  if (!timestamp) return '--:--';
  return timestamp.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};
const calculateLeadTime = (order) => {
  if (!order.deliveredAt || !order.timestamp) return null;
  return Math.floor((order.deliveredAt.toMillis() - order.timestamp.toMillis()) / 60000);
};

// Function to check for existing active orders
const checkExistingOrder = async (cardId) => {
  try {
    console.log('🔍 Buscando pedidos activos para:', cardId);

    const q = query(
      collection(db, 'active_orders'),
      where('cardId', '==', cardId),
      where('status', 'in', ['PENDING', 'IN_TRANSIT'])
    );

    const querySnapshot = await getDocs(q);

    console.log('📊 Documentos encontrados:', querySnapshot.size);

    if (!querySnapshot.empty) {
      const existingOrder = querySnapshot.docs[0].data();
      console.log('⚠️ PEDIDO DUPLICADO DETECTADO:', existingOrder);

      return {
        exists: true,
        orderId: querySnapshot.docs[0].id,
        status: existingOrder.status,
        timestamp: existingOrder.timestamp,
        location: existingOrder.location,
        partNumber: existingOrder.partNumber
      };
    }

    console.log('✅ No hay pedidos duplicados, puede crear nuevo');
    return { exists: false };

  } catch (error) {
    console.error('❌ Error checking existing order:', error);
    return { exists: false, error: error.message };
  }
};
const LoginScreen = ({ onLoginSuccess }) => {
  const [apellido, setApellido] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const email = `${apellido.toLowerCase().trim()}@tte.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess(userCredential.user);
    } catch (err) {
      setError('Apellido o contraseña incorrectos');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-500/20 rounded-2xl mb-4">
            <Factory className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">TTE E-Kanban</h1>
          <p className="text-gray-400">Acceso para Personal de Almacén</p>
        </div>
        <form onSubmit={handleLogin} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Apellido</label>
            <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Ej: gomez" className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-lg" autoFocus />
            <p className="text-xs text-gray-500 mt-1">Se completará como: {apellido}@tte.com</p>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="w-full bg-gray-900/50 border border-gray-600 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-lg" />
          </div>
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
          <button type="submit" disabled={loading || !apellido || !password} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
            {loading ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verificando...</>) : (<><User className="w-5 h-5" />Iniciar Sesión</>)}
          </button>
        </form>
      </motion.div>
    </div>
  );
};
// Component: Operator View (Mobile)
const OperatorView = ({ currentUser }) => {
  const [cardId, setCardId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [existingOrderInfo, setExistingOrderInfo] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(0);

  const clearFeedback = () => {
    setFeedback(null);
    setExistingOrderInfo(null);
    setCardId('');
  };
  // AUTO-SUBMIT FROM URL PARAMETER
  useEffect(() => {
    if (autoSubmitted) return;

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');

    if (idFromUrl) {
      setCardId(idFromUrl.toUpperCase());
      setAutoSubmitted(true);

      // Auto-submit after a brief delay
      setTimeout(() => {
        handleScan(idFromUrl.toUpperCase());
      }, 500);
    }
  }, [autoSubmitted]);


  const handleScan = async (scannedId) => {
    if (!scannedId) return;
    setScanning(true);
    setFeedback(null);
    setExistingOrderInfo(null);

    try {
      const cardRef = doc(db, 'kanban_cards', scannedId);
      const cardSnap = await getDoc(cardRef);

      if (!cardSnap.exists()) {
        setFeedback({ type: 'error', message: 'Tarjeta NO REGISTRADA' });
        setScanning(false);
        return;
      }

      const card = cardSnap.data();
      const existingOrder = await checkExistingOrder(scannedId);

      if (!currentUser) {
        if (existingOrder.exists) {
          const mins = Math.floor((Date.now() - existingOrder.timestamp.toMillis()) / 60000);
          setExistingOrderInfo(existingOrder);
          setFeedback({ type: 'info', message: `Material solicitado hace ${mins} min\nEstado: ${existingOrder.status === 'PENDING' ? 'Pendiente' : 'En camino'}` });
        } else {
          await addDoc(collection(db, 'active_orders'), {
            cardId: scannedId, partNumber: card.partNumber, description: card.description,
            location: card.location, standardPack: card.standardPack, timestamp: serverTimestamp(),
            status: 'PENDING', operatorId: 'Producción', createdAt: serverTimestamp()
          });
          setFeedback({ type: 'success', message: `✓ Pedido confirmado\n${card.partNumber}` });
        }
      } else {
        if (existingOrder.exists && existingOrder.status === 'IN_TRANSIT') {
          setExistingOrderInfo({ ...existingOrder, card, canDeliver: true });
          setFeedback({ type: 'delivery', message: 'Material listo para entregar' });
        } else if (existingOrder.exists) {
          setExistingOrderInfo(existingOrder);
          setFeedback({ type: 'info', message: 'Pedido en proceso' });
        } else {
          await addDoc(collection(db, 'active_orders'), {
            cardId: scannedId, partNumber: card.partNumber, description: card.description,
            location: card.location, standardPack: card.standardPack, timestamp: serverTimestamp(),
            status: 'PENDING', operatorId: currentUser.email.split('@')[0], createdAt: serverTimestamp()
          });
          setFeedback({ type: 'success', message: `✓ Pedido creado` });
        }
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Error de conexión' });
    }
    setScanning(false);
  };
  const handleDeliveryConfirm = async () => {
    if (!existingOrderInfo?.orderId) return;
    try {
      await updateDoc(doc(db, 'active_orders', existingOrderInfo.orderId), {
        status: 'DELIVERED', deliveredAt: serverTimestamp(),
        deliveredBy: currentUser.email.split('@')[0]
      });
      setFeedback({ type: 'success', message: '✓ ENTREGA CONFIRMADA' });
      setExistingOrderInfo(null);
      setCardId('');
    } catch (error) {
      setFeedback({ type: 'error', message: 'Error al confirmar' });
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Factory className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">TTE E-KANBAN</h1>
              <p className="text-xs text-gray-400">{currentUser ? `${currentUser.email.split('@')[0]}` : 'Producción'}</p>
            </div>
          </div>
          {currentUser && (<button onClick={() => signOut(auth)} className="p-2 hover:bg-gray-800 rounded-lg"><LogOut className="w-5 h-5 text-gray-400" /></button>)}
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-8">
        {existingOrderInfo?.canDeliver && (
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="mb-6 bg-gradient-to-r from-green-500/20 to-green-600/20 border-2 border-green-500 rounded-2xl p-6">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-green-500/30 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-300" />
              </div>
              <h3 className="text-xl font-bold text-green-200 mb-2">Confirmar Recepción</h3>
              <p className="text-green-300">{existingOrderInfo.card.partNumber}</p>
            </div>
            <button onClick={handleDeliveryConfirm} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-3 text-lg">
              <CheckCircle className="w-6 h-6" />CONFIRMAR ENTREGA
            </button>
          </motion.div>
        )}

        <div className="bg-gray-800/30 rounded-2xl border border-gray-700/50 p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">ID de Tarjeta</label>
            <input type="text" value={cardId} onChange={(e) => setCardId(e.target.value.toUpperCase())} placeholder="MAT-001" className="w-full bg-gray-900/50 border-2 border-gray-700 rounded-xl px-5 py-4 text-white font-mono text-lg" />
          </div>
          <button onClick={() => handleScan(cardId)} disabled={!cardId || scanning} className="w-full bg-gradient-to-r from-blue-600 to-blue-700 disabled:from-gray-700 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-3 text-lg mb-3">
            {scanning ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Procesando...</>) : (<><CheckCircle className="w-5 h-5" />CONFIRMAR</>)}
          </button>

          {feedback && (
            <div className={`mt-4 p-4 rounded-xl border ${feedback.type === 'success' ? 'bg-green-500/10 border-green-500/30' : feedback.type === 'error' ? 'bg-red-500/10 border-red-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
              <p className="font-bold text-white">{feedback.message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; // BUSCÁ ESTA PARTE AL FINAL DE TU CÓDIGO Y REEMPLAZALA
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // SI ES MOBILE: Mostramos la vista de Operario (Pasándole el usuario logueado)
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    if (showLogin && !currentUser) {
      return <LoginScreen onLoginSuccess={() => setShowLogin(false)} />;
    }
    return (
      <div>
        {/* IMPORTANTE: Acá le pasamos el currentUser como PROP */}
        <OperatorView currentUser={currentUser} />
        {!currentUser && (
          <div className="fixed bottom-6 right-6">
            <button onClick={() => setShowLogin(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2">
              <User className="w-5 h-5" />Acceso Almacén
            </button>
          </div>
        )}
      </div>
    );
  }

  // SI ES DESKTOP: Mostramos el Dashboard de Almacén
  return <SupplyChainView currentUser={currentUser} />;
}
// Component: Supply Chain Dashboard
const SupplyChainView = () => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, inTransit: 0, delivered: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    console.log('Setting up Firestore listener...');

    const q = query(
      collection(db, 'active_orders'),
      where('status', 'in', ['PENDING', 'IN_TRANSIT'])
    );

    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        console.log('Snapshot received:', snapshot.size, 'documents');
        setIsConnected(true);

        const ordersData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          };
        });

        ordersData.sort((a, b) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return b.timestamp.toMillis() - a.timestamp.toMillis();
        });

        setOrders(ordersData);

        const pending = ordersData.filter(o => o.status === 'PENDING').length;
        const inTransit = ordersData.filter(o => o.status === 'IN_TRANSIT').length;

        setStats({ pending, inTransit, delivered: 0 });
      },
      (error) => {
        console.error('Firestore listener error:', error);
        setIsConnected(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'active_orders', orderId);
      const updateData = { status: newStatus };

      if (newStatus === 'DELIVERED') {
        updateData.deliveredAt = serverTimestamp();
      } else if (newStatus === 'IN_TRANSIT') {
        updateData.dispatchedAt = serverTimestamp();
      }

      await updateDoc(orderRef, updateData);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const locationStatuses = orders.reduce((acc, order) => {
    const loc = order.location || 'Unknown';
    if (!acc[loc]) {
      acc[loc] = { pending: false, inTransit: false };
    }
    if (order.status === 'PENDING') acc[loc].pending = true;
    if (order.status === 'IN_TRANSIT') acc[loc].inTransit = true;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Top Navigation Bar */}
      <div className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Factory className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">TTE E-KANBAN</h1>
                  <p className="text-xs text-gray-400">Dashboard • Supply Chain</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-medium ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                  {isConnected ? 'CONECTADO' : 'DESCONECTADO'}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Hora de planta</div>
                <div className="font-mono text-lg font-bold text-white">
                  {time.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                  <Bell className="w-5 h-5 text-gray-400" />
                </button>
                <button className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                  <Settings className="w-5 h-5 text-gray-400" />
                </button>
                <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="col-span-1 md:col-span-2">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Visión General</h2>
                  <p className="text-sm text-gray-400">Estado actual del flujo de materiales</p>
                </div>
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Pendientes"
                  value={stats.pending}
                  color="red"
                  trend={stats.pending > 5 ? "+2" : null}
                />
                <StatCard
                  icon={<Truck className="w-5 h-5" />}
                  label="En Tránsito"
                  value={stats.inTransit}
                  color="yellow"
                />
                <StatCard
                  icon={<CheckCircle className="w-5 h-5" />}
                  label="Entregados Hoy"
                  value={stats.delivered}
                  color="green"
                  trend="+12"
                />
              </div>
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Rendimiento</h2>
                  <p className="text-sm text-gray-400">Métricas de tiempo de entrega</p>
                </div>
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-white">15:24</div>
                  <div className="text-sm text-gray-400">Tiempo promedio</div>
                  <div className="text-xs text-green-400 mt-1">↓ 2.3min desde ayer</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-white">98.2%</div>
                  <div className="text-sm text-gray-400">Tasa de cumplimiento</div>
                  <div className="text-xs text-green-400 mt-1">↑ 0.8% desde ayer</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Plant Layout Map */}
        <PlantMap locationStatuses={locationStatuses} orders={orders} />

        {/* Orders Board */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <OrderColumn
            title="Pedidos Pendientes"
            status="PENDING"
            orders={orders.filter(o => o.status === 'PENDING')}
            onAction={(id) => handleStatusChange(id, 'IN_TRANSIT')}
            actionLabel="Despachar"
            actionIcon={<Truck className="w-4 h-4" />}
            color="red"
          />

          <OrderColumn
            title="En Tránsito"
            status="IN_TRANSIT"
            orders={orders.filter(o => o.status === 'IN_TRANSIT')}
            onAction={(id) => handleStatusChange(id, 'DELIVERED')}
            actionLabel="Marcar Entregado"
            actionIcon={<CheckCircle className="w-4 h-4" />}
            color="yellow"
          />
        </div>
      </div>
    </div>
  );
};

// Component: Plant Map
const PlantMap = ({ locationStatuses, orders }) => {
  const locations = [
    { id: 'Estantería A', x: 35, y: 24.64 },
    { id: 'Estantería B', x: 55.18, y: 29.64 },
    { id: 'Estantería C', x: 56.10, y: 69.22 },
    { id: 'Estantería D', x: 37.5, y: 66.88 },
  ];
  const handleMapClick = (e) => {

  };
  // Reemplazar esta URL por tu imagen real del plano de planta
  const plantLayoutImage = "tu-plano.png";

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Mapa de Planta</h2>
            <p className="text-sm text-gray-400">Estado en tiempo real por área</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-xs text-red-300">Pendiente</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span className="text-xs text-yellow-300">En Tránsito</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <span className="text-xs text-gray-300">Normal</span>
          </div>
        </div>
      </div>

      <div className="relative rounded-xl border-2 border-gray-700 h-96 overflow-hidden">
        <div
          onClick={handleMapClick}
          className="relative rounded-xl border-2 border-gray-700 h-96 overflow-hidden cursor-crosshair group"
        >
          {/* Imagen del plano - Centrada con márgenes negros a los lados */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/40 pointer-events-none">
            <img
              src={plantLayoutImage}
              alt="Plano de planta"
              className="w-full h-full object-contain opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-transparent to-transparent"></div>
          </div>

          {/* Overlay de grid sutil */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full">
              <defs>
                <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
                  <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          {/* Location Points */}
          {locations.map(location => {
            const status = locationStatuses[location.id];
            let color = 'bg-gray-600';
            let shouldPulse = false;
            let ringColor = 'ring-gray-500';

            if (status?.pending) {
              color = 'bg-red-500';
              shouldPulse = true;
              ringColor = 'ring-red-500/50';
            } else if (status?.inTransit) {
              color = 'bg-yellow-500';
              shouldPulse = true;
              ringColor = 'ring-yellow-500/50';
            }

            return (
              <motion.div
                key={location.id}
                className="absolute"
                style={{ left: `${location.x}%`, top: `${location.y}%` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.1 }}
              >
                <div className="relative -translate-x-1/2 -translate-y-1/2">
                  {shouldPulse && (
                    <motion.div
                      className={`absolute inset-0 ${color} rounded-full opacity-75`}
                      animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  <div className={`relative z-10 ${ringColor} ring-4`}>
                    <div className={`w-6 h-6 ${color} rounded-full flex items-center justify-center shadow-lg`}>
                      <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <div className="bg-gray-900/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-lg border border-gray-700 min-w-[120px]">
                      <p className="text-xs font-bold text-white text-center">{location.id}</p>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        {status?.pending && (
                          <span className="text-xs text-red-400 font-medium">Pendiente</span>
                        )}
                        {status?.inTransit && (
                          <span className="text-xs text-yellow-400 font-medium">En tránsito</span>
                        )}
                        {!status?.pending && !status?.inTransit && (
                          <span className="text-xs text-gray-400 font-medium">Normal</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-bold text-white mb-2">Leyenda de Áreas</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs text-gray-300">Producción</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-300">Logística</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-xs text-gray-300">Control</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component: Stat Card
const StatCard = ({ icon, label, value, color, trend }) => {
  const colorClasses = {
    red: 'bg-red-500/10 border-red-500/20',
    yellow: 'bg-yellow-500/10 border-yellow-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20'
  };

  const iconColorClasses = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400'
  };

  return (
    <div className={`${colorClasses[color]} rounded-xl border p-4`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <div className={iconColorClasses[color]}>
            {icon}
          </div>
        </div>
        {trend && (
          <div className={`px-2 py-1 rounded text-xs font-bold ${trend.startsWith('+') ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {trend}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-gray-400">{label}</div>
      </div>
    </div>
  );
};

// Component: Order Column
const OrderColumn = ({ title, status, orders, onAction, actionLabel, actionIcon, color }) => {
  const colorClasses = {
    red: 'border-red-500/20',
    yellow: 'border-yellow-500/20',
    green: 'border-green-500/20'
  };

  return (
    <div className={`bg-gray-900/50 backdrop-blur-sm rounded-xl border ${colorClasses[color]} p-6`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="text-sm text-gray-400">Actualizado en tiempo real</p>
        </div>
        <div className="bg-gray-800 text-white px-4 py-2 rounded-lg font-bold">
          {orders.length}
        </div>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        <AnimatePresence>
          {orders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onAction={onAction}
              actionLabel={actionLabel}
              actionIcon={actionIcon}
              color={color}
            />
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-gray-500 font-medium">Sin pedidos {status === 'PENDING' ? 'pendientes' : 'en tránsito'}</p>
            <p className="text-sm text-gray-600 mt-1">Todos los pedidos están al día</p>
          </div>
        )}
      </div>
      {/* Help Section */}
      <div className="mt-8 bg-gray-800/20 rounded-xl p-4 border border-gray-700/30">
        <h3 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
          <Info className="w-4 h-4" />
          Información útil
        </h3>
        <div className="text-xs text-gray-400 space-y-1">
          <p>• Solo se permite una solicitud activa por material</p>
          <p>• El almacén será notificado inmediatamente</p>
          <p>• Tiempo de respuesta estimado: 15-30 min</p>
          <p>• Para emergencias, contacte al supervisor</p>
        </div>
      </div>
    </div>

  );
};

// Component: Order Card
const OrderCard = ({ order, onAction, actionLabel, actionIcon, color }) => {
  const urgent = isUrgent(order.timestamp, order.status);

  const colorClasses = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500'
  };

  const buttonClasses = {
    red: 'bg-red-600 hover:bg-red-700 shadow-red-500/20',
    yellow: 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-500/20',
    green: 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={`bg-gray-800/50 backdrop-blur-sm rounded-xl border ${urgent ? 'border-red-500/50' : 'border-gray-700'} p-4 hover:border-gray-600 transition-colors`}
    >
      {urgent && (
        <motion.div
          className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-lg mb-3"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-sm font-bold text-red-400">ATENCIÓN: +15 minutos pendiente</span>
        </motion.div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${colorClasses[color]} animate-pulse`}></div>
            <span className="font-mono font-bold text-white text-lg">{order.partNumber}</span>
          </div>
          <p className="text-gray-300">{order.description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Hora</div>
          <div className="font-mono text-sm font-bold text-white">{formatTime(order.timestamp)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Ubicación</div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="font-medium text-white">{order.location}</span>
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Pack Estándar</div>
          <div className="font-medium text-white">{order.standardPack} unidades</div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => onAction(order.id)}
        className={`w-full ${buttonClasses[color]} text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3`}
      >
        {actionIcon}
        {actionLabel}
      </motion.button>
    </motion.div>
  );
};

// Main App
export default function App() {
  const [isMobile] = useState(window.innerWidth < 768);

  return isMobile ? <OperatorView /> : <SupplyChainView />;
}