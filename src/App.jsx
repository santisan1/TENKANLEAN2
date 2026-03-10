import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDoc, getDocs, addDoc,
  onSnapshot, updateDoc, doc, query, where, serverTimestamp, deleteDoc, setDoc
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import { Package, AlertTriangle, LogOut, CheckCircle, Award, Truck, Info, RotateCcw, Camera, Clock, MapPin, Activity, Factory, Warehouse, Settings, Bell, User, BarChart3, TrendingUp, TrendingDown, Users, Search, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Firebase Configuration
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

const getMaterialDisplayName = (data = {}) => data.stockKey || data.partNumber || 'Desconocido';

const buildOrderPayloadFromCard = (card = {}, cardId = '') => ({
  cardId,
  stockKey: card.stockKey || '',
  partNumber: card.partNumber || '',
  versionCode: card.versionCode || '',
  description: card.description || '',
  typeUnits: card.typeUnits || '',
  zona: card.zona || '',
  location: card.location || '',
  rackCode: card.rackCode || '',
  zoneCode: card.zoneCode || '',
  standardPack: card.standardPack || '',
  complexityWeight: card.complexityWeight || 1,
  stdOpTime: card.stdOpTime || 10,
  targetLeadTime: card.targetLeadTime || 30,
  totalBins: card.totalBins || 0
});

// ============ UTILIDAD PARA CALCULAR MÉTRICAS DE PEDIDO ============
const calculateOrderMetrics = (orderData, deliveredAt = new Date()) => {
  // Asegurarnos de que tenemos los timestamps esenciales
  if (!orderData.timestamp || !orderData.dispatchedAt) {
    console.error('❌ No hay timestamps suficientes para calcular métricas', orderData);
    // Retornar valores por defecto para evitar que falle el proceso
    return {
      reactionTime: 1,
      executionTime: 1,
      totalLeadTime: 1,
      taskEfficiency: 100,
      loadPoints: 1,
      effortPoints: 1,
      isSuspicious: false,
      onTime: false,
      complexityWeight: 1,
      stdOpTime: 10,
      targetLeadTime: 30
    };
  }

  // Convertir todos los timestamps a milisegundos
  const creationTime = orderData.timestamp.toMillis();
  const dispatchTime = orderData.dispatchedAt.toMillis();
  const deliveryTime = deliveredAt.getTime ? deliveredAt.getTime() : new Date(deliveredAt).getTime();

  // Calcular tiempos en minutos (asegurar mínimo 1 minuto)
  const reactionTime = Math.max(1, Math.floor((dispatchTime - creationTime) / 60000));
  const executionTime = Math.max(1, Math.floor((deliveryTime - dispatchTime) / 60000));
  const totalLeadTime = Math.max(1, Math.floor((deliveryTime - creationTime) / 60000));

  // Obtener parámetros base del pedido, con valores por defecto si no existen
  const stdTime = Math.max(1, parseInt(orderData.stdOpTime) || 10);
  const complexity = Math.max(1, Math.min(5, parseInt(orderData.complexityWeight) || 1));
  const targetLT = Math.max(1, parseInt(orderData.targetLeadTime) || 30);

  // Calcular métricas derivadas
  const taskEfficiency = Math.round((stdTime / executionTime) * 100);
  const loadPoints = complexity * (complexity >= 4 ? 2 : 1);
  const effortPoints = totalLeadTime <= targetLT ? Math.round(loadPoints * 1.5) : loadPoints;
  const isSuspicious = executionTime < (stdTime * 0.2);
  const onTime = totalLeadTime <= targetLT;

  return {
    reactionTime,
    executionTime,
    totalLeadTime,
    taskEfficiency,
    loadPoints,
    effortPoints,
    isSuspicious,
    onTime,
    complexityWeight: complexity,
    stdOpTime: stdTime,
    targetLeadTime: targetLT
  };
};

// ============ COMPONENTE LOGIN ============
const LoginScreen = ({ onLoginSuccess }) => {
  const [apellido, setApellido] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!apellido || !password) {
      setError('Complete todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const email = `${apellido.toLowerCase()}@tte.com`;
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err) {
      setError('Credenciales incorrectas');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700 p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Warehouse className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Acceso Almacén</h1>
          <p className="text-gray-400 text-sm mt-2">Ingrese sus credenciales</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-300 font-medium mb-2 block">Apellido</label>
            <input
              type="text"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Ej: Garcia"
              className="w-full bg-gray-900/50 border-2 border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 font-medium mb-2 block">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full bg-gray-900/50 border-2 border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-bold py-4 rounded-xl transition-all"
          >
            {loading ? 'Ingresando...' : 'INGRESAR'}
          </button>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          ¿Problemas para acceder? Contacte a TI
        </div>
      </motion.div>
    </div>
  );
};

// Function to check for existing active orders
const checkExistingOrder = async (cardId) => {
  try {
    const q = query(
      collection(db, 'active_orders'),
      where('cardId', '==', cardId)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { exists: false };
    }

    const active = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .find(o => o.status === 'PENDING' || o.status === 'IN_TRANSIT');

    if (!active) return { exists: false };

    return {
      exists: true,
      orderId: active.id,
      status: active.status,
      timestamp: active.timestamp,
      location: active.location,
      partNumber: active.partNumber,
      takenBy: active.takenBy || 'Sin asignar'
    };

  } catch (error) {
    console.error('❌ Error checking existing order:', error);
    return { exists: 'unknown', error: error.message };
  }
};


// ============ COMPONENTE: VISTA DE KPIs ============
// ============ COMPONENTE: VISTA DE KPIs MEJORADA ============
const KPIView = ({ currentUser }) => {
  const [kpiData, setKpiData] = useState({
    // Resumen Ejecutivo
    overallLeadTime: 0,
    slaSuccessRate: 0,
    deliveriesToday: 0,
    criticalDeliveries: 0,

    // Operativo: Ranking por Justicia Operativa
    operatorRanking: [],
    orders: [],
    // Analítico: Desglose de Tiempos
    avgReactionTime: 0,
    avgExecutionTime: 0,

    // Materiales
    topMaterials: [],
    problemMaterials: [],

    // Predictivo: Distribución Horaria
    hourlyHeatmap: [],

    // Integridad
    suspiciousRate: 0
  });

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today');
  const [heatmapMode, setHeatmapMode] = useState('volume'); // 'volume', 'leadTime', 'efficiency'
  const [selectedDay, setSelectedDay] = useState('all');
  const [heatmapData, setHeatmapData] = useState([]);
  // 1. Alertas Predictivas
  const predictiveAlerts = React.useMemo(() => {
    const alerts = [];
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    heatmapData.forEach(item => {
      if (item.leadTime > 30 && item.volume >= 2) {
        alerts.push({
          type: 'critical',
          title: `Lead Time Alto el ${dayNames[item.day]} a las ${item.hour}:00`,
          message: `${item.volume} pedidos con lead time promedio de ${item.leadTime} min (objetivo: 30 min)`,
          time: `${item.hour}:00`,
          location: 'Análisis histórico',
          confidence: Math.min(90, 60 + (item.volume * 10))
        });
      }
    });

    if (alerts.length === 0) {
      const highestLT = Math.max(...heatmapData.map(h => h.leadTime));
      const criticalHour = heatmapData.find(h => h.leadTime === highestLT);

      alerts.push({
        type: 'info',
        title: highestLT > 0 ? `Pico de ${highestLT}min el ${dayNames[criticalHour.day]} a las ${criticalHour.hour}:00` : 'Sin alertas críticas',
        message: highestLT > 0 ? 'Hora con mayor lead time registrado' : 'Todos los tiempos dentro del objetivo',
        time: 'Análisis',
        location: 'Todas las áreas',
        confidence: 85
      });
    }

    return alerts.slice(0, 2).sort((a, b) => b.confidence - a.confidence);
  }, [heatmapData]);
  // 2. Tendencia Semanal


  // 3. Comparativa de Operarios
  const operatorComparison = React.useMemo(() => {
    return kpiData.operatorRanking.map(op => ({
      name: op.name,
      role: 'Operario',
      score: op.effortPoints,
      speed: op.avgEfficiency,
      accuracy: op.integrityScore,
      peakHours: (() => {
        const hourCounts = {};
        kpiData.orders.filter(o => o.deliveredBy === op.name).forEach(order => {
          if (order.timestamp) {
            const hour = order.timestamp.toDate().getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          }
        });
        return Object.entries(hourCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([hour]) => parseInt(hour));
      })()
    }));
  }, [kpiData.operatorRanking]);
  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        setLoading(true);

        const now = new Date();
        let startDate = new Date();

        switch (timeRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
          case 'all':
            startDate = new Date(0);
            break;
        }

        const deliveredQuery = query(
          collection(db, 'completed_orders'),
          where('status', '==', 'DELIVERED'),
          where('deliveredAt', '>=', startDate)
        );

        const snapshot = await getDocs(deliveredQuery);
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (orders.length === 0) {
          setLoading(false);
          return;
        }

        // === DIMENSIÓN 1: DESEMPEÑO OPERATIVO ===

        // Lead Time Promedio
        const avgLT = Math.round(
          orders.reduce((sum, o) => sum + (o.totalLeadTime || 0), 0) / orders.length
        );

        // SLA Success Rate
        const onTimeCount = orders.filter(o => o.onTime).length;
        const slaSuccess = Math.round((onTimeCount / orders.length) * 100);

        // Entregas Críticas (Complejidad 4-5)
        const criticalCount = orders.filter(o =>
          (o.complexityWeight || 1) >= 4
        ).length;

        // === DIMENSIÓN 2: CARGA Y CAPACIDAD ===

        // Power Ranking por Puntos de Esfuerzo
        const operatorMap = {};
        orders.forEach(o => {
          const op = o.deliveredBy || 'Anónimo';
          if (!operatorMap[op]) {
            operatorMap[op] = {
              deliveries: 0,
              totalEffortPoints: 0,
              totalReaction: 0,
              totalExecution: 0,
              suspiciousCount: 0,
              efficiencySum: 0
            };
          }

          operatorMap[op].deliveries++;
          operatorMap[op].totalEffortPoints += (o.effortPoints || o.loadPoints || 1);
          operatorMap[op].totalReaction += (o.reactionTime || 0);
          operatorMap[op].totalExecution += (o.executionTime || 0);
          operatorMap[op].efficiencySum += (o.taskEfficiency || 100);
          if (o.isSuspicious) operatorMap[op].suspiciousCount++;
        });

        const operatorRanking = Object.entries(operatorMap)
          .map(([name, stats]) => ({
            name,
            deliveries: stats.deliveries,
            effortPoints: Math.round(stats.totalEffortPoints),
            avgReaction: Math.round(stats.totalReaction / stats.deliveries),
            avgExecution: Math.round(stats.totalExecution / stats.deliveries),
            avgEfficiency: Math.round(stats.efficiencySum / stats.deliveries),
            integrityScore: Math.round(
              ((stats.deliveries - stats.suspiciousCount) / stats.deliveries) * 100
            )
          }))
          .sort((a, b) => b.effortPoints - a.effortPoints);

        // === DIMENSIÓN 3: SERVICIO ===
        // Dentro del fetchKPIs, después de procesar los pedidos...

        // Procesar datos para heatmap semanal
        const hourlyAnalysis = {};
        orders.forEach(order => {
          if (order.timestamp) {
            const date = order.timestamp.toDate();
            const day = date.getDay(); // 0=domingo, 1=lunes...
            const hour = date.getHours();
            const key = `${day}-${hour}`;

            if (!hourlyAnalysis[key]) {
              hourlyAnalysis[key] = {
                day,
                hour,
                volume: 0,
                totalLeadTime: 0,
                totalEfficiency: 0,
                operators: new Set()
              };
            }

            hourlyAnalysis[key].volume++;
            hourlyAnalysis[key].totalLeadTime += (order.totalLeadTime || 0);
            hourlyAnalysis[key].totalEfficiency += (order.taskEfficiency || 100);
            if (order.deliveredBy) hourlyAnalysis[key].operators.add(order.deliveredBy);
          }
        });

        // Convertir a array y calcular promedios
        const processedHeatmapData = Object.values(hourlyAnalysis).map(item => ({
          day: item.day,
          hour: item.hour,
          volume: item.volume,
          leadTime: Math.round(item.totalLeadTime / item.volume),
          efficiency: Math.round(item.totalEfficiency / item.volume),
          operators: Array.from(item.operators).map(op => ({ name: op }))
        }));

        setHeatmapData(processedHeatmapData);
        // Tiempos Promedio Segmentados
        const avgReaction = Math.round(
          orders.reduce((sum, o) => sum + (o.reactionTime || 0), 0) / orders.length
        );
        const avgExecution = Math.round(
          orders.reduce((sum, o) => sum + (o.executionTime || 0), 0) / orders.length
        );

        // Top 5 Materiales Más Solicitados
        const materialMap = {};
        orders.forEach(o => {
          const materialKey = o.stockKey || o.partNumber || 'Desconocido';
          if (!materialMap[materialKey]) {
            materialMap[materialKey] = {
              count: 0,
              totalTime: 0,
              description: o.description || ''
            };
          }
          materialMap[materialKey].count++;
          materialMap[materialKey].totalTime += (o.totalLeadTime || 0);
        });

        const topMaterials = Object.entries(materialMap)
          .map(([materialKey, data]) => ({
            materialKey,
            description: data.description,
            frequency: data.count,
            avgLeadTime: Math.round(data.totalTime / data.count)
          }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 5);

        // Materiales Problemáticos (alto Lead Time)
        const problemMaterials = Object.entries(materialMap)
          .filter(([_, data]) => data.count >= 2)
          .map(([materialKey, data]) => ({
            materialKey,
            description: data.description,
            avgLeadTime: Math.round(data.totalTime / data.count)
          }))
          .sort((a, b) => b.avgLeadTime - a.avgLeadTime)
          .slice(0, 5);

        // === DIMENSIÓN 4: INTEGRIDAD DE DATOS ===

        const suspiciousCount = orders.filter(o => o.isSuspicious).length;
        const suspiciousRate = Math.round((suspiciousCount / orders.length) * 100);

        // === PREDICTIVO: HEATMAP HORARIO ===

        // === PREDICTIVO: HEATMAP HORARIO (por hora de CREACIÓN del pedido) ===

        const hourlyCreationMap = Array(24).fill(0).map(() => ({ count: 0, avgLeadTime: 0, totalTime: 0 }));

        orders.forEach(o => {
          if (o.timestamp) {
            const hour = o.timestamp.toDate().getHours();
            hourlyCreationMap[hour].count++;
            hourlyCreationMap[hour].totalTime += (o.totalLeadTime || 0);
          }
        });

        // Calcular promedio de lead time por hora
        hourlyCreationMap.forEach(h => {
          h.avgLeadTime = h.count > 0 ? Math.round(h.totalTime / h.count) : 0;
        });

        setKpiData({
          overallLeadTime: avgLT,
          slaSuccessRate: slaSuccess,
          deliveriesToday: orders.length,
          criticalDeliveries: criticalCount,
          operatorRanking,
          avgReactionTime: avgReaction,
          avgExecutionTime: avgExecution,
          topMaterials,
          problemMaterials,

          hourlyHeatmap: hourlyCreationMap.map(h => h.count),

          suspiciousRate,
          hourlyLeadTimes: hourlyCreationMap.map(h => h.avgLeadTime),
          orders: orders
        });

      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
    const interval = setInterval(fetchKPIs, 120000); // Cada 2 minutos
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }
  // Dentro del componente KPIView, antes del return, calculamos los datos reales

  // 1. Alertas Predictivas (ejemplo simple)

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Supply Chain 4.0 Analytics</h1>
          <p className="text-gray-400 mt-1">Dashboard de KPIs Avanzados</p>
        </div>
        <div className="flex gap-2 bg-gray-800/50 rounded-xl p-1">
          {['today', 'week', 'month', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${timeRange === range
                ? 'bg-blue-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
              {range === 'today' ? 'Hoy' : range === 'week' ? 'Semana' : range === 'month' ? 'Mes' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* === NIVEL EJECUTIVO === */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-2 border-blue-500/30 rounded-2xl p-6">
          <Clock className="w-10 h-10 text-blue-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Lead Time Total</p>
          <p className="text-4xl font-black text-white">{kpiData.overallLeadTime}<span className="text-lg text-gray-400">min</span></p>
          <p className="text-xs text-blue-300 mt-2">Promedio extremo a extremo</p>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-2 border-green-500/30 rounded-2xl p-6">
          <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Cumplimiento SLA</p>
          <p className="text-4xl font-black text-white">{kpiData.slaSuccessRate}<span className="text-lg text-gray-400">%</span></p>
          <p className="text-xs text-green-300 mt-2">Entregas a tiempo</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-2 border-purple-500/30 rounded-2xl p-6">
          <Package className="w-10 h-10 text-purple-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Entregas Totales</p>
          <p className="text-4xl font-black text-white">{kpiData.deliveriesToday}</p>
          <p className="text-xs text-purple-300 mt-2">En el período</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border-2 border-orange-500/30 rounded-2xl p-6">
          <AlertTriangle className="w-10 h-10 text-orange-400 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Entregas Críticas</p>
          <p className="text-4xl font-black text-white">{kpiData.criticalDeliveries}</p>
          <p className="text-xs text-orange-300 mt-2">Complejidad Nivel 4-5</p>
        </div>
      </div>

      {/* === NIVEL OPERATIVO + ANALÍTICO === */}
      <div className="grid grid-cols-3 gap-6">
        {/* Ranking de Operarios (Justicia Operativa) */}
        <div className="col-span-2 bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
            <Award className="w-7 h-7 text-yellow-400" />
            Power Ranking • Justicia Operativa
          </h2>
          <div className="space-y-4">
            {kpiData.operatorRanking.map((op, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded-xl p-5 border border-gray-700 hover:border-gray-600 transition-all">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl ${idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                      idx === 1 ? 'bg-gray-400/20 text-gray-300' :
                        idx === 2 ? 'bg-orange-600/20 text-orange-400' :
                          'bg-gray-700 text-gray-400'
                      }`}>
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xl font-bold text-white capitalize">{op.name}</p>
                      <p className="text-xs text-gray-500 uppercase">{op.deliveries} entregas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-orange-400">{op.effortPoints}</p>
                    <p className="text-xs text-gray-500 uppercase">Puntos de Carga</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-4">
                  {/* Reacción */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">Reacción</p>
                    <p className={`text-lg font-bold ${op.avgReaction > 10 ? 'text-red-400' : 'text-green-400'}`}>
                      {op.avgReaction}m
                    </p>
                  </div>

                  {/* Ejecución */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">Ejecución</p>
                    <p className="text-lg font-bold text-blue-400">{op.avgExecution}m</p>
                  </div>

                  {/* Eficiencia */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">Eficiencia</p>
                    <p className={`text-lg font-bold ${op.avgEfficiency >= 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                      72%
                    </p>
                  </div>

                  {/* Integridad */}
                  <div className="bg-gray-900/50 rounded-lg p-3">
                    <p className="text-[10px] text-gray-400 uppercase mb-1">Integridad</p>
                    <p className={`text-lg font-bold ${op.integrityScore < 90 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {op.integrityScore}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desglose de Tiempos */}
        <div className="space-y-6">
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-purple-400" />
              Desglose de Tiempos
            </h2>
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2">Tiempo de Reacción</p>
                <p className="text-3xl font-bold text-purple-400">{kpiData.avgReactionTime}min</p>
                <p className="text-xs text-gray-500 mt-1">Desde creación a aceptación</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-2">Tiempo de Ejecución</p>
                <p className="text-3xl font-bold text-blue-400">{kpiData.avgExecutionTime}min</p>
                <p className="text-xs text-gray-500 mt-1">Desde aceptación a entrega</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/30">
                <p className="text-xs text-gray-400 mb-2">Lead Time Total</p>
                <p className="text-3xl font-bold text-green-400">{kpiData.overallLeadTime}min</p>
                <p className="text-xs text-gray-500 mt-1">Promedio global</p>
              </div>
            </div>
          </div>

          {/* Integridad de Proceso */}
          <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-6 h-6 text-red-400" />
              Integridad de Datos
            </h2>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Pedidos Sospechosos</p>
              <p className={`text-4xl font-bold ${kpiData.suspiciousRate > 10 ? 'text-red-400' : 'text-green-400'}`}>
                {kpiData.suspiciousRate}%
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Entregas &lt; 20% del tiempo estándar
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* === INTELIGENCIA OPERATIVA - PANEL 4D === */}
      <div className="space-y-6">
        {/* HEADER CON FILTROS AVANZADOS */}
        <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-blue-400" />
                Inteligencia Operativa 4D
              </h2>
              <p className="text-gray-400 text-sm mt-1">Heatmap predictivo + Análisis de tendencias</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={heatmapMode}
                onChange={(e) => setHeatmapMode(e.target.value)}
              >
                <option value="volume">📊 Volumen de Pedidos</option>
                <option value="leadTime">⏱️ Lead Time Promedio</option>
                <option value="efficiency">⚡ Eficiencia Operativa</option>
              </select>

              <select
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                <option value="all">Toda la semana</option>
                <option value="0">Lunes</option>
                <option value="1">Martes</option>
                <option value="2">Miércoles</option>
                <option value="3">Jueves</option>
                <option value="4">Viernes</option>
              </select>
            </div>
          </div>
        </div>

        {/* GRID PRINCIPAL 2x2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* COLUMNA IZQUIERDA: HEATMAP MEJORADO + ALERTAS PREDICTIVAS */}
          <div className="space-y-6">

            {/* HEATMAP MEJORADO */}
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  {heatmapMode === 'volume' ? '🌡️ Densidad Horaria' :
                    heatmapMode === 'leadTime' ? '⏱️ Tiempos por Hora' :
                      '⚡ Eficiencia por Hora'}
                </h3>
                <div className="text-sm text-gray-400">
                  {selectedDay === 'all' ? 'Semana completa' : `Día ${parseInt(selectedDay) + 1}`}
                </div>
              </div>

              {/* HEATMAP VISUAL MEJORADO */}
              <div className="mb-6">
                <div className="grid grid-cols-12 gap-1.5 mb-3">
                  {/* Horas en header */}
                  <div className="col-span-2"></div>
                  {Array.from({ length: 12 }, (_, i) => i + 8).map(hour => (
                    <div key={hour} className="text-center">
                      <span className="text-xs text-gray-400 font-mono">{hour}h</span>
                    </div>
                  ))}
                </div>

                {/* Filas del heatmap */}
                <div className="space-y-1.5">
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((day, dayIndex) => {
                    const dayNumber = dayIndex + 1; // 1 = lunes, 5 = viernes

                    // ... resto del código s

                    <div key={day} className="grid grid-cols-12 gap-1.5 items-center">
                      {/* Día */}
                      <div className="col-span-2">
                        <div className={`px-3 py-2 rounded-lg ${selectedDay === dayIndex.toString() ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-gray-800/50'}`}>
                          <span className="text-sm font-medium text-white">{day}</span>
                        </div>
                      </div>

                      {/* Celdas del heatmap */}
                      {Array.from({ length: 12 }, (_, hourIndex) => {
                        const hour = hourIndex + 8;
                        const dayData = heatmapData.find(d => d.day === dayIndex && d.hour === hour);
                        let value = dayData ? dayData[heatmapMode] : 0;

                        // Escalar según el modo
                        let intensity = 0;
                        if (heatmapMode === 'volume') {
                          const maxVolume = Math.max(...heatmapData.map(d => d.volume));
                          intensity = maxVolume > 0 ? value / maxVolume : 0;
                        } else if (heatmapMode === 'leadTime') {
                          intensity = Math.min(value / 60, 1); // Máximo 60 minutos
                        } else {
                          intensity = value / 100; // Eficiencia como porcentaje
                        }

                        // Color basado en intensidad y modo
                        let bgColor = 'bg-gray-800';
                        let borderColor = 'border-gray-700';
                        let textColor = 'text-gray-400';

                        if (intensity > 0) {
                          if (heatmapMode === 'volume') {
                            // Verde para volumen (más oscuro = más volumen)
                            const greenIntensity = Math.min(100 + Math.floor(intensity * 155), 255);
                            bgColor = `bg-green-900/70`;
                            borderColor = 'border-green-600/40';
                            textColor = 'text-green-300';
                          } else if (heatmapMode === 'leadTime') {
                            // Rojo para tiempos altos
                            const redIntensity = Math.min(100 + Math.floor(intensity * 155), 255);
                            bgColor = `bg-red-900/70`;
                            borderColor = intensity > 0.7 ? 'border-red-500/60' : 'border-red-600/30';
                            textColor = intensity > 0.7 ? 'text-red-300' : 'text-red-400';
                          } else {
                            // Azul para eficiencia
                            const blueIntensity = Math.min(100 + Math.floor(intensity * 155), 255);
                            bgColor = `bg-blue-900/70`;
                            borderColor = 'border-blue-600/40';
                            textColor = 'text-blue-300';
                          }
                        }

                        // Determinar si es hora crítica
                        // En la sección del heatmap, ajusta el cálculo de isCritical:
                        const isCritical = heatmapMode === 'leadTime' && value > 30; // Más de 30 minutos es crítico


                        return (
                          <div
                            key={`${day}-${hour}`}
                            className={`relative group ${bgColor} border ${borderColor} rounded-lg p-3 transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${isCritical ? 'animate-pulse' : ''}`}
                          >
                            {/* Valor */}
                            <div className="text-center">
                              <div className={`text-sm font-bold ${textColor} mb-1`}>
                                {heatmapMode === 'volume' ? value :
                                  heatmapMode === 'leadTime' ? `${Math.round(value)}m` :
                                    `${Math.round(value)}%`}
                              </div>
                              <div className="text-xs text-gray-500">
                                {hour}:00
                              </div>
                            </div>

                            {/* Tooltip avanzado */}
                            <div className="absolute z-50 invisible group-hover:visible bottom-full left-1/2 -translate-x-1/2 mb-2 w-48">
                              <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-2xl">
                                <p className="font-bold text-white mb-2">{day} {hour}:00</p>
                                <div className="space-y-2 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Pedidos: </span>
                                    <span className="text-green-300 font-bold">{dayData?.volume || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Lead Time:</span>
                                    <span className={`font-bold ${dayData?.leadTime > 30 ? 'text-red-300' : 'text-blue-300'}`}>
                                      {dayData?.leadTime || 0}m
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-400">Eficiencia:</span>
                                    <span className="text-yellow-300 font-bold">72%</span>
                                  </div>
                                  {dayData?.operators && (
                                    <div className="pt-2 border-t border-gray-800">
                                      <p className="text-gray-400 mb-1">Operarios activos:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {dayData.operators.slice(0, 3).map((op, idx) => (
                                          <span key={idx} className="px-2 py-1 bg-gray-800 rounded text-xs">
                                            {op.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  })}
                </div>
              </div>

              {/* LEYENDA INTERACTIVA */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gradient-to-r from-green-900/70 to-green-600/70"></div>
                    <span className="text-gray-400">Volumen bajo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-gradient-to-r from-green-600/70 to-green-400/70"></div>
                    <span className="text-gray-400">Volumen alto</span>
                  </div>
                  {heatmapMode === 'leadTime' && (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-600/70 animate-pulse"></div>
                      <span className="text-red-300 font-bold">¡CRÍTICO! &gt; 42m</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ALERTAS PREDICTIVAS */}
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 backdrop-blur-sm rounded-2xl border border-orange-500/30 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
                Alertas Predictivas
              </h3>

              <div className="space-y-4">
                {predictiveAlerts.map((alert, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border ${alert.type === 'critical' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                    <div className="flex items-start gap-3">
                      {alert.type === 'critical' ? (
                        <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Info className="w-5 h-5 text-yellow-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className={`font-bold ${alert.type === 'critical' ? 'text-red-300' : 'text-yellow-300'}`}>
                          {alert.title}
                        </p>
                        <p className="text-sm text-gray-300 mt-1">{alert.message}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <span className="text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {alert.time}
                          </span>
                          <span className="text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {alert.location}
                          </span>
                          <span className="text-gray-400 flex items-center gap-1">
                            <Activity className="w-3 h-3" />
                            {alert.confidence}% confianza
                          </span>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-gray-800/50 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors">
                        Acción
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: rMANAL + COMPARATIVA DE OPERARIOS */}

        </div>
      </div>
      {/* === ANÁLISIS DE VARIABILIDAD === */}
      <div className="grid grid-cols-2 gap-6">
        {/* Distribución de Lead Times */}
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-400" />
            Distribución de Lead Times
          </h2>
          <div className="space-y-4">
            {(() => {
              const leadTimes = kpiData.orders.map(o => o.totalLeadTime || 0);
              const ranges = [
                { label: '< 15min', count: leadTimes.filter(t => t < 15).length, color: 'green' },
                { label: '15-30min', count: leadTimes.filter(t => t >= 15 && t < 30).length, color: 'blue' },
                { label: '30-45min', count: leadTimes.filter(t => t >= 30 && t < 45).length, color: 'yellow' },
                { label: '> 45min', count: leadTimes.filter(t => t >= 45).length, color: 'red' }
              ];
              const maxCount = Math.max(...ranges.map(r => r.count));

              return ranges.map((range, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">{range.label}</span>
                    <span className="text-white font-bold">{range.count} pedidos</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${range.color === 'green' ? 'bg-green-500' :
                        range.color === 'blue' ? 'bg-blue-500' :
                          range.color === 'yellow' ? 'bg-yellow-500' :
                            'bg-red-500'
                        }`}
                      style={{ width: `${maxCount > 0 ? (range.count / maxCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Tasa de Utilización por Ubicación */}
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-400" />
            Demanda por Ubicación
          </h2>
          <div className="space-y-3">
            {(() => {
              const locationMap = {};
              kpiData.orders.forEach(o => {
                const loc = o.location || 'Desconocido';
                if (!locationMap[loc]) {
                  locationMap[loc] = { count: 0, avgLT: 0, totalLT: 0 };
                }
                locationMap[loc].count++;
                locationMap[loc].totalLT += (o.totalLeadTime || 0);
              });

              return Object.entries(locationMap)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([loc, data]) => {
                  data.avgLT = Math.round(data.totalLT / data.count);
                  return (
                    <div key={loc} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-bold text-white">{loc}</p>
                          <p className="text-xs text-gray-400">{data.avgLT}min promedio</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-400">{data.count}</p>
                        <p className="text-xs text-gray-500">pedidos</p>
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      </div>
      {/* Top Materiales y Problemáticos */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Package className="w-6 h-6 text-green-400" />
            Top 5 Materiales
          </h2>
          <div className="space-y-3">
            {kpiData.topMaterials.map((mat, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <span className="font-bold text-green-400">#{idx + 1}</span>
                  </div>
                  <div>
                    <p className="font-mono font-bold text-white text-sm">{mat.materialKey}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{mat.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">{mat.frequency}</p>
                  <p className="text-xs text-gray-500">{mat.avgLeadTime}min avg</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-2xl border border-red-800/50 p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            Materiales Problemáticos
          </h2>
          <div className="space-y-3">
            {kpiData.problemMaterials.map((mat, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4 border border-red-500/20">
                <div>
                  <p className="font-mono font-bold text-white text-sm">{mat.materialKey}</p>
                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{mat.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-red-400">{mat.avgLeadTime}min</p>
                  <p className="text-xs text-gray-500">promedio</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
const StatsOverview = () => {
  const [stats, setStats] = useState({ avgLeadTime: 0, slaRate: 0, deliveredToday: 0, pendingCount: 0, inTransitCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [compSnap, actSnap] = await Promise.all([
          getDocs(query(collection(db, 'completed_orders'), where('deliveredAt', '>=', today))),
          getDocs(query(collection(db, 'active_orders')))
        ]);

        const completed = compSnap.docs.map(d => d.data());
        const active = actSnap.docs.map(d => d.data());

        // Usamos los campos numéricos de tu Firebase
        const avgLT = completed.length > 0
          ? Math.round(completed.reduce((a, b) => a + (b.totalLeadTime || 0), 0) / completed.length)
          : 0;

        const sla = completed.length > 0
          ? Math.round((completed.filter(o => o.onTime).length / completed.length) * 100)
          : 0;

        setStats({
          avgLeadTime: avgLT,
          slaRate: sla,
          deliveredToday: completed.length,
          pendingCount: active.filter(o => o.status === 'PENDING').length,
          inTransitCount: active.filter(o => o.status === 'IN_TRANSIT').length
        });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="grid grid-cols-4 gap-4 mb-6 animate-pulse">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-800 rounded-xl" />)}</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <StatCard icon={<Clock />} label="Lead Time Promedio" value={`${stats.avgLeadTime}min`} color="blue" />
      <StatCard icon={<CheckCircle />} label="Entregados Hoy" value={stats.deliveredToday} color="green" />
      <StatCard icon={<Activity />} label="Cumplimiento SLA" value={`${stats.slaRate}%`} color="yellow" />
      <StatCard icon={<Truck />} label="En Proceso" value={stats.pendingCount + stats.inTransitCount} color="purple" />
    </div>
  );
};
// ============ OPERATOR VIEW (MOBILE) ============
// Component: Operator View (Mobile)
const OperatorView = ({ currentUser, onLogout, onOpenLogin }) => {
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [existingOrderInfo, setExistingOrderInfo] = useState(null);

  // AUTO-SUBMIT FROM URL PARAMETER - ESCANEO AUTOMÁTICO
  useEffect(() => {
    if (autoSubmitted) return;

    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');

    if (idFromUrl) {
      const scannedId = idFromUrl.toUpperCase();
      setAutoSubmitted(true);

      // Procesar el escaneo inmediatamente
      setTimeout(() => {
        handleScan(scannedId);
      }, 300); // Pequeño delay para mejor UX
    }
  }, [autoSubmitted]);

  const clearFeedback = () => {
    setFeedback(null);
    setExistingOrderInfo(null);
  };

  const handleScan = async (scannedId) => {
    if (!scannedId || scanning) return;

    setScanning(true);
    setFeedback(null);
    setExistingOrderInfo(null);

    try {
      // 1. Verificar tarjeta
      const cardRef = doc(db, 'kanban_cards', scannedId);
      const cardSnap = await getDoc(cardRef);

      if (!cardSnap.exists()) {
        setFeedback({
          type: 'error',
          message: '✗ ERROR\nTarjeta NO REGISTRADA'
        });
        setScanning(false);
        return;
      }

      const card = cardSnap.data();

      // 2. Buscar pedido existente
      const existingOrder = await checkExistingOrder(scannedId);

      // ========== CASO A: SIN LOGIN (PRODUCCIÓN) ==========
      if (!currentUser) {
        // Si ya hay pedido activo
        // 🔥 Si hay pedido activo → NO crear
        if (existingOrder.exists === true) {
          const minutosEspera = Math.floor(
            (Date.now() - existingOrder.timestamp.toMillis()) / 60000
          );

          setFeedback({
            type: 'info',
            message:
              existingOrder.status === 'PENDING'
                ? `ℹ️ MATERIAL YA SOLICITADO\n⏳ Pendiente de retiro\n📍 ${existingOrder.location}\n⏱️ ${minutosEspera} min`
                : `ℹ️ MATERIAL EN CAMINO\n🚚 Retirado por almacén\n📍 ${existingOrder.location}`
          });

          setScanning(false);
          return;
        }

        // 🔥 Si NO pude verificar → NO crear
        // 🔥 Estado desconocido → abortar
        if (existingOrder.exists === 'unknown') {
          setFeedback({
            type: 'error',
            message: '⚠️ NO SE PUDO VALIDAR EL ESTADO\nEspere unos segundos y reintente'
          });
          setScanning(false);
          return;
        }

        // ✅ Estado VALIDADO: no existe pedido → crear
        if (existingOrder.exists === false) {
          await addDoc(collection(db, 'active_orders'), {
            ...buildOrderPayloadFromCard(card, scannedId),
            status: 'PENDING',
            requestedBy: 'Produccion',
            createdAt: serverTimestamp(),
            timestamp: serverTimestamp()
          });

          setFeedback({
            type: 'success',
            message: `✓ PEDIDO CREADO
📦 ${getMaterialDisplayName(card)}
📍 ${card.zona || 'S/Z'} • ${card.location || 'S/U'}
⏱️ El almacén será notificado`
          });

          setScanning(false);
          return;
        }
      }

      // ========== CASO B: CON LOGIN (ALMACÉN) ==========
      // ========== CASO B: CON LOGIN (ALMACÉN) ==========
      else {
        const userName = currentUser.email.split('@')[0];

        // Si hay pedido EN TRÁNSITO → ENTREGA DIRECTA
        if (existingOrder.exists && existingOrder.status === 'IN_TRANSIT') {
          try {
            console.log('📦 Cerrando pedido desde OperatorView (QR)...');

            const orderRef = doc(db, 'active_orders', existingOrder.orderId);

            // 🔥 OBTENER EL DOCUMENTO COMPLETO (no solo lo que retorna checkExistingOrder)
            const orderSnap = await getDoc(orderRef);

            if (!orderSnap.exists()) {
              console.error('❌ Pedido no encontrado en active_orders');
              setFeedback({
                type: 'error',
                message: '⚠️ ERROR\nEl pedido ya no existe en el sistema'
              });
              setScanning(false);
              return;
            }

            const fullOrderData = orderSnap.data();
            console.log('📋 Datos completos del pedido:', {
              cardId: fullOrderData.cardId,
              hasTimestamp: !!fullOrderData.timestamp,
              hasDispatchedAt: !!fullOrderData.dispatchedAt
            });

            // Validar que tenga los timestamps necesarios
            if (!fullOrderData.timestamp || !fullOrderData.dispatchedAt) {
              console.error('❌ Faltan timestamps en el pedido');
              setFeedback({
                type: 'error',
                message: '⚠️ ERROR\nEl pedido no tiene los datos completos.\nContacte al supervisor.'
              });
              setScanning(false);
              return;
            }

            // 🔥 CALCULAR MÉTRICAS CON EL OBJETO COMPLETO
            const metrics = calculateOrderMetrics(fullOrderData, new Date());

            console.log('⏱️ Métricas calculadas:', {
              reactionTime: metrics.reactionTime,
              executionTime: metrics.executionTime,
              totalLeadTime: metrics.totalLeadTime
            });

            // 1. GUARDAR EN COMPLETED_ORDERS
            await addDoc(collection(db, 'completed_orders'), {
              // Datos básicos del pedido
              cardId: fullOrderData.cardId,
              stockKey: fullOrderData.stockKey || '',
              partNumber: fullOrderData.partNumber,
              versionCode: fullOrderData.versionCode || '',
              description: fullOrderData.description,
              typeUnits: fullOrderData.typeUnits || '',
              zona: fullOrderData.zona || '',
              location: fullOrderData.location,
              rackCode: fullOrderData.rackCode || '',
              zoneCode: fullOrderData.zoneCode || '',
              standardPack: fullOrderData.standardPack,
              totalBins: fullOrderData.totalBins || 0,
              requestedBy: fullOrderData.requestedBy,
              takenBy: fullOrderData.takenBy,

              // Estado y quién lo entregó
              status: 'DELIVERED',
              deliveredAt: serverTimestamp(),
              deliveredBy: userName,

              // Timestamps originales
              timestamp: fullOrderData.timestamp,
              dispatchedAt: fullOrderData.dispatchedAt,

              // 🔥 TODAS LAS MÉTRICAS CALCULADAS
              ...metrics
            });

            console.log('✅ Pedido guardado en completed_orders');

            // 2. ELIMINAR DE ACTIVOS
            await deleteDoc(orderRef);
            console.log('✅ Pedido eliminado de active_orders');

            setFeedback({
              type: 'success',
              message: `✅ ENTREGA FINALIZADA\n📦 ${getMaterialDisplayName(fullOrderData)}\n📍 ${fullOrderData.zona || 'S/Z'} • ${fullOrderData.location || 'S/U'}\n👤 Por: ${userName}\n⏱️ Tiempo total: ${metrics.totalLeadTime} min`
            });

          } catch (error) {
            console.error('❌ Error al cerrar pedido:', error);
            setFeedback({
              type: 'error',
              message: `✗ ERROR AL CERRAR PEDIDO\n${error.message}`
            });
          }

          setScanning(false);
          return;
        }

        // Si hay pedido PENDIENTE → Aviso
        if (existingOrder.exists && existingOrder.status === 'PENDING') {
          setFeedback({
            type: 'info',
            message: `ℹ️ PEDIDO PENDIENTE\n👉 Marca como "En Tránsito" en el Dashboard antes de salir`
          });
          setScanning(false);
          return;
        }

        // No hay pedido activo
        setFeedback({
          type: 'error',
          message: `⚠️ NO HAY PEDIDO ACTIVO\nSolo producción puede crear pedidos`
        });
      }

    } catch (error) {
      console.error('❌ Error real:', error);

      setFeedback({
        type: 'error',
        message: `✗ ERROR\n${error.code || ''}\n${error.message || 'Error desconocido'}`
      });
    }

    setScanning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950">
      {/* Industrial Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Factory className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">TTE E-KANBAN</h1>
                <p className="text-xs text-gray-400">Bobinado • Punto de Consumo</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1 rounded-lg">
                    <User className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-blue-300 font-medium">
                      {currentUser.email.split('@')[0].toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-colors group"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                  </button>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400 font-medium">PRODUCCIÓN</span>
                  <button
                    onClick={onOpenLogin}
                    className="ml-2 p-2 bg-gray-800/50 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Acceso almacén"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-md mx-auto px-6 py-8">
        {/* Icono de QR centrado */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-3xl mb-6 border-2 border-blue-500/20">
            {scanning ? (
              <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            ) : (
              <Camera className="w-20 h-20 text-blue-400" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Escaneo Automático</h2>
          <p className="text-gray-400 text-sm">El QR se procesa automáticamente</p>
        </motion.div>

        {/* Feedback Principal (ocupa toda la pantalla) */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-8"
            >
              <div className={`rounded-2xl border-2 p-8 text-center ${feedback.type === 'success'
                ? 'bg-green-500/10 border-green-500/30'
                : feedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
                }`}>

                <div className="mb-6">
                  {feedback.type === 'success' && (
                    <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-16 h-16 text-green-400" />
                    </div>
                  )}
                  {feedback.type === 'error' && (
                    <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertTriangle className="w-16 h-16 text-red-400" />
                    </div>
                  )}
                  {feedback.type === 'info' && (
                    <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Info className="w-16 h-16 text-blue-400" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <p className="text-2xl font-bold text-white">
                    {feedback.type === 'success' ? '✓ LISTO' :
                      feedback.type === 'error' ? '✗ ERROR' :
                        'ℹ️ INFORMACIÓN'}
                  </p>
                  <p className="text-lg text-gray-300 whitespace-pre-line leading-relaxed">
                    {feedback.message}
                  </p>
                </div>

                {/* Botón para limpiar (solo visible después de 3 segundos) */}
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2 }}
                  onClick={clearFeedback}
                  className="mt-8 px-6 py-3 bg-gray-800/50 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors border border-gray-700 flex items-center justify-center gap-2 mx-auto"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Listo para nuevo escaneo</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Estado cuando no hay feedback */}
        {!feedback && !scanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Package className="w-10 h-10 text-gray-500" />
            </div>
            <p className="text-gray-400 text-xl font-medium">Esperando escaneo...</p>
            <p className="text-gray-500 text-sm mt-2">Apunte el código QR a la cámara</p>
          </motion.div>
        )}
      </div>
    </div>
  );
};
// ============ COMPONENTE: BUSCADOR DE MATERIALES ============
// ============ COMPONENTE: BUSCADOR DE MATERIALES MEJORADO ============
const MaterialSearchView = ({ userRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [createForm, setCreateForm] = useState({
    stockKey: '', partNumber: '', versionCode: '', description: '', typeUnits: '', standardPack: '', complexityWeight: 1, stdOpTime: 10, targetLeadTime: 30, totalBins: 0,
    locations: [{ zoneCode: '', zona: '', rackCode: '', location: '', coordX: '', coordY: '' }]
  });

  const loadMaterials = async () => {
    const materialsSnap = await getDocs(collection(db, 'materials'));
    const materials = materialsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setAllMaterials(materials);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await loadMaterials();
        const saved = localStorage.getItem('recentSearches');
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch (error) {
        console.error('Error cargando materiales:', error);
      }
    };
    init();
  }, []);

  const handleInputChange = (value) => {
    setSearchTerm(value);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const searchLower = value.toLowerCase();
    const matches = allMaterials.filter(mat => (
      mat.stockKey?.toLowerCase().includes(searchLower)
      || mat.partNumber?.toLowerCase().includes(searchLower)
      || mat.description?.toLowerCase().includes(searchLower)
    )).slice(0, 8);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const saveToRecent = (material) => {
    const key = material.stockKey || material.partNumber;
    const newSearch = { key, stockKey: material.stockKey || '', partNumber: material.partNumber || '', description: material.description || '', timestamp: Date.now() };
    const updated = [newSearch, ...recentSearches.filter(s => s.key !== key)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleSearch = async (searchValue = searchTerm) => {
    if (!searchValue.trim()) return;
    setLoading(true);
    setSearchResult(null);
    setHistoricalData(null);
    setShowSuggestions(false);

    try {
      const term = searchValue.trim();
      let materialDoc = null;
      const byId = await getDoc(doc(db, 'materials', term.toUpperCase()));
      if (byId.exists()) {
        materialDoc = { id: byId.id, ...byId.data() };
      } else {
        const found = allMaterials.find(mat =>
          (mat.stockKey || '').toLowerCase() === term.toLowerCase()
          || (mat.partNumber || '').toLowerCase() === term.toLowerCase()
          || (mat.description || '').toLowerCase() === term.toLowerCase()
        ) || allMaterials.find(mat =>
          (mat.stockKey || '').toLowerCase().includes(term.toLowerCase())
          || (mat.partNumber || '').toLowerCase().includes(term.toLowerCase())
          || (mat.description || '').toLowerCase().includes(term.toLowerCase())
        );
        if (found) materialDoc = found;
      }

      if (!materialDoc) {
        setSearchResult({ notFound: true });
        setLoading(false);
        return;
      }

      const cardsSnap = await getDocs(query(collection(db, 'kanban_cards'), where('stockKey', '==', materialDoc.stockKey || materialDoc.id)));
      const cards = cardsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setSearchResult({ ...materialDoc, cards });
      saveToRecent(materialDoc);

      const historyQuery = query(collection(db, 'completed_orders'), where('stockKey', '==', materialDoc.stockKey || materialDoc.id));
      const historySnap = await getDocs(historyQuery);
      const orders = historySnap.docs.map(d => d.data());
      const avgLeadTime = orders.length ? Math.round(orders.reduce((sum, o) => sum + (o.totalLeadTime || 0), 0) / orders.length) : 0;
      setHistoricalData({
        totalOrders: historySnap.size,
        avgLeadTime,
        lastOrderDate: orders.length > 0 && orders[0].deliveredAt ? orders[0].deliveredAt.toDate().toLocaleDateString('es-AR') : 'N/A'
      });
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setSearchResult({ error: true });
    }
    setLoading(false);
  };

  const handleEdit = () => {
    setEditData({
      stdOpTime: searchResult.stdOpTime || 10,
      complexityWeight: searchResult.complexityWeight || 1,
      targetLeadTime: searchResult.targetLeadTime || 30,
      standardPack: searchResult.standardPack || '1'
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    try {
      const materialRef = doc(db, 'materials', searchResult.stockKey);
      await updateDoc(materialRef, {
        stdOpTime: parseInt(editData.stdOpTime),
        complexityWeight: parseInt(editData.complexityWeight),
        targetLeadTime: parseInt(editData.targetLeadTime),
        standardPack: editData.standardPack
      });
      alert('✅ Material actualizado correctamente');
      setShowEditModal(false);
      await loadMaterials();
      handleSearch(searchResult.stockKey);
    } catch (error) {
      console.error('Error al actualizar:', error);
      alert('❌ Error al guardar cambios');
    }
  };

  const updateLocation = (index, field, value) => {
    const next = [...createForm.locations];
    next[index] = { ...next[index], [field]: value };
    setCreateForm({ ...createForm, locations: next });
  };

  const addLocationRow = () => {
    setCreateForm({ ...createForm, locations: [...createForm.locations, { zoneCode: '', zona: '', rackCode: '', location: '', coordX: '', coordY: '' }] });
  };

  const saveNewMaterial = async () => {
    try {
      if (!createForm.stockKey.trim()) return alert('stockKey es obligatorio');
      if (createForm.locations.length < 1) return alert('Debe cargar al menos una ubicación');

      const dupKey = new Set();
      for (const row of createForm.locations) {
        if (!row.zoneCode || !row.rackCode || !row.zona || !row.location) return alert('Complete zoneCode, zona, rackCode y location en cada tarjeta');
        const key = `${row.zoneCode}__${row.rackCode}`;
        if (dupKey.has(key)) return alert('No se permiten tarjetas duplicadas para zoneCode + rackCode');
        dupKey.add(key);
      }

      const stockKey = createForm.stockKey.trim().toUpperCase();
      const { locations, ...materialData } = createForm;
      await setDoc(doc(db, 'materials', stockKey), { ...materialData, stockKey, active: true }, { merge: true });

      for (const row of createForm.locations) {
        const cardId = `${stockKey}__${row.zoneCode}__${row.rackCode}`;
        await setDoc(doc(db, 'kanban_cards', cardId), {
          cardId,
          stockKey,
          partNumber: createForm.partNumber || '',
          versionCode: createForm.versionCode || '',
          description: createForm.description || '',
          typeUnits: createForm.typeUnits || '',
          standardPack: createForm.standardPack || '',
          avgQty: createForm.avgQty || '',
          complexityWeight: parseInt(createForm.complexityWeight) || 1,
          stdOpTime: parseInt(createForm.stdOpTime) || 10,
          targetLeadTime: parseInt(createForm.targetLeadTime) || 30,
          totalBins: parseInt(createForm.totalBins) || 0,
          active: true,
          zoneCode: row.zoneCode,
          zona: row.zona,
          rackCode: row.rackCode,
          location: row.location,
          coordX: row.coordX,
          coordY: row.coordY,
          rackCoord: `${row.coordX || ''},${row.coordY || ''}`
        }, { merge: true });
      }

      alert('✅ Material y tarjetas guardados');
      setShowCreateModal(false);
      await loadMaterials();
    } catch (error) {
      console.error('Error al guardar material:', error);
      alert('❌ No se pudo guardar el material');
    }
  };

  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-white">🔍 Buscador de Materiales</h1>
        <p className="text-gray-400 mt-1">Busca por stockKey, Part Number o Descripción</p>
      </div>
      {userRole === 'ADMIN' && <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-white">+ Alta material</button>}
    </div>

    <div className="relative">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input type="text" value={searchTerm} onChange={(e) => handleInputChange(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} onFocus={() => searchTerm.length >= 2 && setShowSuggestions(true)} placeholder="Ej: 05005631013-0" className="w-full bg-gray-900/50 border-2 border-gray-700 rounded-xl px-6 py-4 text-white text-lg focus:outline-none focus:border-blue-500 pr-12" />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          {showSuggestions && suggestions.length > 0 && <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border-2 border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto">
            {suggestions.map((mat) => <button key={mat.id} onClick={() => { setSearchTerm(mat.stockKey || mat.partNumber || ''); setShowSuggestions(false); handleSearch(mat.stockKey || mat.partNumber || ''); }} className="w-full text-left px-6 py-4 hover:bg-gray-800 border-b border-gray-800 last:border-0">
              <p className="font-mono font-bold text-white text-sm truncate">{getMaterialDisplayName(mat)}</p>
              <p className="text-xs text-gray-400 truncate">{mat.description}</p>
            </button>)}
          </div>}
        </div>
        <button onClick={() => handleSearch()} disabled={loading} className="px-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-bold rounded-xl">Buscar</button>
      </div>
    </div>

    {!searchResult && recentSearches.length > 0 && <div className="bg-gray-900/30 rounded-2xl border border-gray-800 p-4">
      <p className="text-sm text-gray-300 mb-2">Búsquedas recientes</p>
      <div className="flex gap-2 flex-wrap">{recentSearches.map((recent) => <button key={recent.key} onClick={() => handleSearch(recent.key)} className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-200">{recent.stockKey || recent.partNumber}</button>)}</div>
    </div>}

    {searchResult?.notFound && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">No se encontró material</div>}

    {searchResult && !searchResult.notFound && !searchResult.error && <div className="space-y-6">
      <div className="bg-gray-900/40 rounded-2xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">{getMaterialDisplayName(searchResult)}</h3>
          {userRole === 'ADMIN' && <button onClick={handleEdit} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-white">Editar material</button>}
        </div>
        <p className="text-gray-300 mb-4">{searchResult.description}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-gray-800/50 rounded p-3"><span className="text-gray-400">Part Number</span><p className="text-white font-mono">{searchResult.partNumber || 'N/A'}</p></div>
          <div className="bg-gray-800/50 rounded p-3"><span className="text-gray-400">Unidades</span><p className="text-white">{searchResult.typeUnits || 'N/A'}</p></div>
          <div className="bg-gray-800/50 rounded p-3"><span className="text-gray-400">Pack</span><p className="text-white">{searchResult.standardPack || 'N/A'}</p></div>
          <div className="bg-gray-800/50 rounded p-3"><span className="text-gray-400">Bins</span><p className="text-white">{searchResult.totalBins || 0}</p></div>
        </div>
      </div>

      <div className="bg-gray-900/40 rounded-2xl border border-gray-800 p-6">
        <h3 className="text-lg font-bold text-white mb-4">Tarjetas asociadas</h3>
        <div className="space-y-3">
          {(searchResult.cards || []).map(card => <div key={card.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="font-mono text-sm text-blue-300">{card.cardId || card.id}</p>
            <p className="text-white">{card.zona} • {card.location}</p>
            <p className="text-xs text-gray-400">Rack: {card.rackCode || 'N/A'} {card.qrUrl ? `• QR: ${card.qrUrl}` : ''}</p>
          </div>)}
          {(searchResult.cards || []).length === 0 && <p className="text-gray-400">No hay tarjetas asociadas</p>}
        </div>
      </div>

      {historicalData && <div className="bg-gray-900/40 rounded-2xl border border-gray-800 p-6 grid grid-cols-3 gap-3 text-center">
        <div><p className="text-gray-400 text-sm">Total Pedidos</p><p className="text-white text-2xl font-bold">{historicalData.totalOrders}</p></div>
        <div><p className="text-gray-400 text-sm">Lead Time Prom.</p><p className="text-white text-2xl font-bold">{historicalData.avgLeadTime} min</p></div>
        <div><p className="text-gray-400 text-sm">Último pedido</p><p className="text-white text-lg font-bold">{historicalData.lastOrderDate}</p></div>
      </div>}
    </div>}

    {showEditModal && userRole === 'ADMIN' && <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6"><div className="bg-gray-900 border-2 border-gray-700 rounded-2xl p-8 w-full max-w-xl">
      <h3 className="text-2xl font-bold text-white mb-6">Editar material</h3>
      <div className="space-y-3 mb-6">
        <input type="number" value={editData.stdOpTime} onChange={(e) => setEditData({ ...editData, stdOpTime: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" placeholder="Tiempo estándar" />
        <input type="number" value={editData.complexityWeight} onChange={(e) => setEditData({ ...editData, complexityWeight: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" placeholder="Complejidad" />
        <input type="number" value={editData.targetLeadTime} onChange={(e) => setEditData({ ...editData, targetLeadTime: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" placeholder="Lead time objetivo" />
        <input type="text" value={editData.standardPack} onChange={(e) => setEditData({ ...editData, standardPack: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" placeholder="Pack estándar" />
      </div>
      <div className="flex gap-3"><button onClick={saveEdit} className="flex-1 bg-green-600 py-2 rounded text-white font-bold">Guardar</button><button onClick={() => setShowEditModal(false)} className="flex-1 bg-gray-700 py-2 rounded text-white">Cancelar</button></div>
    </div></div>}

    {showCreateModal && userRole === 'ADMIN' && <div className="fixed inset-0 bg-black/80 z-50 overflow-auto p-6"><div className="max-w-4xl mx-auto bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
      <h3 className="text-2xl font-bold text-white">Alta de material kanban</h3>
      <p className="text-gray-400 text-sm">Datos del material</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {['stockKey','partNumber','versionCode','description','typeUnits','standardPack','complexityWeight','stdOpTime','targetLeadTime','totalBins'].map((field) => <input key={field} value={createForm[field]} onChange={(e) => setCreateForm({ ...createForm, [field]: e.target.value })} placeholder={field} className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white" />)}
      </div>
      <p className="text-gray-400 text-sm">Tarjetas / ubicaciones</p>
      <div className="space-y-2">{createForm.locations.map((loc, idx) => <div key={idx} className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {['zoneCode','zona','rackCode','location','coordX','coordY'].map((f) => <input key={f} value={loc[f]} onChange={(e) => updateLocation(idx, f, e.target.value)} placeholder={f} className="bg-gray-800 border border-gray-700 rounded px-2 py-2 text-white text-sm" />)}
      </div>)}</div>
      <button onClick={addLocationRow} className="px-3 py-2 bg-blue-600 rounded text-white">Agregar otra ubicación</button>
      <div className="flex gap-3"><button onClick={saveNewMaterial} className="flex-1 bg-green-600 py-2 rounded text-white font-bold">Guardar material</button><button onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-700 py-2 rounded text-white">Cancelar</button></div>
    </div></div>}
  </div>;
};
// ============ SUPPLY CHAIN DASHBOARD (DESKTOP) ============
const SupplyChainView = ({ currentUser, userRole, onLogout }) => {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ pending: 0, inTransit: 0, delivered: 0 });
  const [isConnected, setIsConnected] = useState(false);
  const [time, setTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  // Agregar estas utilidades arriba de SupplyChainView
  const playAlertSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Sonido de "ping" industrial
    audio.play().catch(e => console.log("Esperando interacción para audio"));
  };

  const sendNotification = (materialLabel, zona, rackCode, location) => {
    if (Notification.permission === "granted") {
      new Notification("🚨 NUEVO PEDIDO KANBAN", {
        body: `Material: ${materialLabel} • ${zona || 'S/Z'} / ${rackCode || location || 'S/U'}`,
        icon: "/favicon.ico" // O el logo de TTE
      });
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);


  const [prevPendingCount, setPrevPendingCount] = useState(0);
  useEffect(() => {
    // 1. Pedir permiso para notificaciones apenas cargue
    if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }

    // 2. Definimos la query (Traemos los dos estados de una)
    const q = query(
      collection(db, 'active_orders'),
      where('status', 'in', ['PENDING', 'IN_TRANSIT'])
    );

    // 3. Iniciamos el listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIsConnected(true);

      // Procesamos los datos
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Contamos cuántos hay pendientes ahora
      const currentPendingCount = ordersData.filter(o => o.status === 'PENDING').length;

      // 🔥 LÓGICA DE ALARMA
      // Usamos una función dentro de setPrevPendingCount para comparar con el valor anterior
      setPrevPendingCount(prev => {
        if (currentPendingCount > prev) {
          // Si hay más que antes, suena el buzzer
          playAlertSound();

          // Notificación de Chrome
          const lastOrder = ordersData.find(o => o.status === 'PENDING');
          if (lastOrder) sendNotification(getMaterialDisplayName(lastOrder), lastOrder.zona, lastOrder.rackCode, lastOrder.location);

          // Título titilante
          let toggled = false;
          const interval = setInterval(() => {
            document.title = toggled ? "⚠️ NUEVO PEDIDO" : "TTE E-KANBAN";
            toggled = !toggled;
          }, 500);
          setTimeout(() => { clearInterval(interval); document.title = "TTE E-KANBAN"; }, 5000);
        }
        return currentPendingCount; // Guardamos el nuevo conteo para la próxima comparación
      });

      // 4. Actualizamos el resto del Dashboard
      ordersData.sort((a, b) => {
        if (!a.timestamp || !b.timestamp) return 0;
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      });

      setOrders(ordersData);
      setStats({
        pending: currentPendingCount,
        inTransit: ordersData.filter(o => o.status === 'IN_TRANSIT').length,
        delivered: 0
      });
    }, (error) => {
      console.error('Firestore error:', error);
      setIsConnected(false);
    });

    // 5. Limpieza al desmontar el componente
    return () => unsubscribe();

  }, []); // El array vacío es clave: el listener se pone una sola vez y listo

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'active_orders', orderId);

      if (newStatus === 'IN_TRANSIT') {
        await updateDoc(orderRef, {
          status: 'IN_TRANSIT',
          dispatchedAt: serverTimestamp(),
          takenBy: currentUser.email.split('@')[0]
        });

      } else if (newStatus === 'DELIVERED') {
        console.log('🚀 Iniciando cierre de pedido desde Dashboard...');

        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          console.error('❌ Pedido no encontrado');
          alert('Error: Pedido no encontrado');
          return;
        }

        const orderData = orderSnap.data();
        console.log('📦 Datos del pedido:', {
          id: orderRef.id,
          cardId: orderData.cardId,
          hasTimestamp: !!orderData.timestamp,
          hasDispatchedAt: !!orderData.dispatchedAt
        });

        // Validar timestamps
        if (!orderData.timestamp || !orderData.dispatchedAt) {
          alert('⚠️ ERROR: El pedido no tiene los timestamps necesarios.');
          console.error('❌ Timestamps faltantes');
          return;
        }

        try {
          // 🔥 USAR LA FUNCIÓN CENTRALIZADA
          const metrics = calculateOrderMetrics(orderData, new Date());

          console.log('⏱️ Métricas calculadas:', {
            reactionTime: `${metrics.reactionTime} min`,
            executionTime: `${metrics.executionTime} min`,
            totalLeadTime: `${metrics.totalLeadTime} min`
          });

          // Guardar en completed_orders con TODAS las métricas
          await addDoc(collection(db, 'completed_orders'), {
            // Datos básicos
            cardId: orderData.cardId,
            stockKey: orderData.stockKey || '',
            partNumber: orderData.partNumber,
            versionCode: orderData.versionCode || '',
            description: orderData.description,
            typeUnits: orderData.typeUnits || '',
            zona: orderData.zona || '',
            location: orderData.location,
            rackCode: orderData.rackCode || '',
            zoneCode: orderData.zoneCode || '',
            standardPack: orderData.standardPack,
            totalBins: orderData.totalBins || 0,
            requestedBy: orderData.requestedBy,
            takenBy: orderData.takenBy,

            // Estado
            status: 'DELIVERED',
            deliveredBy: currentUser.email.split('@')[0],
            deliveredAt: serverTimestamp(),

            // Timestamps originales
            timestamp: orderData.timestamp,
            dispatchedAt: orderData.dispatchedAt,

            // 🔥 TODAS LAS MÉTRICAS
            ...metrics
          });

          console.log('✅ Pedido guardado en completed_orders');

          // Eliminar de activos
          await deleteDoc(orderRef);
          console.log('✅ Pedido eliminado de active_orders');

          alert(`✅ Pedido completado\n\n⏱️ Tiempos:\nReacción: ${metrics.reactionTime}min\nEjecución: ${metrics.executionTime}min\nTotal: ${metrics.totalLeadTime}min`);

        } catch (error) {
          console.error('❌ ERROR:', error);
          alert(`Error: ${error.message}`);
        }
      }
    } catch (error) { console.error('Error al cerrar pedido:', error); }
  };

  // Lógica para que titile tanto la Zona como el Rack específico
  const locationStatuses = orders.reduce((acc, order) => {
    const z = order.zona;     // Ej: "Zona 1"
    const l = order.location; // Ej: "Rack A-01"

    // Marcar la Zona (para el mapa general)
    if (z) {
      if (!acc[z]) acc[z] = { pending: false, inTransit: false };
      if (order.status === 'PENDING') acc[z].pending = true;
      if (order.status === 'IN_TRANSIT') acc[z].inTransit = true;
    }

    // Marcar el Rack (para el mapa de detalle)
    if (l) {
      if (!acc[l]) acc[l] = { pending: false, inTransit: false };
      if (order.status === 'PENDING') acc[l].pending = true;
      if (order.status === 'IN_TRANSIT') acc[l].inTransit = true;
    }
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
              <div className="flex items-center gap-2 ml-6">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'dashboard'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  📋 Pedidos Activos
                </button>

                {/* 🔥 NUEVA PESTAÑA BUSCADOR */}
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'search'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  🔍 Buscador
                </button>

                {/* 🔥 SOLO MOSTRAR ESTADÍSTICAS SI ES ADMIN */}
                {userRole === 'ADMIN' && (
                  <button
                    onClick={() => setActiveTab('kpis')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'kpis'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                  >
                    📊 Estadísticas
                  </button>
                )}
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
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Almacén</div>
                    <div className="text-sm font-bold text-white">
                      {currentUser?.email?.split('@')[0]?.toUpperCase() || 'Usuario'}
                    </div>
                  </div>
                  <button
                    onClick={onLogout}
                    className="ml-2 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-5 h-5 text-gray-400 hover:text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'kpis' && userRole === 'ADMIN' ? (
          <KPIView currentUser={currentUser} />
        ) : activeTab === 'search' ? (
          <MaterialSearchView userRole={userRole} />
        ) : (
          <>
            {/* Stats Overview - CON DATOS REALES */}
            <StatsOverview />

            {/* Plant Layout Map */}
            <PlantMap locationStatuses={locationStatuses} orders={orders} />

            {/* Orders Board */}
            {/* Orders Board - MODIFICADO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              {/* Columna PENDIENTES - Con botón */}
              <OrderColumn
                title="Pedidos Pendientes"
                status="PENDING"
                orders={orders.filter(o => o.status === 'PENDING')}
                onAction={(id) => handleStatusChange(id, 'IN_TRANSIT')}
                actionLabel="Tomar pedido"
                actionIcon={<Truck className="w-4 h-4" />}
                color="red"
                showAction={true}
              />

              {/* Columna EN TRÁNSITO - Sin botón */}
              <OrderColumn
                title="En Tránsito"
                status="IN_TRANSIT"
                orders={orders.filter(o => o.status === 'IN_TRANSIT')}
                // SIN onAction - La entrega solo por QR
                actionLabel="" // Vacío
                actionIcon={null}
                color="yellow"
                showAction={false}
                infoText="Entrega solo por escaneo QR"
              />
            </div>
          </>

        )}
      </div>
    </div>
  );
};

// ============ COMPONENTES AUXILIARES ============

// Component: Plant Map
// ============ COMPONENTE: MAPA DE PLANTA RECARGADO ============
// ============ CONFIGURACIÓN DE MAPAS POR SECTOR ============
const MAP_DATA = {
  general: {
    title: 'Vista General de Planta',
    image: '/tu-plano.png',
    pins: [
      // CAMBIAMOS EL ID PARA QUE COINCIDA CON FIREBASE
      { id: 'Zona 1', label: 'Zona 1 - Bobinado', x: 60, y: 50, target: 'sectorA' },
      { id: 'Zona 2', label: 'Zona 2 - Prestabilizado', x: 51.45, y: 29.27, target: 'sectorB' },
      { id: 'Zona 3', label: 'Zona 3 - Montaje', x: 46.94, y: 44.00, target: 'sectorC' },
    ]
  },
  sectorA: {
    title: 'Detalle: Sector Estantería A',
    image: '/tu-plano_bob.png',
    pins: [
      { id: 'Rack A-01', x: 36.72, y: 30.73 },
      { id: 'Rack A-02', x: 54.06, y: 27.82 },
      { id: 'Rack A-03', x: 56.82, y: 66.11 },
    ]
  },
  sectorB: {
    title: 'Detalle: Sector Estantería  A',
    image: '/tu-plano_bob.png',
    pins: [
      { id: 'Rack A-01', x: 20, y: 30 },
      { id: 'Rack A-02', x: 54.06, y: 27.82 },
      { id: 'Rack A-03', x: 60, y: 30 },
    ]
  },
  // Podés agregar sectorB, sectorC, etc., siguiendo la misma lógica
};

const PlantMap = ({ locationStatuses }) => {
  const [activeSector, setActiveSector] = useState('general');
  const [isInteractive, setIsInteractive] = useState(false); // Por defecto: Imagen completa
  const currentConfig = MAP_DATA[activeSector] || MAP_DATA.general;

  // Al volver atrás, siempre reseteamos a vista completa
  const goBack = () => {
    setActiveSector('general');
    setIsInteractive(false);
  };

  // Función para capturar coordenadas (Consola F12)
  const handleMapClick = (e) => {
    if (!isInteractive) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      console.log(`📍 Coordenadas para ${activeSector}: x: ${x.toFixed(2)}, y: ${y.toFixed(2)}`);
    }
  };

  const toggleInteractive = () => setIsInteractive(!isInteractive);

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{currentConfig.title}</h2>
            <div className="flex items-center gap-2">
              {activeSector !== 'general' && (
                <button
                  onClick={goBack}
                  className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded transition-colors flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> VOLVER AL GENERAL
                </button>
              )}
              <p className="text-xs text-gray-400 font-mono">
                {isInteractive ? '🔍 Modo Zoom Activo' : '📱 Vista Previa'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_red]"></div><span className="text-[10px] text-gray-400 uppercase">Pendiente</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_8px_yellow]"></div><span className="text-[10px] text-gray-400 uppercase">En Tránsito</span></div>
        </div>
      </div>

      <div
        className="relative rounded-xl border-2 border-gray-700 h-[550px] overflow-hidden bg-gray-950 shadow-inner"
        onClick={handleMapClick}
      >
        {/* BOTÓN LUPA / ZOOM */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Evita que el click en el botón dispare el log de coordenadas
            toggleInteractive();
          }}
          className={`absolute top-4 right-4 z-50 p-3 rounded-full shadow-2xl transition-all duration-300 border-2 ${isInteractive
            ? 'bg-red-500 border-red-400 text-white'
            : 'bg-blue-600 border-blue-400 text-white hover:scale-110'
            }`}
        >
          {isInteractive ? <Minimize2 className="w-6 h-6" /> : <Search className="w-6 h-6" />}
        </button>

        {/* LIENZO DEL MAPA */}
        {/* LIENZO DEL MAPA */}
        <motion.div
          drag={isInteractive}
          dragConstraints={{ left: -1000, right: 0, top: -600, bottom: 0 }}
          animate={{
            scale: isInteractive ? 2 : 1,
            x: isInteractive ? -300 : 0,
            y: isInteractive ? -200 : 0
          }}
          transition={{ type: "spring", damping: 25, stiffness: 120 }}
          className={`relative origin-top-left ${isInteractive
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-default flex items-center justify-center'
            }`}
          style={{ width: '100%', height: '100%' }}
        >
          {/* IMAGEN */}
          {/* WRAPPER DE IMAGEN REAL */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              <img
                src={currentConfig.image}
                alt="Plano"
                className={`block w-full h-full object-contain ${isInteractive ? 'opacity-60' : 'opacity-100'
                  } select-none pointer-events-none`}
              />

              {/* PINS (AHORA RELATIVOS A LA IMAGEN) */}
              {currentConfig.pins.map((pin) => {
                const status = locationStatuses[pin.id];
                let color = 'bg-gray-500';
                let shouldPulse = false;

                if (status?.pending) {
                  color = 'bg-red-500';
                  shouldPulse = true;
                } else if (status?.inTransit) {
                  color = 'bg-yellow-500';
                  shouldPulse = true;
                }

                return (
                  <motion.div

                    key={pin.id}
                    className="absolute z-20"
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`
                    }}
                    whileHover={{ scale: 1.3 }}


                    onClick={(e) => {
                      e.stopPropagation();
                      if (pin.target) {
                        setActiveSector(pin.target);
                        setIsInteractive(false);
                      }
                    }}
                  >
                    <div className="-translate-x-1/2 -translate-y-1/2 relative cursor-pointer group">

                      {shouldPulse && (
                        <motion.div
                          className={`absolute inset-0 ${color} rounded-full`}
                          animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}

                      <div
                        className={`relative z-10 ${isInteractive ? 'w-6 h-6' : 'w-4 h-4'
                          } ${color} rounded-full border-2 border-white shadow-lg flex items-center justify-center`}
                      >
                        <div className="w-1 h-1 bg-white rounded-full"></div>
                      </div>

                      <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur px-2 py-1 rounded border border-gray-700 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <p className="text-[10px] font-black text-white whitespace-nowrap uppercase">
                          {pin.label || pin.id} {pin.target ? '🔍' : ''}

                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>



        </motion.div>



        {!isInteractive && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-gray-900/80 backdrop-blur border border-gray-700 px-4 py-2 rounded-full flex items-center gap-2">
              <Search className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Click en lupa para zoom</span>
            </div>
          </div>
        )}
      </div>
    </div >
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
const OrderColumn = ({ title, status, orders, onAction, actionLabel, actionIcon, color, showAction = true, infoText }) => {
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
              showAction={showAction}
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

      {/* Información adicional para columna sin botón */}
      {!showAction && infoText && (
        <div className="mt-6 bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
          <div className="flex items-center gap-2 text-blue-400 text-sm">
            <Info className="w-4 h-4" />
            <span>{infoText}</span>
          </div>
        </div>
      )}
    </div>
  );

};

// Component: Order Card
// Component: Order Card
const OrderCard = ({ order, onAction, actionLabel, actionIcon, color, showAction = true }) => {
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
            <span className="font-mono font-bold text-white text-lg">{order.stockKey || order.partNumber}</span>
          </div>
          <p className="text-gray-300">{order.description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Hora</div>
          <div className="font-mono text-sm font-bold text-white">{formatTime(order.timestamp)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* ZONA (Sector General) */}
        <div className="bg-gray-900/50 rounded-lg p-3 border border-blue-500/20">
          <div className="text-[10px] text-blue-400 uppercase font-bold mb-1">Sector</div>
          <div className="flex items-center gap-2">
            <Factory className="w-3 h-3 text-blue-400" />
            <span className="font-bold text-white text-sm">{order.zona || 'S/Z'}</span>
          </div>
        </div>

        {/* RACK (Ubicación Específica) */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Ubicación</div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-gray-400" />
            <span className="font-medium text-white text-sm">{order.location}</span>
          </div>
        </div>
        {/* ... resto de campos (Tomado por, Pack) ... */}
      </div>
      {order.takenBy && (
        <div className="bg-gray-900/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Tomado por</div>
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-blue-400" />
            <span className="font-medium text-blue-300">{order.takenBy}</span>
          </div>
        </div>
      )}
      <div className="bg-gray-900/50 rounded-lg p-3">
        <div className="text-xs text-gray-400 mb-1">Pack Estándar</div>
        <div className="font-medium text-white">{order.standardPack} {order.typeUnits || "unidades"}</div>
      </div>


      {/* SOLO mostrar botón si showAction es true */}
      {
        showAction && onAction && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => onAction(order.id)}
            className={`w-full ${buttonClasses[color]} text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3`}
          >
            {actionIcon}
            {actionLabel}
          </motion.button>
        )
      }
    </motion.div >
  );
};

// ============ MAIN APP ============
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // 🔥 BUSCAR ROL EN FIRESTORE
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));

          if (userDoc.exists()) {
            const role = userDoc.data().role || 'MILKMAN';
            setUserRole(role);
            console.log('✅ Rol asignado:', role);
          } else {
            // Si no existe en la colección, es MILKMAN por defecto
            setUserRole('MILKMAN');
            console.log('⚠️ Usuario sin documento en Firestore, rol: MILKMAN');
          }
        } catch (error) {
          console.error('❌ Error al obtener rol:', error);
          setUserRole('MILKMAN'); // Por defecto MILKMAN en caso de error
        }
      } else {
        setUserRole(null);
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Dispositivos móviles y tablets (ancho menor a 1024px) usarán OperatorView
  const isMobileOrTablet = window.innerWidth < 1024;

  if (isMobileOrTablet) {
    // Si el usuario toca el botón de login y no está logueado, mostramos el login
    if (showLogin && !currentUser) {
      return <LoginScreen onLoginSuccess={() => setShowLogin(false)} />;
    }
    // Siempre mostrar OperatorView, con o sin usuario
    return <OperatorView
      currentUser={currentUser}
      onLogout={handleLogout}
      onOpenLogin={() => setShowLogin(true)}
    />;
  }

  // Para escritorio (pantallas grandes) login obligatorio
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={() => setShowLogin(false)} />;
  }
  return <SupplyChainView currentUser={currentUser} userRole={userRole} onLogout={handleLogout} />;
}
