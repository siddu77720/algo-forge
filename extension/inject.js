(function() {
  const OriginalWebSocket = window.WebSocket;
  
  const OTC_PAIRS = [
    "EURUSD_otc", "GBPUSD_otc", "USDJPY_otc", "USDCHF_otc", "AUDUSD_otc",
    "NZDUSD_otc", "USDCAD_otc", "EURGBP_otc", "EURJPY_otc", "GBPJPY_otc",
    "AUDCAD_otc", "AUDCHF_otc", "AUDJPY_otc", "AUDNZD_otc", "CADCHF_otc",
    "CADJPY_otc", "CHFJPY_otc", "EURAUD_otc", "EURCAD_otc", "EURCHF_otc",
    "EURNZD_otc", "GBPAUD_otc", "GBPCAD_otc", "GBPCHF_otc", "GBPNZD_otc",
    "NZDCAD_otc", "NZDCHF_otc", "NZDJPY_otc"
  ];
  let autoSubscribed = false;

  window.WebSocket = function(url, protocols) {
    const ws = new OriginalWebSocket(url, protocols);
    
    const originalSend = ws.send;
    ws.send = function(data) {
      // DEBUG: Send outgoing payload to backend so we can inspect it
      if (typeof data === 'string') {
        try {
          fetch('http://localhost:5000/api/webhook/debug_send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: data })
          }).catch(e => {});
        } catch(e) {}
      }

      // Look for any mention of an asset string (6 uppercase letters followed by optional _otc)
      if (typeof data === 'string' && !autoSubscribed) {
        // Quotex might send: 42["instruments/update",{"asset":"EURUSD_otc","period":60}]
        const match = data.match(/([A-Za-z]{6}_otc)/i);
        if (match) {
          autoSubscribed = true;
          const templatePair = match[1];
          
          setTimeout(() => {
            OTC_PAIRS.forEach((pair, index) => {
              if (pair.toLowerCase() !== templatePair.toLowerCase()) {
                setTimeout(() => {
                   // Replace the original pair with the new pair in the string payload
                   const payload = data.replace(new RegExp(templatePair, 'gi'), pair);
                   originalSend.call(ws, payload);
                }, index * 100);
              }
            });
          }, 2000);
        }
      }
      return originalSend.apply(this, arguments);
    };
    
    ws.addEventListener('message', function(event) {
      if (typeof event.data === 'string') {
        window.postMessage({
          type: "QUOTEX_WS_MESSAGE",
          payload: event.data
        }, "*");
      }
    });
    
    return ws;
  };
  window.WebSocket.prototype = OriginalWebSocket.prototype;
})();
