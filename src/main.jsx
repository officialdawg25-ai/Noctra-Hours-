import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './site.jsx';
import AdminApp from './admin.jsx';
import AdminPreview from './admin-preview.jsx';
import './styles.css';
import './admin.css';
import './admin-preview.css';

const path = window.location.pathname;
const isAdminPreview = path === '/admin/preview';
const isAdminRoute = path === '/admin' || path.startsWith('/admin/');
const Root = isAdminPreview ? AdminPreview : isAdminRoute ? AdminApp : App;

createRoot(document.getElementById('root')).render(<React.StrictMode><Root /></React.StrictMode>);