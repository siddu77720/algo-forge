console.log("[AlgoForge Bridge] Extension loaded on Quotex.");

// We inject a script directly into the page context to listen to the raw WebSocket traffic
const injectScript = document.createElement('script');
injectScript.src = chrome.runtime.getURL('inject.js');
(document.head || document.documentElement).appendChild(injectScript);

// Listen for messages from our injected script
window.addEventListener("message", function(event) {
  if (event.source !== window || !event.data.type) return;

  if (event.data.type === "QUOTEX_WS_MESSAGE") {
    // Forward the raw WebSocket data to our local backend
    fetch('http://localhost:5000/api/webhook/raw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawData: event.data.payload })
    }).catch(e => {});
  }
});

// FALLBACK: Aggressive DOM Scraper
let lastPrice = 0;
let detectedPair = "Unknown Pair";

setInterval(() => {
  try {
    // 1. Try to find the pair name (e.g. Litecoin (OTC), EUR/USD (OTC))
    const pairElements = Array.from(document.querySelectorAll('div, span, button')).filter(el => {
      const text = el.innerText || '';
      return (text.includes('(OTC)') || text.match(/[A-Z]{3}\/[A-Z]{3}/)) && el.children.length === 0;
    });

    if (pairElements.length > 0) {
      detectedPair = pairElements[0].innerText.trim();
    } else if (document.title) {
      const match = document.title.match(/(.*?\(OTC\)|[A-Z]{3}\/[A-Z]{3})/);
      if (match) detectedPair = match[1].trim();
    }

    // 2. Try to find the live price
    // Prices can have 1 to 6 decimals (e.g., 69.52 or 1.08500)
    let detectedPrice = null;
    
    // Explicit known classes
    const priceEl = document.querySelector('.current-price-block') || document.querySelector('.section-deal__price') || document.querySelector('.live-price');
    
    if (priceEl) {
      detectedPrice = parseFloat(priceEl.innerText.replace(/,/g, ''));
    } else {
      // Fallback: Find numbers that update rapidly
      const numElements = Array.from(document.querySelectorAll('div, span')).filter(el => {
        const text = (el.innerText || '').trim();
        // Match numbers like 69.52, 1.08500, etc.
        return text.match(/^\d+\.\d{1,6}$/) && el.children.length === 0;
      });
      if (numElements.length > 0) {
        // Assume the first one is the price
        detectedPrice = parseFloat(numElements[0].innerText);
      }
    }

    if (detectedPair !== "Unknown Pair" && detectedPrice && detectedPrice !== lastPrice) {
      lastPrice = detectedPrice;
      
      // Flash a tiny UI indicator so the user knows it's working
      let indicator = document.getElementById('algoforge-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'algoforge-indicator';
        indicator.style = 'position:fixed; bottom:10px; right:10px; background:#22c55e; color:white; padding:5px 10px; border-radius:5px; z-index:999999; font-weight:bold; font-size:12px; pointer-events:none;';
        document.body.appendChild(indicator);
      }
      indicator.innerText = `AlgoForge: Sending ${detectedPair} @ ${detectedPrice}`;

      fetch('http://localhost:5000/api/webhook/tick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pair: detectedPair, price: detectedPrice, timestamp: Date.now() })
      }).catch(e => {});
    }
  } catch (err) {}
}, 200);

// ONE-TIME DOM DUMP FOR DEBUGGING
setTimeout(() => {
  try {
    const relevantDOM = document.querySelector('body')?.innerHTML || "NO DOM";
    fetch('http://localhost:5000/api/webhook/dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dom: relevantDOM.substring(0, 500000) }) // Send up to 500kb of HTML
    }).catch(e => {});
  } catch (err) {}
}, 3000);
