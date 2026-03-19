import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/animations.css'
// i18n config must be imported before any component that calls useTranslation()
import './i18n/config'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import I18nProvider from './i18n/I18nProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
