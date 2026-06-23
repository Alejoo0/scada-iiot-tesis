import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext'; 
import { Play, Square, RotateCcw, Scale, Activity, Clock, Server, ArrowRight, ArrowLeft, ArrowUp, BarChart3, ToggleLeft, ToggleRight, ListFilter } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, Cell } from 'recharts';

// Función súper estricta para evaluar señales del PLC (Limpia espacios, strings y booleanos)
const isStateActive = (value) => {
  if (value === 1 || value === true) return true;
  if (typeof value === 'string') {
    const cleanVal = value.trim().toLowerCase();
    return cleanVal === '1' || cleanVal === 'true' || cleanVal === 'on';
  }
  return false;
};

export default function WeightView() {
  const { user, logout } = useAuth();
  
  // 1. ESTADO DE TELEMETRÍA (Se agregan las 4 correas)
  const [telemetria, setTelemetria] = useState({
    peso_kg: 0.00,
    cajas_derecha: 0,   
    cajas_delantera: 0,  
    cajas_izquierda: 0,
    state_auto: 0,
    state_reset: 0,
    state_running: 0,
    state_stopping: 0,
    correa_entrada: false,
    correa_izquierda: false,
    correa_derecha: false,
    correa_frente: false
  });

  const [historicoPeso, setHistoricoPeso] = useState([]);
  const [historialComandos, setHistorialComandos] = useState([]);
  
  const [isOperating, setIsOperating] = useState(false);
  const operatingShield = useRef(false); // Escudo síncrono

  // Estados visuales mapeados directamente desde la base de datos
  const [isAuto, setIsAuto] = useState(false);
  const [estadoProceso, setEstadoProceso] = useState('DETENIDO');

  // El cronómetro sí necesita memoria local ya que el PLC no nos envía el "uptime"
  const [tiempoActivo, setTiempoActivo] = useState(() => {
    return parseInt(localStorage.getItem('scada_p2_time')) || 0;
  }); 

  useEffect(() => {
    localStorage.setItem('scada_p2_time', tiempoActivo);
  }, [tiempoActivo]);

  const fetchCommandsLog = async () => {
    try {
      const res = await fetch('http://136.114.30.62:5000/api/planta02/historial-comandos');
      if (res.ok) {
        const data = await res.json();
        setHistorialComandos(data);
      }
    } catch (error) {
      console.error("Error leyendo log de comandos P2:", error);
    }
  };

  // 2. POLLING ESTRICTO: InfluxDB manda sobre la interfaz
  useEffect(() => {
    fetchCommandsLog(); 

    const fetchTelemetria = async () => {
      try {
        const res = await fetch('http://136.114.30.62:5000/api/planta02/telemetria');
        if (res.ok) {
          const data = await res.json();
          setTelemetria(prev => ({ ...prev, ...data }));

          if (!operatingShield.current) {
            // A. Sincronizar Modo Automático
            if (data.state_auto !== undefined) {
              setIsAuto(isStateActive(data.state_auto));
            }

            // B. Sincronizar Estado de Marcha
            if (isStateActive(data.state_running)) {
              setEstadoProceso('EN MARCHA');
            } else if (isStateActive(data.state_stopping)) {
              setEstadoProceso('DETENIDO');
            } else if (isStateActive(data.state_reset)) {
              setEstadoProceso('REINICIANDO');
            }
          }

          // Gráfico en tiempo real
          const timestamp = new Date().toLocaleTimeString('es-CL', { hour12: false });
          setHistoricoPeso(prev => {
            const nuevoDato = { tiempo: timestamp, Peso: parseFloat(data.peso_kg) || 0.00 };
            return [...prev, nuevoDato].slice(-30);
          });
        }
      } catch (error) {
        console.error("Error al obtener telemetría P2", error);
      }
    };

    fetchTelemetria(); 
    const intervalId = setInterval(fetchTelemetria, 1000);
    return () => clearInterval(intervalId); 
  }, []); 

  // 3. Cronómetro de Uptime
  useEffect(() => {
    let timer;
    if (estadoProceso === 'EN MARCHA') {
      timer = setInterval(() => setTiempoActivo(prev => prev + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [estadoProceso]);

  // 4. Envío de comandos: Actualización optimista + Escudo Temporal
  const handleControl = async (comando) => {
    setIsOperating(true);
    operatingShield.current = true; 

    // Optimismo visual
    if (comando === 'START') { setEstadoProceso('EN MARCHA'); }
    if (comando === 'STOP') { setEstadoProceso('DETENIDO'); }
    if (comando === 'RESET') { setTiempoActivo(0); localStorage.setItem('scada_p2_time', 0); }
    if (comando === 'AUTO_ON') { setIsAuto(true); }
    if (comando === 'AUTO_OFF') { setIsAuto(false); }

    try {
      const res = await fetch('http://136.114.30.62:5000/api/planta02/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comando, username: user?.username })
      });
      
      if (!res.ok) throw new Error("Falla en respuesta del backend Express");
      
      fetchCommandsLog();

      setTimeout(() => { 
        setIsOperating(false); 
        operatingShield.current = false; 
      }, 2500);

    } catch (error) {
      console.error("Error al enviar comando", error);
      setIsOperating(false);
      operatingShield.current = false; 
    }
  };

  const totalCajas = telemetria.cajas_derecha + telemetria.cajas_delantera + telemetria.cajas_izquierda;
  const horasTrabajadas = tiempoActivo > 0 ? (tiempoActivo / 3600) : 0;
  const rendimientoTotal = horasTrabajadas > 0 ? (totalCajas / horasTrabajadas).toFixed(0) : 0;

  const formatTime = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const dataDistribucion = [
    { nombre: 'Ligeras (8kg)', cantidad: telemetria.cajas_derecha, color: '#3b82f6' },
    { nombre: 'Medias (10kg)', cantidad: telemetria.cajas_delantera, color: '#f59e0b' },
    { nombre: 'Pesadas (15kg)', cantidad: telemetria.cajas_izquierda, color: '#ef4444' }
  ];

  return (
    <div style={styles.dashboardContainer}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Server size={24} color="#0284c7" />
          <h2 style={styles.headerTitle}>Clasificadora por Peso Analógico</h2>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.badge(estadoProceso === 'EN MARCHA' ? '#10b981' : estadoProceso === 'REINICIANDO' ? '#f59e0b' : '#64748b')}>
            {estadoProceso}
          </span>
          <button onClick={logout} style={styles.logoutButton}>Salir</button>
        </div>
      </header>

      <main style={styles.mainGrid}>
        
        {/* PANEL DE CONTROL CENTRAL Y MODO AUTO */}
        <section style={{...styles.card, gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h3 style={styles.cardTitle}>Panel de Mando</h3>
            
            <div 
              style={{
                ...styles.toggleContainer, 
                opacity: isOperating ? 0.6 : 1, 
                pointerEvents: isOperating ? 'none' : 'auto'
              }} 
              onClick={() => handleControl(isAuto ? 'AUTO_OFF' : 'AUTO_ON')}
            >
              <span style={{ fontWeight: 600, color: isAuto ? '#94a3b8' : '#0f172a' }}>MANUAL</span>
              {isAuto ? <ToggleRight size={36} color="#10b981" /> : <ToggleLeft size={36} color="#64748b" />}
              <span style={{ fontWeight: 600, color: isAuto ? '#10b981' : '#94a3b8' }}>AUTO</span>
            </div>
          </div>

          <div style={styles.controlGroup}>
            <button 
              disabled={!isAuto || estadoProceso === 'EN MARCHA' || isOperating} 
              onClick={() => handleControl('START')} 
              style={{...styles.btnStart, opacity: (!isAuto || estadoProceso === 'EN MARCHA' || isOperating) ? 0.5 : 1}}
            >
              <Play size={18} /> INICIAR LÍNEA
            </button>
            <button 
              disabled={estadoProceso === 'DETENIDO' || isOperating} 
              onClick={() => handleControl('STOP')} 
              style={{...styles.btnStop, opacity: (estadoProceso === 'DETENIDO' || isOperating) ? 0.5 : 1}}
            >
              <Square size={18} /> DETENER
            </button>
            <button disabled={isOperating} onClick={() => handleControl('RESET')} style={{...styles.btnReset, opacity: isOperating ? 0.5 : 1}}>
              <RotateCcw size={18} /> REINICIAR CONTADORES
            </button>
          </div>
          {!isAuto && <p style={{color: '#ef4444', fontSize: '13px', margin: 0, textAlign: 'center'}}>* El sistema debe estar en modo AUTO para iniciar la faja transportadora.</p>}
        </section>

        {/* BÁSCULA */}
        <section style={{...styles.card, gridColumn: 'span 1', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <h3 style={styles.cardTitle}>Báscula Dinámica</h3>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '8px', margin: '20px 0' }}>
            <Scale size={48} color={telemetria.peso_kg > 1 ? '#0ea5e9' : '#cbd5e1'} />
            <span style={{ fontSize: '56px', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>
              {Number(telemetria.peso_kg).toFixed(2)}
            </span>
            <span style={{ fontSize: '24px', fontWeight: '600', color: '#64748b' }}>kg</span>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Lectura instantánea desde TIA Portal</p>
        </section>

        {/* KPIs */}
        <section style={{...styles.card, gridColumn: 'span 2'}}>
          <h3 style={styles.cardTitle}>Rendimiento de Clasificación</h3>
          <div style={styles.kpiGrid}>
            <div style={styles.kpiBox}>
              <span style={styles.kpiLabel}>Uptime (Operativo)</span>
              <div style={styles.kpiValueRow}><Clock size={20} color="#64748b" /><span style={styles.kpiNumber}>{formatTime(tiempoActivo)}</span></div>
            </div>
            <div style={styles.kpiBox}>
              <span style={styles.kpiLabel}>Tasa de Procesamiento</span>
              <div style={styles.kpiValueRow}><Activity size={20} color="#10b981" /><span style={styles.kpiNumber}>{rendimientoTotal} <span style={{fontSize:'12px', color:'#64748b'}}>uds/h</span></span></div>
            </div>
            <div style={styles.kpiBox}>
              <span style={styles.kpiLabel}>Total Acumulado</span>
              <div style={styles.kpiValueRow}><BarChart3 size={20} color="#0f172a" /><span style={styles.kpiNumber}>{totalCajas} <span style={{fontSize:'12px', color:'#64748b'}}>cajas</span></span></div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center' }}>
              <ArrowLeft size={24} color="#ef4444" style={{margin:'0 auto'}}/>
              <span style={{ display:'block', fontSize:'12px', color:'#64748b', marginTop:'5px' }}>Pesadas (&gt; 15kg)</span>
              <strong style={{ fontSize:'20px', color:'#0f172a' }}>{telemetria.cajas_izquierda}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <ArrowUp size={24} color="#f59e0b" style={{margin:'0 auto'}}/>
              <span style={{ display:'block', fontSize:'12px', color:'#64748b', marginTop:'5px' }}>Medias (~ 10kg)</span>
              <strong style={{ fontSize:'20px', color:'#0f172a' }}>{telemetria.cajas_delantera}</strong>
            </div>
            <div style={{ textAlign: 'center' }}>
              <ArrowRight size={24} color="#3b82f6" style={{margin:'0 auto'}}/>
              <span style={{ display:'block', fontSize:'12px', color:'#64748b', marginTop:'5px' }}>Ligeras (~ 8kg)</span>
              <strong style={{ fontSize:'20px', color:'#0f172a' }}>{telemetria.cajas_derecha}</strong>
            </div>
          </div>
        </section>

        {/* ⚙️ NUEVO: MONITOREO DE ACTUADORES (CORREAS) */}
        <section style={{...styles.card, gridColumn: '1 / -1'}}>
          <h3 style={styles.cardTitle}>Estado de Actuadores</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px', marginTop: '10px' }}>
            <div style={styles.actuatorBox(isStateActive(telemetria.correa_entrada))}>
              <span style={styles.actuatorLabel}>Correa Entrada</span>
              <strong style={{ fontSize: '15px' }}>{isStateActive(telemetria.correa_entrada) ? 'TRABAJANDO' : 'DETENIDA'}</strong>
            </div>
            <div style={styles.actuatorBox(isStateActive(telemetria.correa_izquierda))}>
              <span style={styles.actuatorLabel}>Correa Izquierda (Pesadas)</span>
              <strong style={{ fontSize: '15px' }}>{isStateActive(telemetria.correa_izquierda) ? 'TRABAJANDO' : 'DETENIDA'}</strong>
            </div>
            <div style={styles.actuatorBox(isStateActive(telemetria.correa_frente))}>
              <span style={styles.actuatorLabel}>Correa Frente (Medias)</span>
              <strong style={{ fontSize: '15px' }}>{isStateActive(telemetria.correa_frente) ? 'TRABAJANDO' : 'DETENIDA'}</strong>
            </div>
            <div style={styles.actuatorBox(isStateActive(telemetria.correa_derecha))}>
              <span style={styles.actuatorLabel}>Correa Derecha (Ligeras)</span>
              <strong style={{ fontSize: '15px' }}>{isStateActive(telemetria.correa_derecha) ? 'TRABAJANDO' : 'DETENIDA'}</strong>
            </div>
          </div>
        </section>

        {/* GRÁFICOS */}
        <section style={{...styles.card, gridColumn: 'span 2'}}>
          <h3 style={styles.cardTitle}>Curva de Carga de Báscula (Tiempo Real)</h3>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicoPeso} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPeso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="tiempo" stroke="#64748b" fontSize={11} tickMargin={10} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 20]} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Area type="monotone" dataKey="Peso" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorPeso)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section style={{...styles.card, gridColumn: 'span 1'}}>
          <h3 style={styles.cardTitle}>Distribución por Categoría</h3>
          <div style={{ width: '100%', height: '250px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataDistribucion} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="nombre" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {dataDistribucion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* TABLA POSTGRESQL */}
        <section style={{ ...styles.card, gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
            <ListFilter size={18} color="#64748b" />
            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' }}>
              Registro de Auditoría de Planta
            </h3>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '220px' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.tableHeaderCell}>Operador</th>
                  <th style={styles.tableHeaderCell}>Acción Realizada</th>
                  <th style={styles.tableHeaderCell}>Estampa de Tiempo (Timestamp)</th>
                </tr>
              </thead>
              <tbody>
                {historialComandos.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={styles.tableNoDataCell}>
                      No se registran maniobras de control en el turno actual.
                    </td>
                  </tr>
                ) : (
                  historialComandos.map((item, index) => (
                    <tr key={index} style={styles.tableBodyRow(index)}>
                      <td style={styles.tableBodyCell}>
                        <span style={styles.operatorBadge}>{item.username}</span>
                      </td>
                      <td style={styles.tableBodyCell}>
                        <strong style={styles.commandText(item.comando)}>{item.comando}</strong>
                      </td>
                      <td style={styles.tableBodyCell}>
                        {item.hora}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}

const styles = {
  dashboardContainer: { minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingBottom: '40px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '15px 30px', borderBottom: '1px solid #e2e8f0' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerTitle: { margin: 0, fontSize: '18px', color: '#0f172a' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '15px' },
  badge: (color) => ({ backgroundColor: color, color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }),
  logoutButton: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#f8fafc' },
  mainGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', padding: '25px', maxWidth: '1400px', margin: '0 auto' },
  card: { backgroundColor: '#fff', borderRadius: '8px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  cardTitle: { margin: '0 0 15px 0', fontSize: '14px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700' },
  toggleContainer: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '5px 10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', userSelect: 'none' },
  controlGroup: { display: 'flex', gap: '15px' },
  btnStart: { flex: 1, display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  btnStop: { flex: 1, display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', padding: '15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  btnReset: { flex: 1, display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', padding: '15px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' },
  kpiBox: { backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' },
  kpiLabel: { fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '8px' },
  kpiValueRow: { display: 'flex', alignItems: 'center', gap: '10px' },
  kpiNumber: { fontSize: '24px', fontWeight: '800', color: '#0f172a' },
  
  // NUEVOS ESTILOS PARA LOS ACTUADORES
  actuatorBox: (isActive) => ({ flex: 1, padding: '15px', borderRadius: '6px', backgroundColor: isActive ? '#ecfdf5' : '#f8fafc', border: `1px solid ${isActive ? '#10b981' : '#e2e8f0'}`, textAlign: 'center', color: isActive ? '#065f46' : '#64748b', transition: 'all 0.2s ease-in-out' }),
  actuatorLabel: { display: 'block', fontSize: '11px', marginBottom: '5px', textTransform: 'uppercase', fontWeight: '700' },
  
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '10px' },
  tableHeaderRow: { borderBottom: '2px solid #e2e8f0', backgroundColor: '#f8fafc' },
  tableHeaderCell: { padding: '12px 16px', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  tableBodyRow: (index) => ({ borderBottom: '1px solid #f1f5f9', backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }),
  tableBodyCell: { padding: '12px 16px', fontSize: '14px', color: '#1e293b' },
  tableNoDataCell: { padding: '20px', textStyle: 'italic', color: '#64748b', textAlign: 'center', fontSize: '14px' },
  operatorBadge: { backgroundColor: '#e2e8f0', color: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' },
  commandText: (cmd) => {
    let color = '#475569';
    if (cmd === 'START') color = '#10b981';
    if (cmd === 'STOP') color = '#ef4444';
    if (cmd === 'RESET') color = '#f59e0b';
    if (cmd === 'AUTO_ON') color = '#0284c7';
    return { color, fontWeight: '700' };
  }
};