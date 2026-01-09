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
import { Package, AlertTriangle, LogOut, CheckCircle, Truck, Info, RotateCcw, Camera, Clock, MapPin, Activity, Factory, Warehouse, Settings, Bell, User, BarChart3 } from 'lucide-react';
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
    // Resumen general
    overallLeadTime: 0,
    deliveriesToday: 0,
    pendingOrders: 0,
    inTransitOrders: 0,

    // Por operario
    operatorPerformance: [],

    // Por material
    materialStats: [],

    // Tendencias
    hourlyDistribution: [],
    avgTimeByStage: {
      creationToDispatch: 0,
      dispatchToDelivery: 0,
      total: 0
    },

    // Ranking
    topPerformers: [],
    problemMaterials: []
  });

  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today'); // 'today', 'week', 'month', 'all'
  const [activeChart, setActiveChart] = useState('overview');

  useEffect(() => {
    const fetchKPIs = async () => {
      try {
        setLoading(true);

        // Determinar rango de fechas
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
            startDate = new Date(0); // Desde el inicio
            break;
        }

        // 1. Obtener TODOS los pedidos entregados en el rango
        const deliveredQuery = query(
          collection(db, 'completed_orders'),
          where('status', '==', 'DELIVERED'),
          where('deliveredAt', '>=', startDate)
        );

        const allOrdersQuery = query(
          collection(db, 'active_orders'),
          where('status', 'in', ['PENDING', 'IN_TRANSIT'])
        );

        const [deliveredSnapshot, allSnapshot] = await Promise.all([
          getDocs(deliveredQuery),
          getDocs(allOrdersQuery)
        ]);

        const deliveredOrders = deliveredSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const allOrders = allSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 2. Calcular Lead Time General y por Etapa
        const leadTimes = deliveredOrders
          .filter(o => o.timestamp && o.dispatchedAt && o.deliveredAt)
          .map(o => {
            const created = o.timestamp.toMillis();
            const dispatched = o.dispatchedAt.toMillis();
            const delivered = o.deliveredAt.toMillis();

            return {
              creationToDispatch: (dispatched - created) / 60000, // minutos
              dispatchToDelivery: (delivered - dispatched) / 60000,
              total: (delivered - created) / 60000
            };
          });

        const avgLeadTime = leadTimes.length > 0
          ? Math.round(leadTimes.reduce((sum, lt) => sum + lt.total, 0) / leadTimes.length)
          : 0;

        const avgCreationToDispatch = leadTimes.length > 0
          ? Math.round(leadTimes.reduce((sum, lt) => sum + lt.creationToDispatch, 0) / leadTimes.length)
          : 0;

        const avgDispatchToDelivery = leadTimes.length > 0
          ? Math.round(leadTimes.reduce((sum, lt) => sum + lt.dispatchToDelivery, 0) / leadTimes.length)
          : 0;
        // Dentro de tu fetchKPIs, después de obtener los pedidos:

        const processedStats = deliveredOrders.map(order => {
          const complexity = order.complexityWeight || 1;
          const target = order.targetLeadTime || 30;
          const actualTime = order.finalLeadTimeMinutes || 0; // Usamos el campo que creamos al mover

          return {
            ...order,
            onTime: actualTime <= target,
            // Justica Operativa: Puntos = Complejidad x Bonus por cumplimiento (50% extra)
            effortPoints: complexity * (actualTime <= target ? 1.5 : 1)
          };
        });

        // 3. Power Ranking: Agrupar puntos por operario
        const operatorEffortMap = {};
        processedStats.forEach(order => {
          const op = order.deliveredBy || 'Anónimo';
          if (!operatorEffortMap[op]) {
            operatorEffortMap[op] = { deliveries: 0, totalPoints: 0 };
          }
          operatorEffortMap[op].deliveries++;
          operatorEffortMap[op].totalPoints += order.effortPoints;
        });

        const operatorPerformance = Object.entries(operatorEffortMap)
          .map(([name, stats]) => ({
            name,
            deliveries: stats.deliveries,
            points: Math.round(stats.totalPoints), // Esto es lo que vamos a mostrar ahora
            // REEMPLAZO QUIRÚRGICO EN KPIView (para que 100% sea cumplir el tiempo)
            efficiency: Math.round((stats.onTimeCount / stats.deliveries) * 100)// REEMPLAZO QUIRÚRGICO EN KPIView (para que 100% sea cumplir el tiempo)

          }))
          .sort((a, b) => b.points - a.points); // Gomez vuelve arriba por sus puntos!
        // KPI: Porcentaje de éxito sobre SLA
        const slaSuccess = Math.round((processedStats.filter(s => s.onTime).length / processedStats.length) * 100) || 0;
        // --- CÁLCULOS PROFESIONALES POST-PROCESAMIENTO ---

        // 1. Porcentaje de Éxito (SLA %)
        const totalDelivered = processedStats.length;
        const onTimeCount = processedStats.filter(s => s.onTime).length;
        const slaPercent = totalDelivered > 0 ? Math.round((onTimeCount / totalDelivered) * 100) : 0;

        // 2. Power Ranking por Esfuerzo (Justicia Operativa)
        const rankingMap = {};
        processedStats.forEach(s => {
          const op = s.deliveredBy || 'S/A';
          rankingMap[op] = (rankingMap[op] || 0) + s.effortPoints;
        });


        // 3. Actualizamos el estado final
        setKpiData(prev => ({
          ...prev,
          operatorPerformance, // Ahora basado en Puntos de Esfuerzo
          overallLeadTime: avgLeadTime,
          deliveriesToday: totalDelivered,
          slaSuccessRate: slaPercent // Nuevo campo para tu UI
        }));
        // KPI: Power Ranking por Esfuerzo (No por cantidad)
        const ranking = {};
        processedStats.forEach(s => {
          ranking[s.deliveredBy] = (ranking[s.deliveredBy] || 0) + s.effortPoints;
        });

        // 2. Calculamos el % de Éxito General (SLA)
        const totalSuccess = processedStats.filter(s => s.isSuccess).length;
        const successRate = Math.round((totalSuccess / processedStats.length) * 100);

        // 3. Ranking de Operarios por "Puntos de Esfuerzo" (Justicia Operativa)
        const operatorEffort = {};
        processedStats.forEach(s => {
          const op = s.deliveredBy;
          if (!operatorEffort[op]) operatorEffort[op] = 0;
          operatorEffort[op] += s.effortPoints;
        });
        // 3. Rendimiento por Operario
        const operatorStats = {};
        deliveredOrders.forEach(order => {
          if (order.deliveredBy) {
            const op = order.deliveredBy;
            if (!operatorStats[op]) {
              operatorStats[op] = {
                deliveries: 0,
                totalLeadTime: 0,
                leadTimes: []
              };
            }
            operatorStats[op].deliveries++;

            if (order.timestamp && order.deliveredAt) {
              const leadTime = (order.deliveredAt.toMillis() - order.timestamp.toMillis()) / 60000;
              operatorStats[op].totalLeadTime += leadTime;
              operatorStats[op].leadTimes.push(leadTime);
            }
          }
        });


        const materialStats = {};
        deliveredOrders.forEach(order => {
          const material = order.partNumber;
          if (!materialStats[material]) {
            materialStats[material] = {
              count: 0,
              totalLeadTime: 0,
              description: order.description || 'Sin descripción'
            };
          }
          materialStats[material].count++;

          if (order.timestamp && order.deliveredAt) {
            const leadTime = (order.deliveredAt.toMillis() - order.timestamp.toMillis()) / 60000;
            materialStats[material].totalLeadTime += leadTime;
          }
        });

        const materialArray = Object.entries(materialStats)
          .map(([partNumber, stats]) => ({
            partNumber,
            description: stats.description,
            frequency: stats.count,
            avgLeadTime: stats.count > 0
              ? Math.round(stats.totalLeadTime / stats.count)
              : 0
          }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 10); // Top 10 materiales

        // 5. Distribución por hora
        const hourlyDistribution = Array(24).fill(0);
        deliveredOrders.forEach(order => {
          if (order.deliveredAt) {
            const hour = order.deliveredAt.toDate().getHours();
            hourlyDistribution[hour]++;
          }
        });

        // 6. Órdenes actuales
        const pendingOrders = allOrders.filter(o => o.status === 'PENDING').length;
        const inTransitOrders = allOrders.filter(o => o.status === 'IN_TRANSIT').length;

        // 7. Top performers y materiales problemáticos
        const topPerformers = [...operatorPerformance]
          .sort((a, b) => b.efficiency - a.efficiency)
          .slice(0, 5);

        const problemMaterials = [...materialArray]
          .filter(m => m.frequency >= 3) // Al menos 3 ocurrencias
          .sort((a, b) => b.avgLeadTime - a.avgLeadTime)
          .slice(0, 5);

        setKpiData({
          overallLeadTime: avgLeadTime,
          deliveriesToday: deliveredOrders.length,
          pendingOrders,
          inTransitOrders,
          operatorPerformance,
          materialStats: materialArray,
          hourlyDistribution,
          avgTimeByStage: {
            creationToDispatch: avgCreationToDispatch,
            dispatchToDelivery: avgDispatchToDelivery,
            total: avgLeadTime
          },
          topPerformers,
          problemMaterials
        });

      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKPIs();
    const interval = setInterval(fetchKPIs, 60000); // Actualizar cada minuto
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros de tiempo */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard de Estadísticas</h1>
          <p className="text-gray-400">Métricas de rendimiento en tiempo real</p>
        </div>

        <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg p-1">
          {['today', 'week', 'month', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${timeRange === range
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
              {range === 'today' ? 'Hoy' :
                range === 'week' ? 'Semana' :
                  range === 'month' ? 'Mes' : 'Todo'}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Lead Time Promedio</p>
              <p className="text-3xl font-bold text-white">{kpiData.overallLeadTime}<span className="text-lg text-gray-400">min</span></p>
            </div>
          </div>
          <div className="text-xs text-blue-300">
            {kpiData.avgTimeByStage.creationToDispatch}min prep + {kpiData.avgTimeByStage.dispatchToDelivery}min entrega
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Entregas ({timeRange})</p>
              <p className="text-3xl font-bold text-white">{kpiData.deliveriesToday}</p>
            </div>
          </div>
          <div className="text-xs text-green-300">Completadas en el período</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Truck className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-sm text-gray-400">En Proceso</p>
              <p className="text-3xl font-bold text-white">{kpiData.pendingOrders + kpiData.inTransitOrders}</p>
            </div>
          </div>
          <div className="text-xs text-yellow-300">
            {kpiData.pendingOrders} pendientes + {kpiData.inTransitOrders} en tránsito
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-sm text-gray-400">Operarios Activos</p>
              <p className="text-3xl font-bold text-white">{kpiData.operatorPerformance.length}</p>
            </div>
          </div>
          <div className="text-xs text-purple-300">Realizando entregas</div>
        </div>
      </div>

      {/* Sección principal con tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: Rendimiento por Operario */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <User className="w-6 h-6 text-green-400" />
                Rendimiento por Operario
              </h2>
              <span className="text-sm text-gray-400">Top {kpiData.operatorPerformance.length}</span>
            </div>

            <div className="space-y-4">
              {kpiData.operatorPerformance.map((op, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${idx === 0 ? 'bg-yellow-500/20' :
                      idx === 1 ? 'bg-gray-500/20' :
                        idx === 2 ? 'bg-orange-500/20' : 'bg-gray-800/50'
                      }`}>
                      <span className={`font-bold ${idx === 0 ? 'text-yellow-400' :
                        idx === 1 ? 'text-gray-400' :
                          idx === 2 ? 'text-orange-400' : 'text-gray-500'
                        }`}>
                        #{idx + 1}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-white capitalize">{op.name}</p>
                      <p className="text-xs text-gray-400">{op.deliveries} entregas • {op.avgLeadTime} min promedio</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-400">{op.deliveries}</div>
                    <div className="text-xs text-gray-400">entregas</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Materiales más solicitados */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-400" />
              Materiales Más Solicitados
            </h2>
            <div className="space-y-4">
              {kpiData.materialStats.map((mat, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <span className="font-bold text-blue-400">#{idx + 1}</span>
                    </div>
                    <div>
                      <p className="font-mono font-bold text-white">{mat.partNumber}</p>
                      <p className="text-xs text-gray-400">{mat.description}</p>
                      <p className="text-xs text-gray-500">{mat.avgLeadTime} min promedio</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-400">{mat.frequency}</div>
                    <div className="text-xs text-gray-400">solicitudes</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha: Métricas detalladas */}
        <div className="space-y-6">
          {/* Tiempos por etapa */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="w-6 h-6 text-purple-400" />
              Tiempos por Etapa
            </h2>
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Preparación</span>
                  <span className="font-bold text-purple-400">{kpiData.avgTimeByStage.creationToDispatch} min</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full"
                    style={{ width: `${Math.min((kpiData.avgTimeByStage.creationToDispatch / kpiData.avgTimeByStage.total) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-300">Entrega</span>
                  <span className="font-bold text-blue-400">{kpiData.avgTimeByStage.dispatchToDelivery} min</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min((kpiData.avgTimeByStage.dispatchToDelivery / kpiData.avgTimeByStage.total) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-4 border border-green-500/20">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 font-bold">Total</span>
                  <span className="font-bold text-green-400 text-xl">{kpiData.avgTimeByStage.total} min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="w-6 h-6 text-yellow-400" />
              Top Eficiencia
            </h2>
            <div className="space-y-4">
              {kpiData.topPerformers.map((op, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
                      <span className="font-bold text-yellow-400">#{idx + 1}</span>
                    </div>
                    <div>
                      <p className="font-bold text-white capitalize">{op.name}</p>
                      <p className="text-xs text-gray-400">{op.avgLeadTime} min promedio</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-yellow-400">{op.efficiency}%</div>
                    <div className="text-xs text-gray-400">eficiencia</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Materiales Problemáticos */}
          {kpiData.problemMaterials.length > 0 && (
            <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-red-800/50 p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                Materiales con Mayor Lead Time
              </h2>
              <div className="space-y-4">
                {kpiData.problemMaterials.map((mat, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4 border border-red-500/20">
                    <div>
                      <p className="font-mono font-bold text-white text-sm">{mat.partNumber}</p>
                      <p className="text-xs text-gray-400 truncate max-w-[120px]">{mat.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-red-400">{mat.avgLeadTime} min</div>
                      <div className="text-xs text-gray-400">promedio</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Gráfico simple de distribución horaria */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-2xl border border-gray-800 p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Clock className="w-6 h-6 text-blue-400" />
          Distribución de Entregas por Hora
        </h2>
        <div className="flex items-end justify-between h-48 pt-6 border-t border-gray-800">
          {kpiData.hourlyDistribution.map((count, hour) => (
            <div key={hour} className="flex flex-col items-center flex-1 mx-1">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-600 rounded-t-lg transition-all hover:opacity-80"
                style={{ height: `${(count / Math.max(...kpiData.hourlyDistribution)) * 80 || 0}%` }}
                title={`${count} entregas a las ${hour}:00`}
              ></div>
              <span className="text-xs text-gray-500 mt-2">{hour}:00</span>
            </div>
          ))}
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
        // BUSCÁ EL "else if (newStatus === 'DELIVERED')" Y REEMPLAZALO POR ESTE:
      } else if (newStatus === 'DELIVERED') {
        const orderRef = doc(db, 'active_orders', orderId);
        const orderSnap = await getDoc(orderRef);

        if (orderSnap.exists()) {
          const data = orderSnap.data();
          const userName = currentUser.email.split('@')[0];

          // 1. CREAMOS el documento en la carpeta nueva (completed_orders)
          await addDoc(collection(db, 'completed_orders'), {
            ...data,
            status: 'DELIVERED',
            deliveredAt: serverTimestamp(),
            deliveredBy: userName,
            // Convertimos los strings a números para que los KPIs no rompan
            complexityWeight: parseInt(data.complexityWeight || 1),
            targetLeadTime: parseInt(data.targetLeadTime || 30),
            finalLeadTimeMinutes: Math.round((Date.now() - data.timestamp.toMillis()) / 60000)
          });

          // 2. BORRAMOS el original de active_orders (Asegurate de importar deleteDoc arriba)
          await deleteDoc(orderRef);
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