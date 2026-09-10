import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './components/AuthProvider';
import { AppRoutes } from './routes/AppRoutes';
import { configurationError } from './lib/firebase';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{configurationError ? <main className="mx-auto max-w-lg p-10"><h1 className="text-2xl font-semibold">VeResc Admin setup</h1><p role="alert" className="notice mt-5">{configurationError}</p></main> : <BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>}</React.StrictMode>);
