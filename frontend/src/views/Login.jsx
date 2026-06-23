import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ShieldAlert, Loader2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!username.trim() || !password.trim()) {
      setError('Por favor, complete todos los campos.');
      setIsLoading(false);
      return;
    }

    try {
      // Conexión con el AuthContext global y el backend en Express
      const result = await login(username, password);
      
      if (result.success) {
        // Redirección centralizada: Mandamos a la raíz y dejamos que App.jsx 
        // evalúe "planta_asignada" y decida si va a Factory I/O o al PLC Logo.
        navigate('/');
      } else {
        setError(result.message); 
      }
    } catch (err) {
      setError('Error de conexión con el servidor central de autenticación.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.iconContainer}>
            <Lock size={32} color="#0052cc" />
          </div>
          <h3 style={styles.title}>Supervisión Industrial</h3>
          <p style={styles.subtitle}>Plataforma de Monitoreo y Control</p>
        </div>

        {error && (
          <div style={styles.errorBox}>
            <ShieldAlert size={20} color="#d32f2f" style={{ marginRight: '8px', flexShrink: 0 }} />
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Usuario de Planta</label>
            <div style={styles.inputWrapper}>
              <User size={18} color="#666" style={styles.inputIcon} />
              <input
                type="text"
                placeholder=""
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Contraseña</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} color="#666" style={styles.inputIcon} />
              <input
                type="password"
                placeholder=""
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                style={styles.input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.button,
              backgroundColor: isLoading ? '#a0b2d6' : '#0052cc',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? (
              <div style={styles.loadingFlex}>
                <Loader2 size={18} style={styles.spinner} />
                <span>Autenticando...</span>
              </div>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}></p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    width: '100vw',
    backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.9)), url("https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgAoHCXOGW_ZvGfsfsy8a8jx8CWmui184C2mkj9HyHzrxG1OVENEiESIWeOGGyRR9uZc36IqFRxtMn3hIvkxNShYwEbeWHvXQMbPgh2AHUkDjzqdotOZbNpTuuWhCrK8o8v3lbBZEvqqqm3/s1540/TIA17")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)', 
    backdropFilter: 'blur(16px)', 
    width: '100%',
    maxWidth: '420px',
    padding: '40px 30px',
    borderRadius: '12px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)', 
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxSizing: 'border-box',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  iconContainer: {
    backgroundColor: '#e6f0ff',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    margin: '0 auto 16px auto',
  },
  title: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    color: '#1a1a1a',
    fontWeight: '600',
  },
  subtitle: {
    margin: 0,
    fontSize: '14px',
    color: '#666666',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    border: '1px solid #fdadb2',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '20px',
  },
  errorText: {
    fontSize: '14px',
    color: '#c62828',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  inputGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#333333',
    marginBottom: '8px',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
  },
  input: {
    width: '100%',
    padding: '12px 12px 12px 40px',
    fontSize: '15px',
    borderRadius: '6px',
    border: '1px solid #cccccc',
    outline: 'none',
    backgroundColor: '#fafafa',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  button: {
    color: '#ffffff',
    padding: '14px',
    fontSize: '16px',
    fontWeight: '500',
    border: 'none',
    borderRadius: '6px',
    marginTop: '10px',
    transition: 'background-color 0.2s',
  },
  loadingFlex: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
  },
  spinner: {
    animation: 'spin 1s linear infinite',
  },
  footer: {
    textAlign: 'center',
    marginTop: '30px',
    borderTop: '1px solid #eaeaea',
    paddingTop: '20px',
  },
  footerText: {
    fontSize: '12px',
    color: '#999999',
    margin: 0,
  },
};

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    html, body, #root { 
      margin: 0; 
      padding: 0; 
      width: 100%; 
      height: 100%; 
      overflow-x: hidden; 
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(styleSheet);
}