import React from 'react';
import ReactDOM from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { ThemeProvider } from './theme';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { msalInstance } from './msal';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </MsalProvider>
  </React.StrictMode>
);
