// Set DISABLE_HMR for AI Studio iframe environment to disable Vite WebSocket connection
process.env.DISABLE_HMR = 'true';

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function cleanBase64Payload(rawBase64: string): string {
  if (!rawBase64) return "";
  const commaIndex = rawBase64.indexOf(",");
  const cleaned = commaIndex !== -1 ? rawBase64.slice(commaIndex + 1) : rawBase64;
  return cleaned.replace(/\s+/g, "");
}

async function extractTextFromPdf(base64Data: string): Promise<string> {
  if (!base64Data) return "";
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(base64Data, "base64");
    const parser: any = new (PDFParse as any)({ data: buffer });
    if (typeof parser.load === "function") {
      await parser.load();
    }
    const parsed = await parser.getText();
    return parsed?.text?.trim() || "";
  } catch (err) {
    console.warn("[PDFParse] Could not extract direct text from PDF:", err);
    return "";
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API endpoint to parse sales receipts / POS exports (PDF, Excel, text)
  app.post("/api/gemini/parse-sales-receipt", async (req, res) => {
    console.log("[API/gemini/parse-sales-receipt] Parsing sales receipt / POS data...");
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur. Veuillez l'ajouter dans les paramètres d'environnement." 
        });
      }

      const { pdfBase64, rawText, rawRows, existingCatalog } = req.body || {};

      if (!pdfBase64 && !rawText && (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0)) {
        return res.status(400).json({ error: "Aucun contenu fourni (PDF, texte ou lignes Excel requis)." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Contextual catalogue summary (up to 1000 references to guide the AI)
      let catalogSummary = "";
      if (Array.isArray(existingCatalog) && existingCatalog.length > 0) {
        catalogSummary = `\nVoici un aperçu des vins actuellement en cave dans l'établissement pour t'aider à faire le rapprochement exact :\n` + 
          existingCatalog.slice(0, 1000).map((w: any) => `- [ID:${w.id}] ${w.domain || ''} - ${w.name || ''}${w.cuvee ? ` (Cuvée: ${w.cuvee})` : ''} ${w.vintage || ''} (${w.color || ''}, ${w.format || '75cl'})`).join('\n');
      }

      const promptInstructions = `Tu es un sommelier expert et directeur de restaurant gastronomique. Ta mission est d'analyser ce ticket de caisse / export de ventes PMS (Zelty, Lightspeed, Micros, L'Addition, Tiller, etc.) pour extraire avec une exactitude totale TOUTES les lignes de boissons vendues (Vins rouges, blancs, rosés, champagnes, spiritueux, bières, cidres, verres au vin, etc.).

${catalogSummary}

RÈGLE MAJEURE D'INSENSIBILITÉ AUX ACCENTS & ABRÉVIATIONS :
Pour faire correspondre les vins vendus avec le catalogue (matchedWineId), ignore totalement les accents, cédilles, tildes (ex: "nina" correspond à "Niña", "prieure" à "Prieuré", "chateau" à "Château", "saint emilion" à "Saint-Émilion"). Si la référence correspond, renseigne impérativement matchedWineId.

Règles impératives :
1. Pour chaque ligne identifiée :
   - rawLabel : Le libellé exact d'origine figurant sur le ticket ou l'export
   - isBeverageOrWine : true si c'est une boisson (vin, champagne, spiritueux, bière, etc.), false s'il s'agit d'un plat, menu dégustation, café, carafe d'eau ou taxe
   - quantity : Quantité vendue (entier ou décimal, par défaut 1 si non spécifié)
   - unitPrice : Prix unitaire TTC ou HT si mentionné (nombre ou null)
   - totalPrice : Prix total ligne si mentionné (nombre ou null)
   - suggestedDomain : Domaine ou producteur identifié (ex: "Domaine Prieuré-Roch", "Domaine Leflaive", "Domaine Roulot", etc.)
   - suggestedAppellation : Appellation / Nom du vin (ex: "Chassagne-Montrachet 1er Cru Blanchot", "Meursault", "Nuits-Saint-Georges 1er Cru Clos des Corvées")
   - suggestedVintage : Millésime identifié (ex: "2017", "2020", "S.A." ou "" si non précisé)
   - suggestedColor : "rouge" | "blanc" | "rose" | "bulle" | "orange" | "spiritueux" | "cidre_biere" | "soft" | "autre"
   - suggestedFormat : Format identifié ("Bouteille", "Magnum", "Demi-bouteille", "Verre", etc.)
   - matchedWineId : Si tu as pu faire une correspondance très probable avec un vin du catalogue fourni, mets l'ID exact du vin (ex: "dpr_corvees_2017"), sinon null
   - confidenceScore : Indice de confiance de 0 à 100 (100 = certitude absolue, 50 = ambiguïté de millésime, etc.)
   - notes : Remarque utile s'il y a une ambiguïté (ex: "Millésime non mentionné sur le ticket, 2018 et 2020 existent en cave")

2. Date et numéro de ticket :
   - receiptDate : Date de la vente au format YYYY-MM-DD si détectée (ou date du jour)
   - receiptNumber : Numéro de table, de ticket ou référence de vente s'il existe

Fournis une réponse au format JSON strict.`;

      const cleanBase64 = pdfBase64 ? cleanBase64Payload(pdfBase64) : "";
      let extractedPdfText = "";
      if (cleanBase64) {
        extractedPdfText = await extractTextFromPdf(cleanBase64);
        if (extractedPdfText) {
          console.log(`[API/gemini/parse-sales-receipt] Extracted ${extractedPdfText.length} chars of direct text from PDF.`);
        }
      }

      const contentsPayloadWithPdf: any[] = [];
      const contentsPayloadTextOnly: any[] = [];

      if (cleanBase64) {
        contentsPayloadWithPdf.push({
          inlineData: {
            data: cleanBase64,
            mimeType: 'application/pdf'
          }
        });
        if (extractedPdfText) {
          contentsPayloadWithPdf.push(`${promptInstructions}\n\nTexte brut extrait directement du PDF :\n"""\n${extractedPdfText}\n"""`);
          contentsPayloadTextOnly.push(`${promptInstructions}\n\nTexte brut extrait directement du PDF :\n"""\n${extractedPdfText}\n"""`);
        } else {
          contentsPayloadWithPdf.push(promptInstructions);
        }
      } else if (rawRows && rawRows.length > 0) {
        const textPrompt = `${promptInstructions}\n\nDonnées Excel / tableau à analyser :\n${JSON.stringify(rawRows, null, 2)}`;
        contentsPayloadWithPdf.push(textPrompt);
        contentsPayloadTextOnly.push(textPrompt);
      } else {
        const textPrompt = `${promptInstructions}\n\nTexte brut du ticket à analyser :\n"""\n${rawText}\n"""`;
        contentsPayloadWithPdf.push(textPrompt);
        contentsPayloadTextOnly.push(textPrompt);
      }

      const salesReceiptSchema = {
        type: Type.OBJECT,
        properties: {
          receiptDate: { type: Type.STRING },
          receiptNumber: { type: Type.STRING },
          serviceType: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rawLabel: { type: Type.STRING },
                isBeverageOrWine: { type: Type.BOOLEAN },
                quantity: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                totalPrice: { type: Type.NUMBER },
                suggestedDomain: { type: Type.STRING },
                suggestedAppellation: { type: Type.STRING },
                suggestedVintage: { type: Type.STRING },
                suggestedColor: { type: Type.STRING },
                suggestedFormat: { type: Type.STRING },
                matchedWineId: { type: Type.STRING },
                confidenceScore: { type: Type.NUMBER },
                notes: { type: Type.STRING },
              },
              required: ["rawLabel", "isBeverageOrWine", "quantity"]
            }
          }
        },
        required: ["items"]
      };

      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let result: any = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`[API/gemini/parse-sales-receipt] Attempting parse with ${modelName}...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayloadWithPdf,
            config: {
              responseMimeType: "application/json",
              responseSchema: salesReceiptSchema
            }
          });
          result = JSON.parse(response?.text || "{}");
          console.log(`[API/gemini/parse-sales-receipt] Success with ${modelName}`);
          break;
        } catch (modelErr: any) {
          lastError = modelErr;
          console.warn(`[API/gemini/parse-sales-receipt] Model ${modelName} failed:`, modelErr.message || modelErr);
          if (contentsPayloadTextOnly.length > 0 && contentsPayloadWithPdf !== contentsPayloadTextOnly) {
            try {
              console.log(`[API/gemini/parse-sales-receipt] Retrying with text-only payload on ${modelName}...`);
              const textResp = await ai.models.generateContent({
                model: modelName,
                contents: contentsPayloadTextOnly,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: salesReceiptSchema
                }
              });
              result = JSON.parse(textResp?.text || "{}");
              console.log(`[API/gemini/parse-sales-receipt] Text-only payload succeeded on ${modelName}`);
              break;
            } catch (fallbackErr: any) {
              lastError = fallbackErr;
            }
          }
        }
      }

      if (!result) {
        throw lastError || new Error("Impossible d'extraire les données du ticket de caisse.");
      }

      res.json(result);
    } catch (error: any) {
      console.error("[API/gemini/parse-sales-receipt] Error parsing receipt:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'analyse du ticket de caisse par l'IA." });
    }
  });

  // API endpoint to parse supplier purchase invoices (Point 3)
  app.post("/api/gemini/parse-purchase-invoice", async (req, res) => {
    console.log("[API/gemini/parse-purchase-invoice] Parsing supplier purchase invoice...");
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur." 
        });
      }

      const { pdfBase64, rawText, rawRows, existingCatalog } = req.body || {};

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      let catalogSummary = "";
      if (Array.isArray(existingCatalog) && existingCatalog.length > 0) {
        catalogSummary = `\nCatalogue actuel en cave (pour rapprochement automatique des références) :\n` + 
          existingCatalog.slice(0, 1000).map((w: any) => `- [ID:${w.id}] ${w.domain || ''} - ${w.name || ''}${w.cuvee ? ` (Cuvée: ${w.cuvee})` : ''} ${w.vintage || ''}`).join('\n');
      }

      const promptInstructions = `Tu es un expert sommelier et gestionnaire de cave pour un restaurant gastronomique. Ta mission est d'analyser cette facture d'achat fournisseur (vigneron, domaine, négociant, grossiste) pour extraire avec précision toutes les lignes de vins reçus et les frais accessoires (notamment les frais de transport / port).

