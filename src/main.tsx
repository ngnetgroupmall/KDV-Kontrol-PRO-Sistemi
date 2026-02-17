import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const showBootstrapError = (error: unknown) => {
  const root = document.getElementById('root') || document.body
  const details = error instanceof Error ? `${error.message}\n\n${error.stack || ''}` : String(error)
  root.innerHTML = `
    <div style="min-height:100vh;background:#0f172a;color:#e2e8f0;padding:24px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">
      <h1 style="margin:0 0 12px 0;color:#f87171;font-size:20px;">Uygulama baslatma hatasi</h1>
      <p style="margin:0 0 16px 0;color:#cbd5e1;">Program acilisinda bir hata olustu. Lutfen bu mesaji teknik ekiple paylasin.</p>
      <pre style="white-space:pre-wrap;background:#020617;border:1px solid #334155;border-radius:8px;padding:12px;overflow:auto;">${details}</pre>
    </div>
  `
  console.error('Bootstrap error:', error)
}

const bootstrap = async () => {
  const [{ default: App }, { CompanyProvider }, { ErrorBoundary }] = await Promise.all([
    import('./App.tsx'),
    import('./context/CompanyContext'),
    import('./components/common/ErrorBoundary'),
  ])

  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root elementi bulunamadi (#root).')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <CompanyProvider>
          <App />
        </CompanyProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

void bootstrap().catch(showBootstrapError)
