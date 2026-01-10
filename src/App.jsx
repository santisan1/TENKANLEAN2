import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, getDoc, getDocs, addDoc,
  onSnapshot, updateDoc, doc, query, where, serverTimestamp, deleteDoc
} from 'firebase/firestore';
import {
  getAuth, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import { Package, AlertTriangle, LogOut, CheckCircle, Award, Truck, Info, RotateCcw, Camera, Clock, MapPin, Activity, Factory, Warehouse, Settings, Bell, User, BarChart3 } from 'lucide-react';
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
        partNumber: existingOrder.partNumber,
        takenBy: existingOrder.takenBy || 'Sin asignar'
      };
    }

    console.log('✅ No hay pedidos duplicados, puede crear nuevo');
    return { exists: false };

  } catch (error) {
    console.error('❌ Error checking existing order:', error);
    return { exists: false, error: error.message };
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
          const pn = o.partNumber || 'Desconocido';
          if (!materialMap[pn]) {
            materialMap[pn] = {
              count: 0,
              totalTime: 0,
              description: o.description || ''
            };
          }
          materialMap[pn].count++;
          materialMap[pn].totalTime += (o.totalLeadTime || 0);
        });

        const topMaterials = Object.entries(materialMap)
          .map(([pn, data]) => ({
            partNumber: pn,
            description: data.description,
            frequency: data.count,
            avgLeadTime: Math.round(data.totalTime / data.count)
          }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 5);

        // Materiales Problemáticos (alto Lead Time)
        const problemMaterials = Object.entries(materialMap)
          .filter(([_, data]) => data.count >= 2)
          .map(([pn, data]) => ({
            partNumber: pn,
            description: data.description,
            avgLeadTime: Math.round(data.totalTime / data.count)
          }))
          .sort((a, b) => b.avgLeadTime - a.avgLeadTime)
          .slice(0, 5);

        // === DIMENSIÓN 4: INTEGRIDAD DE DATOS ===

        const suspiciousCount = orders.filter(o => o.isSuspicious).length;
        const suspiciousRate = Math.round((suspiciousCount / orders.length) * 100);

        // === PREDICTIVO: HEATMAP HORARIO ===

        const hourlyMap = Array(24).fill(0);
        orders.forEach(o => {
          if (o.deliveredAt) {
            const hour = o.deliveredAt.toDate().getHours();
            hourlyMap[hour]++;
          }
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
          hourlyHeatmap: hourlyMap,
          suspiciousRate
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
                      {op.avgEfficiency}%
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

      {/* === NIVEL PREDICTIVO === */}
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-blue-400" />
          Heatmap Horario • Planificación de Turnos
        </h2>
        <div className="flex items-end justify-between h-64 gap-1">
          {kpiData.hourlyHeatmap.map((count, hour) => {
            const maxCount = Math.max(...kpiData.hourlyHeatmap);
            const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const isPeak = count >= maxCount * 0.7;

            return (
              <div key={hour} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={`w-full rounded-t-lg transition-all hover:opacity-80 cursor-pointer ${isPeak
                    ? 'bg-gradient-to-t from-orange-500 to-red-500'
                    : 'bg-gradient-to-t from-blue-500 to-blue-600'
                    }`}
                  style={{ height: `${height}%` }}
                  title={`${count} entregas a las ${hour}:00`}
                />
                <span className={`text-[10px] ${isPeak ? 'text-orange-400 font-bold' : 'text-gray-500'}`}>
                  {hour}h
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-t from-orange-500 to-red-500" />
            <span className="text-gray-400">Horas Pico (reforzar personal)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gradient-to-t from-blue-500 to-blue-600" />
            <span className="text-gray-400">Carga Normal</span>
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
                    <p className="font-mono font-bold text-white text-sm">{mat.partNumber}</p>
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
                  <p className="font-mono font-bold text-white text-sm">{mat.partNumber}</p>
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
  const [stats, setStats] = useState({
    avgLeadTime: 0,
    slaRate: 0,
    deliveredToday: 0,
    pendingCount: 0,
    inTransitCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 1. OBTENER PEDIDOS COMPLETADOS DEL DÍA
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completedQuery = query(
          collection(db, 'completed_orders'),
          where('deliveredAt', '>=', today)
        );

        const completedSnapshot = await getDocs(completedQuery);
        const completedOrders = completedSnapshot.docs.map(doc => doc.data());

        // 2. CALCULAR LEAD TIME PROMEDIO
        const leadTimes = completedOrders
          .filter(o => o.totalLeadTime)
          .map(o => o.totalLeadTime);

        const avgLT = leadTimes.length > 0
          ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
          : 0;

        // 3. CALCULAR SLA SUCCESS RATE
        const onTimeCount = completedOrders.filter(o => o.onTime).length;
        const slaRate = completedOrders.length > 0
          ? Math.round((onTimeCount / completedOrders.length) * 100)
          : 0;

        // 4. OBTENER PEDIDOS ACTIVOS
        const activeQuery = query(
          collection(db, 'active_orders'),
          where('status', 'in', ['PENDING', 'IN_TRANSIT'])
        );

        const activeSnapshot = await getDocs(activeQuery);
        const activeOrders = activeSnapshot.docs.map(doc => doc.data());

        const pendingCount = activeOrders.filter(o => o.status === 'PENDING').length;
        const inTransitCount = activeOrders.filter(o => o.status === 'IN_TRANSIT').length;

        setStats({
          avgLeadTime: avgLT,
          slaRate,
          deliveredToday: completedOrders.length,
          pendingCount,
          inTransitCount
        });

      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Actualizar cada 30 segundos
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 animate-pulse">
            <div className="h-20 bg-gray-800 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Visión General */}
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
              value={stats.pendingCount}
              color="red"
              trend={stats.pendingCount > 5 ? `+${stats.pendingCount - 5}` : null}
            />
            <StatCard
              icon={<Truck className="w-5 h-5" />}
              label="En Tránsito"
              value={stats.inTransitCount}
              color="yellow"
            />
            <StatCard
              icon={<CheckCircle className="w-5 h-5" />}
              label="Entregados Hoy"
              value={stats.deliveredToday}
              color="green"
              trend={stats.deliveredToday > 0 ? `+${stats.deliveredToday}` : null}
            />
          </div>
        </div>
      </div>

      {/* Rendimiento */}
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
              <div className="text-3xl font-bold text-white">
                {stats.avgLeadTime > 0 ? `${stats.avgLeadTime}min` : '--:--'}
              </div>
              <div className="text-sm text-gray-400">Tiempo promedio</div>
              {stats.avgLeadTime > 0 && (
                <div className="text-xs text-green-400 mt-1">
                  {stats.avgLeadTime < 20 ? '↓ Muy bueno' : stats.avgLeadTime < 30 ? '→ Normal' : '↑ Alto'}
                </div>
              )}
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-3xl font-bold text-white">
                {stats.slaRate > 0 ? `${stats.slaRate}%` : '0%'}
              </div>
              <div className="text-sm text-gray-400">Tasa de cumplimiento</div>
              {stats.slaRate > 0 && (
                <div className={`text-xs mt-1 ${stats.slaRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {stats.slaRate >= 90 ? '↑ Excelente' : '→ Mejorable'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
    if (!scannedId) return;

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
        if (existingOrder.exists) {
          const minutosEspera = Math.floor((Date.now() - existingOrder.timestamp.toMillis()) / 60000);

          setExistingOrderInfo({
            orderId: existingOrder.orderId,
            status: existingOrder.status,
            timestamp: existingOrder.timestamp,
            location: existingOrder.location,
            partNumber: existingOrder.partNumber,
            takenBy: existingOrder.takenBy || 'Sin asignar'
          });

          const estadoTexto = existingOrder.status === 'PENDING'
            ? `⏳ PENDIENTE de retiro`
            : `🚚 EN CAMINO con ${existingOrder.takenBy || 'almacén'}`;

          setFeedback({
            type: 'info',
            message: `ℹ️ MATERIAL EN PROCESO\n${estadoTexto}\n⏱️ Esperando hace ${minutosEspera} min.\n📍 ${card.location}`
          });
          setScanning(false);
          return;
        }

        // Crear nuevo pedido
        // En handleScan -> Caso A (Producción)
        await addDoc(collection(db, 'active_orders'), {
          cardId: scannedId,
          ...card, // 🔥 Esto copia complejidad, bins, targetLeadTime, etc.
          status: 'PENDING',
          requestedBy: 'Produccion',
          createdAt: serverTimestamp(),
          timestamp: serverTimestamp()
        });

        setFeedback({
          type: 'success',
          message: `✓ PEDIDO CREADO\n📍 ${card.location}\n📦 ${card.partNumber}\n⏱️ El almacén será notificado`
        });
      }

      // ========== CASO B: CON LOGIN (ALMACÉN) ==========
      else {
        const userName = currentUser.email.split('@')[0];

        // Si hay pedido EN TRÁNSITO → ENTREGA DIRECTA
        // REEMPLAZÁ EL BLOQUE DEL "if (existingOrder.status === 'IN_TRANSIT')" POR ESTE:
        if (existingOrder.exists && existingOrder.status === 'IN_TRANSIT') {
          const orderRef = doc(db, 'active_orders', existingOrder.orderId);
          const userName = currentUser.email.split('@')[0];

          // 1. PASAR A COMPLETADOS
          await addDoc(collection(db, 'completed_orders'), {
            ...existingOrder,
            status: 'DELIVERED',
            deliveredAt: serverTimestamp(),
            deliveredBy: userName,
            // Saneamiento de datos
            complexityWeight: parseInt(existingOrder.complexityWeight || 1),
            targetLeadTime: parseInt(existingOrder.targetLeadTime || 30)
          });

          // 2. ELIMINAR DE ACTIVOS
          await deleteDoc(orderRef);

          setFeedback({
            type: 'success',
            message: `✅ ENTREGA FINALIZADA\n📦 ${existingOrder.partNumber}\n👤 Por: ${userName}`
          });
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
      console.error('Error:', error);
      setFeedback({ type: 'error', message: '✗ ERROR DE CONEXIÓN\nReintente.' });
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

// ============ SUPPLY CHAIN DASHBOARD (DESKTOP) ============
const SupplyChainView = ({ currentUser, onLogout }) => {
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

  const sendNotification = (partNumber, location) => {
    if (Notification.permission === "granted") {
      new Notification("🚨 NUEVO PEDIDO KANBAN", {
        body: `Material: ${partNumber} en ${location}`,
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
          if (lastOrder) sendNotification(lastOrder.partNumber, lastOrder.location);

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
        console.log('🚀 Iniciando proceso de entrega...');

        const orderSnap = await getDoc(orderRef);
        if (!orderSnap.exists()) {
          console.error('❌ Pedido no encontrado');
          return;
        }

        const data = orderSnap.data();
        console.log('📦 Datos del pedido:', {
          id: orderRef.id,
          cardId: data.cardId,
          status: data.status,
          hasTimestamp: !!data.timestamp,
          hasDispatchedAt: !!data.dispatchedAt
        });

        // === VALIDAR TIMESTAMPS ===
        if (!data.timestamp || !data.dispatchedAt) {
          alert('⚠️ ERROR: El pedido no tiene los timestamps necesarios.\nNo se puede calcular los tiempos.');
          console.error('❌ Timestamps faltantes:', {
            timestamp: data.timestamp,
            dispatchedAt: data.dispatchedAt
          });
          return;
        }

        // === CALCULAR TIEMPOS ===
        const ahora = Date.now();
        const creacion = data.timestamp.toMillis();
        const aceptacion = data.dispatchedAt.toMillis();

        // Forzar que sean números enteros positivos
        const reactionTime = Math.max(1, Math.floor((aceptacion - creacion) / 60000));
        const executionTime = Math.max(1, Math.floor((ahora - aceptacion) / 60000));
        const totalLeadTime = Math.max(1, Math.floor((ahora - creacion) / 60000));

        console.log('⏱️ TIEMPOS CALCULADOS:', {
          reactionTime,
          executionTime,
          totalLeadTime,
          tipo_reaction: typeof reactionTime,
          tipo_execution: typeof executionTime,
          tipo_total: typeof totalLeadTime
        });

        // Verificar que sean números válidos
        if (isNaN(reactionTime) || isNaN(executionTime) || isNaN(totalLeadTime)) {
          alert('⚠️ ERROR: No se pudieron calcular los tiempos correctamente');
          console.error('❌ Tiempos inválidos');
          return;
        }

        // === PARÁMETROS BASE ===
        const stdTime = Math.max(1, parseInt(data.stdOpTime) || 10);
        const complexity = Math.max(1, Math.min(5, parseInt(data.complexityWeight) || 1));
        const targetLT = Math.max(1, parseInt(data.targetLeadTime) || 30);

        console.log('📊 Parámetros:', { stdTime, complexity, targetLT });

        // === MÉTRICAS ===
        const taskEfficiency = Math.round((stdTime / executionTime) * 100);
        const loadPoints = complexity * (complexity >= 4 ? 2 : 1);
        const effortPoints = totalLeadTime <= targetLT ? Math.round(loadPoints * 1.5) : loadPoints;
        const isSuspicious = executionTime < (stdTime * 0.2);
        const onTime = totalLeadTime <= targetLT;

        console.log('📈 Métricas:', {
          taskEfficiency,
          loadPoints,
          effortPoints,
          isSuspicious,
          onTime
        });

        // === PASO 1: GUARDAR ORDEN BÁSICA ===
        try {
          console.log('💾 PASO 1: Guardando orden básica...');

          const basicOrder = {
            cardId: data.cardId || 'UNKNOWN',
            partNumber: data.partNumber || 'UNKNOWN',
            description: data.description || '',
            location: data.location || 'UNKNOWN',
            standardPack: data.standardPack || 0,
            requestedBy: data.requestedBy || 'Produccion',
            status: 'DELIVERED',
            deliveredBy: currentUser.email.split('@')[0],
            takenBy: data.takenBy || 'UNKNOWN',

            // Timestamps originales
            timestamp: data.timestamp,
            dispatchedAt: data.dispatchedAt,
            deliveredAt: serverTimestamp()
          };

          const docRef = await addDoc(collection(db, 'completed_orders'), basicOrder);
          console.log('✅ PASO 1 OK - ID:', docRef.id);

          // === PASO 2: ACTUALIZAR CON TIEMPOS ===
          console.log('💾 PASO 2: Agregando tiempos...');

          await updateDoc(doc(db, 'completed_orders', docRef.id), {
            reactionTime: reactionTime,
            executionTime: executionTime,
            totalLeadTime: totalLeadTime,
            taskEfficiency: taskEfficiency,
            loadPoints: loadPoints,
            effortPoints: effortPoints,
            isSuspicious: isSuspicious,
            onTime: onTime,
            complexityWeight: complexity,
            stdOpTime: stdTime,
            targetLeadTime: targetLT
          });

          console.log('✅ PASO 2 OK - Tiempos guardados');

          // === VERIFICACIÓN ===
          const savedDoc = await getDoc(doc(db, 'completed_orders', docRef.id));
          const savedData = savedDoc.data();

          console.log('🔍 VERIFICACIÓN FINAL:', {
            tiene_reactionTime: !!savedData.reactionTime,
            tiene_executionTime: !!savedData.executionTime,
            tiene_totalLeadTime: !!savedData.totalLeadTime,
            valores: {
              reactionTime: savedData.reactionTime,
              executionTime: savedData.executionTime,
              totalLeadTime: savedData.totalLeadTime
            }
          });

          // === ELIMINAR DE ACTIVOS ===
          await deleteDoc(orderRef);
          console.log('✅ Pedido eliminado de active_orders');

          alert(`✅ Pedido completado exitosamente\n\n⏱️ Tiempos:\nReacción: ${reactionTime}min\nEjecución: ${executionTime}min\nTotal: ${totalLeadTime}min`);

        } catch (error) {
          console.error('❌ ERROR EN GUARDADO:', error);
          alert(`Error: ${error.message}`);
        }
      }
    } catch (error) { console.error('Error al cerrar pedido:', error); }
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
                <button
                  onClick={() => setActiveTab('kpis')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'kpis'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                >
                  📊 Estadísticas
                </button>
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
        {activeTab === 'kpis' ? (
          <KPIView currentUser={currentUser} />
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
const PlantMap = ({ locationStatuses, orders }) => {
  const locations = [
    { id: 'Estantería A', x: 35, y: 24.64 },
    { id: 'Estantería B', x: 55.18, y: 29.64 },
    { id: 'Estantería C', x: 56.10, y: 69.22 },
    { id: 'Estantería D', x: 37.5, y: 66.88 },
  ];

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
        <div className="relative rounded-xl border-2 border-gray-700 h-96 overflow-hidden cursor-crosshair group">
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/40 pointer-events-none">
            <div className="w-full h-full bg-gray-800/20 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500">Plano de planta</p>
                <p className="text-gray-600 text-sm">Aquí iría la imagen del plano</p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-transparent to-transparent"></div>
          </div>

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
          <div className="font-medium text-white">{order.standardPack} unidades</div>
        </div>
      </div>

      {/* SOLO mostrar botón si showAction es true */}
      {showAction && onAction && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => onAction(order.id)}
          className={`w-full ${buttonClasses[color]} text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-3`}
        >
          {actionIcon}
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
};

// ============ MAIN APP ============
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

  return <SupplyChainView currentUser={currentUser} onLogout={handleLogout} />;
}