${catalogSummary}

RÈGLE ABSOLUE D'INSENSIBILITÉ AUX ACCENTS & VARIATIONS (ESSENTIEL) :
Pour le rapprochement (matchedWineId) :
- NE TIENS JAMAIS COMPTE DES ACCENTS, TILDES, CÉDILLES OU MAJUSCULES/MINUSCULES :
  * Exemple clé : si la facture mentionne "Nina", "Cuvée Nina" ou "La Nina" et que le catalogue en cave possède "Niña", c'est EXACTEMENT le même vin -> renseigne impérativement son ID dans matchedWineId !
  * Exemples fréquents : "Prieure" = "Prieuré", "Chateau" = "Château", "Cote Rotie" = "Côte-Rôtie", "Saint-Emilion" = "Saint-Émilion", "Hute" = "Hutte".
- Si la cuvée ou le nom correspond avec ou sans accent et que le producteur et le millésime sont cohérents :
  * Indique impérativement le matchedWineId correspondant dans le catalogue.
  * Mets isNewReference: false.

Extrais rigoureusement :
- supplierName : Nom du fournisseur / domaine émetteur de la facture
- invoiceNumber : Numéro de facture
- invoiceDate : Date de la facture (YYYY-MM-DD)
- totalAmountHt : Montant total net HT de la facture
- totalAmountTtc : Montant total TTC de la facture
- totalShippingCostHt : Montant total net HT des frais de transport / port / livraison / expédition (ex: "Participation aux frais de transport", "Frais de port", "Port", "Transport", "Fret"). Si aucun frais de port, mettre 0.
- items : Liste STRICTEMENT réservée aux vins et boissons achetés (ATTENTION : NE PAS mettre la ligne de transport/frais de port dans items car c'est un frais d'approche global qui doit être extrait dans totalShippingCostHt). Pour chaque vin :
  - rawLabel : Description brute de la ligne (ex: "Bouteilles de Champagne Longitude Premier Cru Extra-Brut Blanc de Blancs 0,75 l")
  - domain : Domaine / Producteur (ex: "Larmandier-Bernier")
  - wineName : Nom de la cuvée / Appellation (ex: "Longitude Premier Cru Extra-Brut Blanc de Blancs")
  - vintage : Millésime (ex: "2017" ou "S.A." / "N.V." si non millésimé)
  - color : "rouge" | "blanc" | "rose" | "bulle" | "spiritueux" | "autre"
  - format : Format (ex: "Bouteille (75cl)", "Magnum (1.5L)")
  - quantity : Nombre total de bouteilles reçues (ex: 12)
  - priceBuyHt : Prix d'achat unitaire net HT de la bouteille (en €)
  - shippingCostPerUnit : Frais de port unitaire estimé par bouteille en divisant totalShippingCostHt par le nombre total de bouteilles de la commande (ex: 30 € pour 18 bouteilles = 1.67 € HT / bt)
  - matchedWineId : ID du vin existant dans le catalogue si reconnu, ou chaîne vide si non trouvé
  - isNewReference : true si le vin semble être une nouvelle référence à créer en cave`;

      const cleanBase64 = pdfBase64 ? cleanBase64Payload(pdfBase64) : "";
      let extractedPdfText = "";
      if (cleanBase64) {
        extractedPdfText = await extractTextFromPdf(cleanBase64);
        if (extractedPdfText) {
          console.log(`[API/gemini/parse-purchase-invoice] Extracted ${extractedPdfText.length} chars of direct text from PDF.`);
        }
      }

      const contentsPayloadWithPdf: any[] = [];
      const contentsPayloadTextOnly: any[] = [];

      if (cleanBase64) {
        contentsPayloadWithPdf.push({
          inlineData: {
            data: cleanBase64,
            mimeType: 'application/pdf'
          }
        });
        if (extractedPdfText) {
          contentsPayloadWithPdf.push(`${promptInstructions}\n\nTexte brut extrait directement du PDF de la facture :\n"""\n${extractedPdfText}\n"""`);
          contentsPayloadTextOnly.push(`${promptInstructions}\n\nTexte brut extrait directement du PDF de la facture :\n"""\n${extractedPdfText}\n"""`);
        } else {
          contentsPayloadWithPdf.push(promptInstructions);
        }
      } else if (rawRows && rawRows.length > 0) {
        const textPrompt = `${promptInstructions}\n\nDonnées facture :\n${JSON.stringify(rawRows, null, 2)}`;
        contentsPayloadWithPdf.push(textPrompt);
        contentsPayloadTextOnly.push(textPrompt);
      } else {
        const textPrompt = `${promptInstructions}\n\nTexte brut facture :\n"""\n${rawText}\n"""`;
        contentsPayloadWithPdf.push(textPrompt);
        contentsPayloadTextOnly.push(textPrompt);
      }

      const invoiceSchema = {
        type: Type.OBJECT,
        properties: {
          supplierName: { type: Type.STRING },
          invoiceNumber: { type: Type.STRING },
          invoiceDate: { type: Type.STRING },
          totalAmountHt: { type: Type.NUMBER },
          totalAmountTtc: { type: Type.NUMBER },
          totalShippingCostHt: { type: Type.NUMBER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                rawLabel: { type: Type.STRING },
                domain: { type: Type.STRING },
                wineName: { type: Type.STRING },
                vintage: { type: Type.STRING },
                color: { type: Type.STRING },
                format: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                priceBuyHt: { type: Type.NUMBER },
                shippingCostPerUnit: { type: Type.NUMBER },
                matchedWineId: { type: Type.STRING },
                isNewReference: { type: Type.BOOLEAN }
              },
              required: ["rawLabel"]
            }
          }
        },
        required: ["items"]
      };

      // Valid current models in priority order
      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let result: any = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            console.log(`[API/gemini/parse-purchase-invoice] Attempting parse with ${modelName} (attempt ${attempt + 1})...`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents: contentsPayloadWithPdf,
              config: {
                responseMimeType: "application/json",
                responseSchema: invoiceSchema
              }
            });

            const responseText = response?.text || "{}";
            result = JSON.parse(responseText);
            console.log(`[API/gemini/parse-purchase-invoice] Success with ${modelName}`);
            break;
          } catch (modelErr: any) {
            lastError = modelErr;
            const errMsg = modelErr.message || String(modelErr);
            console.warn(`[API/gemini/parse-purchase-invoice] Model ${modelName} attempt ${attempt + 1} failed:`, errMsg);

            // If text is available and PDF failed, try text only immediately
            if (contentsPayloadTextOnly.length > 0 && contentsPayloadWithPdf !== contentsPayloadTextOnly) {
              try {
                console.log(`[API/gemini/parse-purchase-invoice] Retrying with text-only payload on ${modelName}...`);
                const textResp = await ai.models.generateContent({
                  model: modelName,
                  contents: contentsPayloadTextOnly,
                  config: {
                    responseMimeType: "application/json",
                    responseSchema: invoiceSchema
                  }
                });
                result = JSON.parse(textResp?.text || "{}");
                console.log(`[API/gemini/parse-purchase-invoice] Text-only payload succeeded on ${modelName}`);
                break;
              } catch (fallbackErr: any) {
                lastError = fallbackErr;
              }
            }

            // If 503 (high demand) or 429, wait 1.2s before retry
            if (errMsg.includes('503') || errMsg.includes('demand') || errMsg.includes('429')) {
              await new Promise(r => setTimeout(r, 1200));
            }
          }
        }
        if (result && Array.isArray(result.items)) break;
      }

      if (!result || !Array.isArray(result.items)) {
        throw lastError || new Error("Impossible d'extraire les données de la facture avec les modèles disponibles.");
      }

      // Clean matchedWineId strings like "null" / "undefined"
      if (Array.isArray(result.items)) {
        result.items.forEach((it: any) => {
          if (it.matchedWineId === 'null' || it.matchedWineId === 'undefined' || !it.matchedWineId) {
            it.matchedWineId = null;
          }
          if (typeof it.quantity !== 'number' || it.quantity <= 0) {
            it.quantity = 1;
          }
          if (typeof it.priceBuyHt !== 'number' || isNaN(it.priceBuyHt) || it.priceBuyHt < 0) {
            it.priceBuyHt = 0;
          }
        });
      }

      // Robust post-processing for shipping fees & non-wine line filtering
      let detectedShippingTotal = typeof result.totalShippingCostHt === 'number' && !isNaN(result.totalShippingCostHt) 
        ? result.totalShippingCostHt 
        : 0;

      if (Array.isArray(result.items)) {
        const cleanedItems: any[] = [];
        for (const it of result.items) {
          const label = `${it.rawLabel || ''} ${it.wineName || ''} ${it.domain || ''}`.toLowerCase();
          const isShippingLine = /(participation\s+aux\s+frais\s+de\s+transport|frais\s+de\s+(transport|port|livraison)|forfait\s+(transport|port)|frais\s+d'approche|port\s+pay[eé]|frais\s+d'exp[eé]dition)/i.test(label);
          
          if (isShippingLine) {
            const lineAmount = (Number(it.priceBuyHt) || 0) * (Number(it.quantity) || 1);
            if (detectedShippingTotal === 0 && lineAmount > 0) {
              detectedShippingTotal = lineAmount;
            }
            console.log(`[API/gemini/parse-purchase-invoice] Extracted shipping line "${it.rawLabel}" (${lineAmount} €) and removed from wine items.`);
          } else {
            cleanedItems.push(it);
          }
        }
        result.items = cleanedItems;

        result.totalShippingCostHt = Math.round(detectedShippingTotal * 100) / 100;

        // Auto-distribute shippingCostPerUnit among wine bottles if not already calculated
        const totalBottles = result.items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0);
        if (result.totalShippingCostHt > 0 && totalBottles > 0) {
          const unitPort = Math.round((result.totalShippingCostHt / totalBottles) * 100) / 100;
          result.items.forEach((it: any) => {
            if (typeof it.shippingCostPerUnit !== 'number' || it.shippingCostPerUnit === 0) {
              it.shippingCostPerUnit = unitPort;
            }
          });
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error("[API/gemini/parse-purchase-invoice] Error parsing invoice:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'analyse de la facture d'achat par l'IA." });
    }
  });

  // API endpoint to generate a fully structured technical sheet (fiche technique)
  app.post("/api/gemini/generate-technical-sheet", async (req, res) => {
    console.log("[API/gemini/generate-technical-sheet] Received request body:", req.body);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Missing GEMINI_API_KEY env variable");
        return res.status(500).json({ 
          error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur. Veuillez l'ajouter dans les paramètres d'environnement." 
        });
      }

      const wineName = typeof req.body?.wineName === 'string' ? req.body.wineName.trim() : '';
      const cuvee = typeof req.body?.cuvee === 'string' ? req.body.cuvee.trim() : '';
      const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : '';
      const vintage = typeof req.body?.vintage === 'string' ? req.body.vintage.trim() : '';
      const color = typeof req.body?.color === 'string' ? req.body.color.trim() : '';
      const region = typeof req.body?.region === 'string' ? req.body.region.trim() : '';
      
      const effectiveWineName = [wineName, cuvee].filter(Boolean).join(' - ') || domain || "Vin d'exception";
      if (!effectiveWineName) {
        return res.status(400).json({ error: "Le nom du vin, cuvée ou appellation est requis." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Tu es un expert sommelier et œnologue de classe mondiale. Ta mission est de rédiger et générer une fiche technique ultra-précise, pragmatique et utile pour le vin suivant afin d'aider l'équipe d'un restaurant gastronomique à mieux le comprendre et le servir :
Nom / Appellation : ${effectiveWineName}
${cuvee ? `Cuvée / Lieu-dit : ${cuvee}\n` : ''}Domaine / Producteur : ${domain || 'N/C'}
Millésime : ${vintage || 'N/C'}
Couleur : ${color || 'N/C'}
Région : ${region || 'N/C'}

Recherche dans tes connaissances encyclopédiques de ce domaine et de ce vin spécifique. Remplis tous les détails techniques de manière réaliste et professionnelle. Si certains chiffres très précis (comme le rendement exact ou la surface exacte) ne sont pas publics ou connus, effectue une estimation professionnelle très cohérente avec le terroir, le domaine et les pratiques de l'appellation, de sorte que la fiche technique soit complète, ultra-pragmatique et crédible.

Champs requis dans l'objet JSON :
- aop : Appellation d'Origine Contrôlée (ex: Chassagne-Montrachet 1er Cru Blanchot, Bourgogne Aligoté)
- lieuDit : Lieu-dit ou climat s'il y en a un (ex: Blanchots, Les Plumes, ou laisser vide si aucun)
- sol : Description géologique simplifiée et parlante pour le service (ex: Argilo-calcaire du kimméridgien, Sols marneux rouges)
- cepage : Cépage(s) composant le vin (ex: Chardonnay, Aligoté, Pinot Noir, Syrah...)
- ageVignes : Âge moyen estimé des vignes du domaine pour cette cuvée (ex: 40 ans)
- rendement : Rendement typique (ex: 55 hl/ha, 40 hl/ha)
- densite : Densité de plantation typique (ex: 10 000 pieds/ha)
- surface : Surface de la parcelle pour cette cuvée (ex: 0,60 ha)
- culture : Mode de culture (ex: Biologique, Biodynamie, Lutte raisonnée)
- vinification : Description synthétique et élégante des étapes de vinification (vendanges manuelles, levures indigènes, pressurage, etc.) en français impeccable.
- elevage : Élevage (ex: 14 mois en fûts de chêne français de 1 à 5 vins)
- degustation : Objet contenant :
  - oeil : Profil visuel/robe (ex: Or pâle aux reflets argentés brillants)
  - nez : Profil olfactif (ex: Fleurs blanches, notes de beurre frais, de noisette grillée et une pointe de minéralité saline)
  - bouche : Profil gustatif (ex: Attaque franche, bouche ample et tendue, finale saline d'une grande persistance)
- service : Objet contenant :
  - temperature : Température idéale de service (ex: 12-14°C, 16-18°C)
  - garde : Potentiel de garde (ex: 5 à 12 ans, Prêt à boire)
  - accords : Accords mets-vins parfaits pour la gastronomie (ex: Homard grillé, ris de veau aux morilles, poissons nobles)`;

      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let responseText = "";
      let lastError = null;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          aop: { type: Type.STRING },
          lieuDit: { type: Type.STRING },
          sol: { type: Type.STRING },
          cepage: { type: Type.STRING },
          ageVignes: { type: Type.STRING },
          rendement: { type: Type.STRING },
          densite: { type: Type.STRING },
          surface: { type: Type.STRING },
          culture: { type: Type.STRING },
          vinification: { type: Type.STRING },
          elevage: { type: Type.STRING },
          degustation: {
            type: Type.OBJECT,
            properties: {
              oeil: { type: Type.STRING },
              nez: { type: Type.STRING },
              bouche: { type: Type.STRING },
            },
            required: ["oeil", "nez", "bouche"]
          },
          service: {
            type: Type.OBJECT,
            properties: {
              temperature: { type: Type.STRING },
              garde: { type: Type.STRING },
              accords: { type: Type.STRING },
            },
            required: ["temperature", "garde", "accords"]
          }
        },
        required: [
          "aop",
          "sol",
          "cepage",
          "vinification",
          "elevage",
          "degustation",
          "service"
        ]
      };

      for (const modelName of modelsToTry) {
        try {
          console.log(`[API/gemini/generate-technical-sheet] Generating structured sheet for ${effectiveWineName} with ${modelName}...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: "Tu es un sommelier et œnologue professionnel. Remplis minutieusement chacun des champs de la fiche technique en français d'expert.",
              responseMimeType: "application/json",
              responseSchema
            }
          });

          responseText = response?.text || "";
          if (responseText) {
            console.log(`[API/gemini/generate-technical-sheet] Success with ${modelName}`);
            lastError = null;
            break;
          }
        } catch (err: any) {
          console.warn(`[API/gemini/generate-technical-sheet] Model ${modelName} failed:`, err.message || err);
          lastError = err;
        }
      }

      if (lastError || !responseText) {
        throw lastError || new Error("Aucune réponse n'a été retournée par le modèle.");
      }

      // Safe markdown strip
      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const sheetData = JSON.parse(cleaned);

      // Ensure proper structure
      const sanitizedSheet = {
        aop: sheetData.aop || effectiveWineName,
        lieuDit: sheetData.lieuDit || '',
        sol: sheetData.sol || '',
        cepage: sheetData.cepage || '',
        ageVignes: sheetData.ageVignes || '',
        rendement: sheetData.rendement || '',
        densite: sheetData.densite || '',
        surface: sheetData.surface || '',
        culture: sheetData.culture || '',
        vinification: sheetData.vinification || '',
        elevage: sheetData.elevage || '',
        degustation: {
          oeil: sheetData.degustation?.oeil || '',
          nez: sheetData.degustation?.nez || '',
          bouche: sheetData.degustation?.bouche || ''
        },
        service: {
          temperature: sheetData.service?.temperature || '',
          garde: sheetData.service?.garde || '',
          accords: sheetData.service?.accords || ''
        }
      };

      res.json(sanitizedSheet);
    } catch (error: any) {
      console.error("[API/gemini/generate-technical-sheet] Gemini API error during structured generation:", error);
      res.status(500).json({ error: error.message || "Une erreur interne de génération de fiche technique est survenue." });
    }
  });

  // API endpoint to generate tasting notes & sommelier insights securely
  app.post("/api/gemini/generate-sheet", async (req, res) => {
    console.log("[API/gemini/generate-sheet] Received request body:", req.body);
    try {
      // 1. Check for API key existence before initializing
      const apiKey = process.env.GEMINI_API_KEY;
      console.log("[API/gemini/generate-sheet] Key prefix check:", apiKey ? apiKey.substring(0, 8) + "..." : "undefined");
      if (!apiKey) {
        console.error("Missing GEMINI_API_KEY env variable");
        return res.status(500).json({ 
          error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur. Veuillez l'ajouter dans les paramètres d'environnement." 
        });
      }

      // 2. Strict input type sanitation to prevent crashes from bad request payloads
      const wineName = typeof req.body?.wineName === 'string' ? req.body.wineName.trim() : '';
      const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : '';
      const vintage = typeof req.body?.vintage === 'string' ? req.body.vintage.trim() : '';
      const color = typeof req.body?.color === 'string' ? req.body.color.trim() : '';
      const region = typeof req.body?.region === 'string' ? req.body.region.trim() : '';
      
      if (!wineName) {
        console.error("[API/gemini/generate-sheet] Missing wineName");
        return res.status(400).json({ error: "Le nom du vin ou l'appellation est requis." });
      }

      // 3. Lazy initialize the SDK client securely inside the request context
      console.log("[API/gemini/generate-sheet] Initializing GoogleGenAI client...");
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Rédige des notes de dégustation, des conseils de sommelier et des accords mets-vins pour le vin d'exception suivant :
Nom : ${wineName}
Domaine : ${domain || 'N/C'}
Millésime : ${vintage || 'N/C'}
Couleur : ${color || 'N/C'}
Région/Terroir : ${region || 'N/C'}

Le ton doit être extrêmement professionnel, poétique, élégant, digne d'un restaurant gastronomique étoilé (Savoir-faire, noblesse, terroir).
Reste concis (environ 3-4 phrases courtes). Ne mets pas de titres, écris directement le paragraphe d'introduction de dégustation. Ne commence pas par des guillemets.`;

      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let responseText = "";
      let lastError = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`[API/gemini/generate-sheet] Calling ai.models.generateContent with model ${modelName}...`);
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });
          responseText = response?.text || "";
          if (responseText) {
            console.log(`[API/gemini/generate-sheet] Success with model: ${modelName}`);
            lastError = null;
            break;
          }
        } catch (err: any) {
          console.warn(`[API/gemini/generate-sheet] Model ${modelName} failed:`, err.message || err);
          lastError = err;
        }
      }

      if (lastError) {
        throw lastError;
      }

      const generatedText = responseText || "Erreur lors du traitement par l'intelligence artificielle.";
      res.json({ text: generatedText });
    } catch (error: any) {
      console.error("[API/gemini/generate-sheet] Gemini API error during generation:", error);
      res.status(500).json({ error: error.message || "Une erreur interne de génération est survenue." });
    }
  });

  // API endpoint to extract and structure data from a winery's raw copy-pasted text
  app.post("/api/gemini/extract-technical-sheet", async (req, res) => {
    console.log("[API/gemini/extract-technical-sheet] Analyzing copy-pasted text...");
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("Missing GEMINI_API_KEY env variable");
        return res.status(500).json({ 
          error: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée sur le serveur. Veuillez l'ajouter dans les paramètres d'environnement." 
        });
      }

      const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText.trim() : '';
      if (!rawText) {
        return res.status(400).json({ error: "Le texte de la fiche technique à analyser est requis." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Tu es un sommelier d'élite et œnologue expert. On te donne ci-dessous un extrait de texte brut copié-collé depuis le site d'un producteur de vin ou d'une fiche technique PDF.
Ta mission absolue est de lire attentivement ce texte pour en extraire TOUTES les caractéristiques techniques réelles sans aucune hallucination ni invention.
Si une information (comme l'âge des vignes, la densité ou le rendement) n'est absolument PAS mentionnée ou déduisible du texte fourni, laisse le champ vide ("") dans ton objet JSON. Ne devine rien si le texte ne le permet pas. S'il s'agit d'un vin blanc, d'un rouge, etc., configure les détails en français d'expert.

Texte brut de la fiche producteur à analyser :
"""
${rawText}
"""

Extrais rigoureusement les informations dans l'objet JSON structuré suivant :
- aop : Appellation d'Origine Protégée/Contrôlée (ex: Bourgogne Aligoté, Chassagne-Montrachet...)
- lieuDit : Lieu-dit ou climat s'il y en a un (ex: Les Plumes, Blanchots...)
- sol : Nature géologique du sol (ex: Argilo-calcaire, Argileux...)
- cepage : Cépages et encépagement (ex: Aligoté, Chardonnay, Pinot Noir...)
- ageVignes : Âge moyen ou indicatif des vignes (ex: 40 ans)
- rendement : Rendement typique (ex: 55 hl/ha)
- densite : Densité de plantation (ex: 10 000 pieds/ha)
- surface : Surface de la parcelle (ex: 0,60 ha)
- culture : Mode de culture (ex: Biologique, Biodynamique, En conversion...)
- vinification : Description élégante et fidèle de la méthode de vinification (pressurage, levures, fermentation...)
- elevage : Élevage (ex: 14 mois en fût de 1 à 5 vins)
- degustation : Un objet contenant :
  - oeil : Profil visuel s'il est décrit
  - nez : Profil olfactif s'il est décrit
  - bouche : Profil gustatif s'il est décrit
- service : Un objet contenant :
  - temperature : Température idéale de service (ex: 11-13°C)
  - garde : Potentiel de garde estimé
  - accords : Accords mets-vins recommandés`;

      console.log("[API/gemini/extract-technical-sheet] Calling Gemini for extraction...");
      const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
      let responseText = "";
      let lastError = null;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          aop: { type: Type.STRING },
          lieuDit: { type: Type.STRING },
          sol: { type: Type.STRING },
          cepage: { type: Type.STRING },
          ageVignes: { type: Type.STRING },
          rendement: { type: Type.STRING },
          densite: { type: Type.STRING },
          surface: { type: Type.STRING },
          culture: { type: Type.STRING },
          vinification: { type: Type.STRING },
          elevage: { type: Type.STRING },
          degustation: {
            type: Type.OBJECT,
            properties: {
              oeil: { type: Type.STRING },
              nez: { type: Type.STRING },
              bouche: { type: Type.STRING },
            }
          },
          service: {
            type: Type.OBJECT,
            properties: {
              temperature: { type: Type.STRING },
              garde: { type: Type.STRING },
              accords: { type: Type.STRING },
            }
          }
        }
      };

      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema
            }
          });
          responseText = response?.text || "";
          if (responseText) {
            lastError = null;
            break;
          }
        } catch (err: any) {
          console.warn(`[API/gemini/extract-technical-sheet] Model ${modelName} failed:`, err.message || err);
          lastError = err;
        }
      }

      if (lastError || !responseText) {
        throw lastError || new Error("Aucune réponse du modèle.");
      }

      let cleaned = responseText.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const sheetData = JSON.parse(cleaned);
      res.json(sheetData);
    } catch (error: any) {
      console.error("[API/gemini/extract-technical-sheet] Error during extraction:", error);
      res.status(500).json({ error: error.message || "Une erreur interne est survenue lors de l'extraction." });
    }
  });

  // Vite middleware for development (HMR is disabled in AI Studio iframe environment)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
    });

    // Intercept @vite/client to silence WebSocket connection in sandboxed iframe environment
    app.get("/@vite/client", async (req, res, next) => {
      try {
        const transformed = await vite.transformRequest("/@vite/client");
        if (transformed?.code) {
          let code = transformed.code;
          code = `class DummyWebSocket { constructor() { this.readyState = 1; this.OPEN = 1; } addEventListener(e, cb) { if (e === "open") setTimeout(cb, 0); } removeEventListener() {} send() {} close() {} };\n` + code;
          code = code.replace(/new WebSocket\(/g, "new DummyWebSocket(");
          code = code.replace(
            /const socket = options\.createConnection\(\);/g,
            `const socket = new DummyWebSocket();`
          );
          code = code.replace(/reject\(new Error\((["\x27])WebSocket closed without opened\.\1\)\);/g, "resolve();");
          code = code.replace(/console\.error\(\s*`\[vite\] failed to connect to websocket[\s\S]*?`\s*\);/g, "// [vite] websocket connection ignored in iframe");
          code = code.replace(/console\.error\(`\[vite\] failed to connect to websocket \(\$\{e\}\)\. `\);/g, "// [vite] websocket connection ignored in iframe");
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-cache");
          return res.send(code);
        }
      } catch (err) {
        // Fallback to default
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
