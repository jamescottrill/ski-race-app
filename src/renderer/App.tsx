import { MemoryRouter as Router, Routes } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MyRoutes from './MyRoutes';
import MyRoutesNew from './MyRoutesNew';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Feature flag for new UI - can be toggled via localStorage
const USE_NEW_UI = localStorage.getItem('useNewUI') === 'true' || true; // Default to new UI

export default function App() {
  const [useNewUI, setUseNewUI] = useState(USE_NEW_UI);

  useEffect(() => {
    // Listen for UI toggle from dev tools
    const handleUIToggle = (event: CustomEvent) => {
      const newValue = event.detail.useNewUI;
      localStorage.setItem('useNewUI', newValue.toString());
      setUseNewUI(newValue);
    };

    window.addEventListener('toggleUI' as any, handleUIToggle as any);
    return () => {
      window.removeEventListener('toggleUI' as any, handleUIToggle as any);
    };
  }, []);

  return (
    <>
      <Router>
        <Routes>
          {useNewUI ? MyRoutesNew() : MyRoutes()}
        </Routes>
      </Router>
      {useNewUI && <Toaster position="bottom-right" />}
    </>
  );
}