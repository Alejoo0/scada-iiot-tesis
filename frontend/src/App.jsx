import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './views/Login';
import LogoView from './views/WeightView';
import SortingView from './views/SortingView';

// 1. Protector de Rutas basado en Planta Asignada
const ProtectedRoute = ({ children, allowedPlant }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  // Ahora validamos hacia qué planta está asignado el usuario
  if (allowedPlant && user.planta_asignada !== allowedPlant) {
    return <Navigate to="/login" replace />;
  } 
  
  return children;
};

function AppContent() {
  const { user } = useAuth();

  return (
    <Router>
      <div style={styles.appStructure}>
        <Routes>
          {/* RUTA DE LOGIN */}
          <Route path="/login" element={<Login />} />
          
          {/* RUTA RAÍZ (/): Redirige dinámicamente según la planta asignada en la BD */}
          <Route 
            path="/" 
            element={
              user ? (
                user.planta_asignada === 'planta_02' ? (
                  <Navigate to="/dashboard-planta02" replace />
                ) : user.planta_asignada === 'planta_01' ? (
                  <Navigate to="/dashboard-planta01" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          
          {/* PANEL PLC LOGO! */}
          <Route 
            path="/dashboard-planta02" 
            element={
              <ProtectedRoute allowedPlant="planta_02">
                <LogoView />
              </ProtectedRoute>
            } 
          />
          
          {/* PANEL FACTORY I/O - Bloqueado exclusivamente para 'planta_01' */}
          <Route 
            path="/dashboard-planta01" 
            element={
              <ProtectedRoute allowedPlant="planta_01">
                <SortingView />
              </ProtectedRoute>
            } 
          />
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = {
  appStructure: {
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
    minHeight: '100vh',
    backgroundColor: '#f4f6f9'
  }
};