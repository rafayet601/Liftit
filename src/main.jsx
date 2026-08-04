import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initializeStorage } from './data/storage'
import './index.css'

// The storage cache must be warm before anything renders. On Capacitor
// iOS/Android, db reads go through an in-memory mirror of Preferences; if
// React renders first, the very first db.get() sees an empty cache, creates
// a blank document, and its fire-and-forget persist overwrites the user's
// real training history. On web initializeStorage() resolves immediately,
// so first paint is not delayed there.
initializeStorage()
    .catch((e) => console.error('[main] storage init failed', e))
    .then(() => {
        ReactDOM.createRoot(document.getElementById('root')).render(
            <React.StrictMode>
                <App />
            </React.StrictMode>,
        )
    })
