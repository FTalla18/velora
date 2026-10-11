/* =========================================================
   Botpress bridge
   When the Botpress webchat embed code is on the page, Vee runs
   on Botpress: our own chat launcher is hidden and every
   "Ask Vee" button opens the Botpress chat instead.
   Without the embed code, the built-in Vee chat stays as is.
   ========================================================= */
(function () {
  function useBotpress() {
    const bp = window.botpress;
    if (!bp || typeof bp.open !== "function") return; // embed code not present → keep built-in chat

    const launcher = document.getElementById("chatLauncher");
    const chat = document.getElementById("chat");
    if (launcher) launcher.style.display = "none";
    if (chat) chat.hidden = true;

    // app.js calls window.VeloraChat.open()/send() from the "Ask Vee" buttons.
    window.VeloraChat = {
      open: () => bp.open(),
      minimize: () => typeof bp.close === "function" && bp.close(),
      send: (text) => {
        bp.open();
        if (typeof bp.sendMessage === "function") setTimeout(() => bp.sendMessage(text), 400);
      },
    };
  }
  if (document.readyState === "complete") useBotpress();
  else window.addEventListener("load", useBotpress);
})();
