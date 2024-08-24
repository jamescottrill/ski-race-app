import { MemoryRouter as Router, Routes } from 'react-router-dom';
import MyRoutes from './MyRoutes';
// import { AlertProvider } from './context/AlertContext';

export default function App() {
  return (
    // <AlertProvider>
      <Router>
        <Routes>
        {MyRoutes()}
        </Routes>
        </Router>
    // </AlertProvider>
  );
}
