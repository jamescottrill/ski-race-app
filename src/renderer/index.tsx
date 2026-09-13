import { createRoot } from 'react-dom/client';
import React from 'react';
import App from './App';
// import ReactDOM from 'react-dom';
import './styles/tailwind.css'; // This line imports the Tailwind CSS
import './App.css';

const rootElement = document.getElementById('root') as HTMLElement;
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// // calling IPC exposed from preload script
// window.electron.ipcRenderer.once('ipc-example', (arg) => {
//   // eslint-disable-next-line no-console
//   console.log(arg);
// });
// // window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
