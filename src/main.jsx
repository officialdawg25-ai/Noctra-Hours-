import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './site.jsx';
import AdminApp from './admin.jsx';
import './styles.css';
import './admin.css';

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/');
const Root = isAdminRoute ? AdminApp : App;

createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);