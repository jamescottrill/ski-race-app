import { MemoryRouter as Router, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import MyRoutesNew from './MyRoutesNew';
import './App.css';

export default function App() {
  return (
    <>
      <Router>
        <Routes>{MyRoutesNew()}</Routes>
      </Router>
      <Toaster position="bottom-right" />
    </>
  );
}
