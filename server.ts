import express from "express";
import type { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin once using projectId from firebase-applet-config.json and database "lucro-db"
let firebaseProjectId = "gen-lang-client-0404948919";
try {
  const configFile = path.resolve(__dirname, "firebase-applet-config.json");
  if (fs.existsSync(configFile)) {
    const parsed = JSON.parse(fs.readFileSync(configFile, "utf-8"));
    if (parsed.projectId) {
      firebaseProjectId = parsed.projectId;
    }
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json, using default projectId", e);
}

const adminApp = getApps().length > 0 ? getApp() : initializeApp({
  projectId: firebaseProjectId
});
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp, 'lucro-db');

// Extended Request interface with authenticated user info
interface AuthRequest extends Request {
  uid?: string;
  email?: string;
}

// Middleware requireAuth
const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const idToken = authHeader.split("Bearer ")[1]?.trim();
  if (!idToken) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.uid = decoded.uid;
    req.email = (decoded.email || "").toLowerCase();
    next();
  } catch (error) {
    console.warn("[Auth] verifyIdToken failed:", error);
    return res.status(401).json({ error: "Não autenticado" });
  }
};

// Initialize Gemini
let genAI: any = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

// Function activateFromPayment: fetches payment from Mercado Pago API and activates subscription
async function activateFromPayment(paymentId: string | number) {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
  }
  const cleanId = String(paymentId).trim();
  if (!cleanId) {
    throw new Error("paymentId inválido.");
  }

  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
  const paymentClient = new Payment(client);
  const payment = await paymentClient.get({ id: cleanId });

  console.log(`[MercadoPago] Payment ${cleanId}: status=${payment.status}, currency=${payment.currency_id}, amount=${payment.transaction_amount}, ext_ref=${payment.external_reference}`);

  const status = payment.status;
  const currencyId = payment.currency_id;
  const amount = payment.transaction_amount || 0;
  const externalRef = payment.external_reference;
  const payerEmail = payment.payer?.email || '';

  if (status === 'approved' && currencyId === 'BRL' && amount >= 97) {
    if (!externalRef) {
      console.error(`[MercadoPago] Payment ${cleanId} has no external_reference!`);
      return { success: false, error: "Sem external_reference no pagamento" };
    }

    const now = Timestamp.now();
    const oneYearLater = Timestamp.fromMillis(now.toMillis() + 365 * 24 * 60 * 60 * 1000);

    const subscriptionData = {
      status: "active",
      paymentId: cleanId,
      amount,
      paidAt: now,
      expiresAt: oneYearLater,
      email: payerEmail
    };

    try {
      const subDocRef = adminDb.collection('subscriptions').doc(externalRef);
      const existingSnap = await subDocRef.get();

      // Se já existir esse paymentId gravado, não duplica
      if (existingSnap.exists) {
        const data = existingSnap.data();
        if (data?.paymentId === cleanId && data?.status === 'active') {
          console.log(`[MercadoPago] Subscription for ${externalRef} already active with paymentId ${cleanId}`);
          return { success: true, alreadyActive: true, externalReference: externalRef, subscription: data };
        }
      }

      await subDocRef.set(subscriptionData, { merge: true });
      console.log(`[MercadoPago] Activated subscription for ${externalRef} via payment ${cleanId}`);
    } catch (dbErr: any) {
      console.warn(`[MercadoPago] Aviso ao gravar assinatura no Firestore via Admin (${dbErr?.message || dbErr}).`);
    }
    return { success: true, externalReference: externalRef, subscription: subscriptionData };
  } else {
    console.log(`[MercadoPago] Payment ${cleanId} not eligible: status=${status}, currency=${currencyId}, amount=${amount}`);
    return { success: false, status, amount, reason: "Pagamento não atende aos critérios de ativação" };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  // Health route
  app.get("/api/health", async (req, res) => {
    let adminFirestore = false;
    try {
      await adminDb.collection("config").doc("app").get();
      adminFirestore = true;
    } catch (e) {
      adminFirestore = false;
    }

    res.json({
      status: "ok",
      env: process.env.NODE_ENV,
      gemini: !!process.env.GEMINI_API_KEY,
      adminFirestore
    });
  });

  // Mercado Pago preference creation
  app.post("/api/create_preference", requireAuth, async (req: AuthRequest, res) => {
    try {
      if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        return res.status(500).json({ error: "MERCADOPAGO_ACCESS_TOKEN não configurado." });
      }

      const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
      const preference = new Preference(client);

      const response = await preference.create({
        body: {
          items: [
            {
              id: "assinatura-anual",
              title: "Assinatura anual LucroNoVolante",
              quantity: 1,
              unit_price: 97.00,
              currency_id: "BRL"
            }
          ],
          payer: {
            email: req.email
          },
          external_reference: req.uid,
          notification_url: "https://lucronovolante.app.br/api/mercadopago/webhook",
          back_urls: {
            success: "https://lucronovolante.app.br/?pagamento=sucesso",
            failure: "https://lucronovolante.app.br/?pagamento=falha",
            pending: "https://lucronovolante.app.br/?pagamento=pendente"
          },
          auto_return: "approved"
        }
      });

      res.json({
        id: response.id,
        init_point: response.init_point
      });
    } catch (error: any) {
      console.error("Mercado Pago Error:", error);
      res.status(500).json({ error: "Falha ao criar preferência de pagamento" });
    }
  });

  // Mercado Pago Webhook
  app.post("/api/mercadopago/webhook", async (req, res) => {
    // Processa antes de responder: no Cloud Run, trabalho feito depois da resposta pode ser interrompido.
    // Responde 200 mesmo em caso de erro para o Mercado Pago não ficar reenviando sem parar.
    try {
      const type = req.query.type || req.query.topic || req.body?.type || req.body?.action;
      const paymentId = req.query["data.id"] || req.query.id || req.body?.data?.id || req.body?.id;

      console.log(`[MercadoPago Webhook] Received notification: type=${type}, paymentId=${paymentId}`);

      if (paymentId && (type === 'payment' || !type || String(type).includes('payment'))) {
        const result = await activateFromPayment(String(paymentId));
        console.log(`[MercadoPago Webhook] Result for payment ${paymentId}:`, result);
      }
    } catch (error) {
      console.error("[MercadoPago Webhook] Error processing notification:", error);
    }
    res.status(200).send("OK");
  });

  // Confirm payment route
  app.post("/api/confirm-payment", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { paymentId } = req.body;
      if (!paymentId) {
        return res.status(400).json({ error: "paymentId é obrigatório", active: false });
      }

      const result = await activateFromPayment(String(paymentId));
      if (result.success && result.externalReference === req.uid) {
        return res.json({ active: true, subscription: result.subscription });
      }

      // Check if user already has an active subscription
      try {
        const subSnap = await adminDb.collection('subscriptions').doc(req.uid!).get();
        if (subSnap.exists) {
          const subData = subSnap.data();
          if (subData?.status === 'active' && subData?.expiresAt) {
            const expMillis = typeof subData.expiresAt.toMillis === 'function'
              ? subData.expiresAt.toMillis()
              : new Date(subData.expiresAt).getTime();
            if (expMillis > Date.now()) {
              return res.json({ active: true, subscription: subData });
            }
          }
        }
      } catch (subErr: any) {
        console.warn("[Confirm Payment] Firestore Admin warning:", subErr?.message || subErr);
      }

      return res.json({ active: false });
    } catch (error) {
      console.warn("[Confirm Payment] Error:", error);
      return res.status(500).json({ error: "Erro ao confirmar pagamento", active: false });
    }
  });

  // Ensure trial route
  app.post("/api/trial/ensure", requireAuth, async (req: AuthRequest, res) => {
    try {
      const email = (req.email || "").toLowerCase().trim();
      if (!email) {
        return res.status(400).json({ error: "Email não encontrado no token" });
      }

      const now = Date.now();
      const maxEndsAt = now + 30 * 24 * 60 * 60 * 1000;
      let calculatedEndsAtMillis = maxEndsAt;
      let trialStartDateStr = new Date(now).toISOString();

      try {
        const trialRef = adminDb.collection('trials').doc(email);
        const trialSnap = await trialRef.get();
        const data = trialSnap.exists ? trialSnap.data() : null;

        if (data?.trialEndsAt) {
          const existingEndsMillis = typeof data.trialEndsAt.toMillis === 'function'
            ? data.trialEndsAt.toMillis()
            : new Date(data.trialEndsAt).getTime();
          return res.json({ trialEndsAt: new Date(existingEndsMillis).toISOString() });
        }

        if (data?.trialStartDate && typeof data.trialStartDate === 'string') {
          const parsedStart = new Date(data.trialStartDate).getTime();
          if (!isNaN(parsedStart) && parsedStart <= now) {
            const thirtyDaysFromStart = parsedStart + 30 * 24 * 60 * 60 * 1000;
            calculatedEndsAtMillis = Math.min(thirtyDaysFromStart, maxEndsAt);
            trialStartDateStr = data.trialStartDate;
          } else {
            trialStartDateStr = new Date(now).toISOString();
            calculatedEndsAtMillis = maxEndsAt;
          }
        } else {
          trialStartDateStr = new Date(now).toISOString();
          calculatedEndsAtMillis = maxEndsAt;
        }

        const trialEndsAtTimestamp = Timestamp.fromMillis(calculatedEndsAtMillis);
        await trialRef.set({
          trialStartDate: trialStartDateStr,
          trialEndsAt: trialEndsAtTimestamp,
          updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (dbError: any) {
        console.warn("[Trial Ensure] Aviso Firestore Admin (sem IAM no sandbox/ambiente atual):", dbError?.message || dbError);
      }

      return res.json({ trialEndsAt: new Date(calculatedEndsAtMillis).toISOString() });
    } catch (error: any) {
      console.warn("[Trial Ensure] Erro inesperado:", error);
      const defaultEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      return res.json({ trialEndsAt: defaultEndsAt });
    }
  });

  // Gemini API route
  app.post("/api/gemini", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { text, history, systemInstruction, imageConfig } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "O texto é obrigatório" });
      }

      if (!process.env.GEMINI_API_KEY || !genAI) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY não configurada no servidor. Se você está fora do AI Studio, precisa configurar esta variável de ambiente no Cloud Run." 
        });
      }

      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction,
      });

      if (imageConfig) {
        // Image Generation
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: `[GERE UMA IMAGEM BASEADA NESTE PEDIDO: ${text}]` }] }],
        });

        const response = result.response;
        let imageUrl = '';
        let modelText = '';

        if (response.candidates && response.candidates[0] && response.candidates[0].content) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            } else if (part.text) {
              modelText += part.text;
            }
          }
        }
        
        return res.json({ text: modelText, image: imageUrl });
      } else {
        // Text Generation
        const chatSession = genAI.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          systemInstruction,
        }).startChat({
          history: (history || []).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          })),
        });

        const result = await chatSession.sendMessage(text);
        return res.json({ text: result.response.text() });
      }
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: error.message || "Falha ao gerar conteúdo" });
    }
  });

  // Rate limiter map per uid
  const rateLimitMap = new Map<string, { autocomplete: number[]; route: number[] }>();
  function checkRateLimit(uid: string, type: 'autocomplete' | 'route'): boolean {
    const now = Date.now();
    const oneMinAgo = now - 60000;
    let record = rateLimitMap.get(uid);
    if (!record) {
      record = { autocomplete: [], route: [] };
      rateLimitMap.set(uid, record);
    }
    record[type] = record[type].filter(t => t > oneMinAgo);
    const limit = type === 'autocomplete' ? 60 : 30;
    if (record[type].length >= limit) {
      return false;
    }
    record[type].push(now);
    return true;
  }

  // Google Maps Autocomplete Proxy
  app.get("/api/maps/autocomplete", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { input, sessionToken, lat, lng } = req.query;
      if (!input || typeof input !== 'string' || input.trim().length < 3) {
        return res.json({ suggestions: [] });
      }

      if (!checkRateLimit(req.uid!, 'autocomplete')) {
        return res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
      }

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        return res.status(503).json({ error: "Cálculo automático indisponível" });
      }

      const bodyPayload: any = {
        input: input.trim(),
        sessionToken: sessionToken || undefined,
        languageCode: "pt-BR",
        includedRegionCodes: ["br"]
      };

      if (lat && lng) {
        const latitude = Number(lat);
        const longitude = Number(lng);
        if (!isNaN(latitude) && !isNaN(longitude)) {
          bodyPayload.locationBias = {
            circle: {
              center: { latitude, longitude },
              radius: 50000
            }
          };
        }
      }

      const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Google Places API Error] ${response.status}: ${errText}`);
        return res.status(502).json({ error: "Não foi possível calcular a rota" });
      }

      const data = await response.json();
      const suggestions = (data.suggestions || []).map((item: any) => {
        const pred = item.placePrediction || {};
        return {
          placeId: pred.placeId,
          text: pred.structuredFormat?.mainText?.text || pred.text?.text || '',
          secondaryText: pred.structuredFormat?.secondaryText?.text || ''
        };
      }).filter((s: any) => s.placeId);

      res.json({ suggestions });
    } catch (error: any) {
      console.error("[Autocomplete Error]:", error);
      res.status(502).json({ error: "Não foi possível calcular a rota" });
    }
  });

  // Google Maps Route Proxy
  app.post("/api/maps/route", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { origin, destination, departureTime } = req.body;
      if (!origin || !destination) {
        return res.status(400).json({ error: "Origem e destino são obrigatórios" });
      }

      if (!checkRateLimit(req.uid!, 'route')) {
        return res.status(429).json({ error: "Muitas requisições. Aguarde um momento." });
      }

      if (!process.env.GOOGLE_MAPS_API_KEY) {
        return res.status(503).json({ error: "Cálculo automático indisponível" });
      }

      const formatPoint = (pt: any) => {
        if (pt.placeId) {
          return { placeId: pt.placeId };
        }
        const lat = pt.lat !== undefined ? pt.lat : pt.latitude;
        const lng = pt.lng !== undefined ? pt.lng : pt.longitude;
        if (lat !== undefined && lng !== undefined) {
          return {
            location: {
              latLng: {
                latitude: Number(lat),
                longitude: Number(lng)
              }
            }
          };
        }
        throw new Error("Ponto de origem ou destino inválido");
      };

      const bodyPayload: any = {
        origin: formatPoint(origin),
        destination: formatPoint(destination),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "pt-BR",
        units: "METRIC"
      };

      if (departureTime) {
        const depTimeMs = new Date(departureTime).getTime();
        if (!isNaN(depTimeMs) && depTimeMs > Date.now()) {
          bodyPayload.departureTime = new Date(depTimeMs).toISOString();
        }
      }

      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[Google Routes API Error] ${response.status}: ${errText}`);
        return res.status(502).json({ error: "Não foi possível calcular a rota" });
      }

      const data = await response.json();
      const route = data.routes?.[0];
      if (!route) {
        return res.status(404).json({ error: "Nenhuma rota encontrada" });
      }

      const distanceMeters = route.distanceMeters || 0;
      const durationStr = route.duration || "0s";
      const durationSeconds = parseInt(durationStr.replace('s', ''), 10) || 0;

      const km = Math.round((distanceMeters / 1000) * 10) / 10;
      const minutes = Math.ceil(durationSeconds / 60);

      res.json({ km, minutes });
    } catch (error: any) {
      console.error("[Route Error]:", error);
      res.status(502).json({ error: "Não foi possível calcular a rota" });
    }
  });

  // Fetch URL proxy
  app.get("/api/fetch-url", requireAuth, async (req: AuthRequest, res) => {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: "URL is required" });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: "Endereço não permitido" });
    }

    if (parsedUrl.protocol !== 'https:' || (!parsedUrl.hostname.endsWith('.gov.br') && parsedUrl.hostname !== 'gov.br')) {
      return res.status(400).json({ error: "Endereço não permitido" });
    }

    console.log(`[API] Fetching URL: ${url}`);

    try {
      const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000), // 15 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });
      
      console.log(`[API] Fetch response: ${response.status} ${response.statusText}`);

      // Se houve redirecionamento, o destino final também precisa ser um site .gov.br
      try {
        const finalHost = new URL(response.url).hostname;
        if (!finalHost.endsWith('.gov.br')) {
          return res.status(400).json({ error: "Endereço não permitido" });
        }
      } catch {
        return res.status(400).json({ error: "Endereço não permitido" });
      }
      
      if (!response.ok) {
        throw new Error(`Falha ao acessar o site da nota (${response.status})`);
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
        return res.status(400).json({ error: "Resposta excede o limite de 2 MB" });
      }

      if (!response.body) {
        return res.send('');
      }

      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.length;
        if (receivedBytes > MAX_BYTES) {
          await reader.cancel();
          return res.status(400).json({ error: "Resposta excede o limite de 2 MB" });
        }
        chunks.push(value);
      }

      const text = Buffer.concat(chunks).toString('utf-8');
      console.log(`[API] Fetch content length: ${text.length}`);
      res.send(text);
    } catch (error: any) {
      console.error("Error fetching URL:", error);
      res.status(500).json({ error: error.message || "Failed to fetch URL content" });
    }
  });

  // Logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (res.statusCode >= 400 || req.url.startsWith('/api') || req.headers.host?.includes('lucronovolante')) {
        console.log(`${new Date().toISOString()} - [${req.headers.host}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    console.log(`[Production] Serving static files from: ${distPath}`);
    
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      immutable: true,
      maxAge: '1y',
      fallthrough: false
    }));

    app.use(['/', '/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest'], (req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      next();
    });

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      if (req.accepts('html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        res.status(404).send('Not found');
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    console.log(`GEMINI_API_KEY is ${process.env.GEMINI_API_KEY ? 'DEFINED' : 'NOT DEFINED'}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
