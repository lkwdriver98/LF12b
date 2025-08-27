import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const app = express();

// 1) Body-Parser für JSON (sonst req.body = undefined)
app.use(express.json());

// 2) Static Files (liefert /index.html, /projects/... etc.)
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// 3) API-Routen (MÜSSEN VOR Catch-All kommen)
app.post('/api/register', async (req, res) => {
  const { name, email, password, adminKey } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich.' });
  }

  // TODO: hier dein SQLite-Insert + Passwort-Hashing etc.
  // Beispiel: const role = adminKey === process.env.ADMIN_KEY ? 'admin' : 'user';
  //           const userId = await createUser(name, email, passwordHash, role);
  //           const token  = signJwt({ id:userId, role });

  // Temporäre Demo-Antwort, falls du testen willst:
  const role = adminKey === (process.env.ADMIN_KEY || 'TECHFLAIR-ADMIN') ? 'admin' : 'user';
  const token = 'DEMO.' + Buffer.from(JSON.stringify({email, role})).toString('base64') + '.TOKEN';
  return res.json({ token });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'E-Mail und Passwort sind erforderlich.' });
  // TODO: Nutzer aus DB laden, Passwort prüfen, JWT ausstellen
  return res.json({ token: 'DEMO.' + Buffer.from(JSON.stringify({email, role:'user'})).toString('base64') + '.TOKEN' });
});

app.get('/api/me', (req, res) => {
  // TODO: JWT prüfen; hier nur Demo:
  return res.json({ user: { id: 1, name: 'Demo', email: 'demo@techflair.eu', role: 'admin' } });
});

// 4) Optionale „freundliche“ Fallbacks für die Mehrseiten-Navigation
app.get(['/projects','/projects/','/projects/index.html'], (req,res) =>
  res.sendFile(path.join(__dirname, 'public', 'projects', 'index.html'))
);
app.get('/projects/:page', (req,res) =>
  res.sendFile(path.join(__dirname, 'public', 'projects', req.params.page))
);
app.get(['/admin','/admin/','/admin/index.html'], (req,res) =>
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'))
);

// 5) 404-Fallback (ganz zum Schluss!)
app.use((req,res) => {
  res.status(404).json({ error: 'Not found' });   // << NICHT index.html zurückgeben
});

// listen(...)
