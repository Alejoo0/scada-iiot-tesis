const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { InfluxDB } = require('@influxdata/influxdb-client');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());


// 1. CONFIGURACIÓN: PostgreSQL

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME, 
  password: process.env.DB_PASSWORD, 
  port: process.env.DB_PORT
});

const JWT_SECRET = process.env.JWT_SECRET;
// 2. CONFIGURACIÓN: InfluxDB

const url = process.env.INFLUX_URL;
const token = process.env.INFLUX_TOKEN; 
const org = process.env.INFLUX_ORG;

// Buckets para cada planta
const bucketPlanta01 = process.env.INFLUX_BUCKET;
const bucketPlanta02 = process.env.INFLUX_BUCKET_P02;

const influxClient = new InfluxDB({ url, token });
const queryApi = influxClient.getQueryApi(org);


// ENDPOINT GLOBAL: LOGIN

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ auth: false, message: 'Usuario no encontrado' });
    }

    const usuario = result.rows[0];

    if (password !== usuario.password_hash) {
      return res.status(401).json({ auth: false, message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: usuario.id, role: usuario.rol, endpoint: usuario.endpoint_node_red }, 
      JWT_SECRET, 
      { expiresIn: '2h' }
    );

    res.json({
      auth: true,
      token: token,
      user: {
        username: usuario.username,
        role: usuario.rol,
        endpoint: usuario.endpoint_node_red,
        planta_asignada: usuario.planta_asignada 
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error en el servidor de autenticación' });
  }
});


// SIMULACION A: PLANTA 01 (CAJAS POR TAMAÑO)

app.get('/api/factory/telemetria', async (req, res) => {
  try {
    const fluxQuery = `
      from(bucket: "${bucketPlanta01}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "contadores" or r._measurement == "sensores" or r._measurement == "estado")
        |> last()
    `;
    
    let data = {
      cajas_pequenas: 0,
      cajas_grandes: 0,
      correa_principal: 0,
      correa_izquierda: 0,
      correa_derecha: 0,
      state_reset: 0,
      state_running: 0,
      state_stopping: 0
    };

    for await (const {values, tableMeta} of queryApi.iterateRows(fluxQuery)) {
      const o = tableMeta.toObject(values);
      data[o._field] = o._value; 
    }
    
    res.json(data);
  } catch (error) {
    console.error("Error consultando InfluxDB Planta 01:", error);
    res.status(500).json({ error: "Falla al obtener telemetría P1" });
  }
});

app.post('/api/factory/control', async (req, res) => {
  const { comando, username } = req.body; 
  const nodeRedUrl = process.env.NODERED_URL || 'http://127.0.0.1:1880/api/comando-planta';
  try {
    await pool.query(
      `INSERT INTO historial_comandos (username, planta, dispositivo, comando, fecha_ejecucion) VALUES ($1, $2, $3, $4, NOW())`,
      [username || 'operador_planta01', 'planta_01', 'linea_clasificacion', comando]
    );
    const response = await fetch(nodeRedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: comando })
    });
    if (!response.ok) throw new Error(`Node-RED respondió con estado: ${response.status}`);
    res.json({ success: true, message: `Comando ${comando} registrado y enviado.` });
  } catch (error) {
    console.error("Error en endpoint control P1:", error);
    res.status(500).json({ error: "Falla al procesar la maniobra de control P1" });
  }
});

app.get('/api/factory/historial-comandos', async (req, res) => {
  try {
    const query = `
      SELECT username, comando, to_char(fecha_ejecucion, 'DD-MM-YYYY HH24:MI:SS') as hora 
      FROM historial_comandos 
      WHERE planta = 'planta_01'
      ORDER BY fecha_ejecucion DESC LIMIT 50
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener el historial de auditoría P1" });
  }
});


// SIMULACION B : PLANTA 02 (CAJAS POR PESO ANALÓGICO)

app.get('/api/planta02/telemetria', async (req, res) => {
  try {
    const fluxQuery = `
      from(bucket: "${bucketPlanta02}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "contadores" or r._measurement == "sensores" or r._measurement == "estado")
        |> last()
    `;
    
    let data = {
      peso_kg: 0.00,
      cajas_derecha: 0,
      cajas_adelante: 0,
      cajas_izquierda: 0,
      state_running: 0,   // Feedback de START
      state_stopping: 0,  // Feedback de STOP
      state_reset: 0,     // Feedback de RESET
      state_auto: 0,      // Feedback de AUTO
      correa_entrada: 0,
      correa_izquierda: 0,
      correa_derecha: 0,
      correa_frente: 0       
    };

    for await (const {values, tableMeta} of queryApi.iterateRows(fluxQuery)) {
      const o = tableMeta.toObject(values);
      data[o._field] = o._value; 
    }
    res.json(data);
  } catch (error) {
    console.error("Error consultando InfluxDB Planta 02:", error);
    res.status(500).json({ error: "Falla al obtener telemetría P2" });
  }
});

app.post('/api/planta02/control', async (req, res) => {
  const { comando, username } = req.body; 
  const nodeRedUrlP2 = process.env.NODERED_P2_URL || 'http://127.0.0.1:1880/api/comando-planta02';
  
  try {
    await pool.query(
      `INSERT INTO historial_comandos (username, planta, dispositivo, comando, fecha_ejecucion) VALUES ($1, $2, $3, $4, NOW())`,
      [username || 'operador_planta02', 'planta_02', 'estacion_pesaje', comando]
    );
    const response = await fetch(nodeRedUrlP2, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: comando })
    });
    if (!response.ok) throw new Error(`Node-RED P2 respondió con estado: ${response.status}`);
    res.json({ success: true, message: `Comando ${comando} registrado y enviado a P2.` });
  } catch (error) {
    console.error("Error en endpoint control P2:", error);
    res.status(500).json({ error: "Falla al procesar la maniobra de control P2" });
  }
});

app.get('/api/planta02/historial-comandos', async (req, res) => {
  try {
    const query = `
      SELECT username, comando, to_char(fecha_ejecucion, 'DD-MM-YYYY HH24:MI:SS') as hora 
      FROM historial_comandos 
      WHERE planta = 'planta_02'
      ORDER BY fecha_ejecucion DESC LIMIT 50
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "No se pudo obtener el historial de auditoría P2" });
  }
});


// ARRANQUE DEL SERVIDOR

const PORT = process.env.PORT;

const server = app.listen(PORT, () => {
  console.log(`servidor corriendo en el puerto ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(` ERROR: El puerto ${PORT} ya está siendo usado por otro programa.`);
  } else {
    console.error(' Error fatal en el servidor Express:', error);
  }
});

process.on('uncaughtException', (err) => {
  console.error(' Excepción no controlada en el código:', err);
});