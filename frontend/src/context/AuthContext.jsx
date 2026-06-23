import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Estado para verificar sesión al cargar la página

  // Cada vez que la app se abre, revisamos si ya había un token guardado
  useEffect(() => {
    const token = localStorage.getItem('token_iiot');
    const savedUser = localStorage.getItem('user_iiot');
    
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Función de Login conectada al Backend Central (Express + PostgreSQL)
  const login = async (username, password) => {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.auth) {
        // Guardamos los datos del usuario y el token en el navegador
        localStorage.setItem('token_iiot', data.token);
        localStorage.setItem('user_iiot', JSON.stringify(data.user));
        
        // Actualizamos el estado global de React
        // data.user contiene: { username, role, planta_asignada }
        setUser(data.user); 
        
        return { success: true, role: data.user.role };
      } else {
        return { success: false, message: data.message || 'Credenciales inválidas' };
      }
    } catch (error) {
      console.error('Error en AuthContext:', error);
      return { success: false, message: 'No se pudo conectar con el servidor de autenticación.' };
    }
  };

  // Función para cerrar sesión de forma segura
  const logout = () => {
    localStorage.removeItem('token_iiot');
    localStorage.removeItem('user_iiot');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};