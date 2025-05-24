import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { FlashcardProvider } from './components/context/FlashcardContext.jsx'

createRoot(document.getElementById('root')).render(
  <FlashcardProvider>
    <App />
  </FlashcardProvider>,
)
