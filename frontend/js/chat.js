/* ===== CHAT: komponen percakapan admin-pelanggan per pesanan ===== */
function Chat(box, orderId, role) {
  box.innerHTML =
    '<div class="msgs" aria-live="polite"></div><form class="cform"><input placeholder="Tulis pesan…" maxlength="500" required aria-label="Pesan"><button class="btn">Kirim</button></form>';
  const list = $(".msgs", box);
  let last = 0;
  async function pull() {
    try {
      const rows = await api(`/orders/${orderId}/chat?after=${last}`);
      rows.forEach((x) => {
        last = x.id;
        const who = x.sender === "sys" ? "sys" : x.sender === role ? "me" : "them";
        list.insertAdjacentHTML(
          "beforeend",
          `<div class="msg ${who}">${esc(x.text)}<small>${x.time}</small></div>`,
        );
      });
      if (rows.length) list.scrollTop = list.scrollHeight;
    } catch (e) {
      /* abaikan, coba lagi saat polling berikutnya */
    }
  }
  $("form", box).onsubmit = async (e) => {
    e.preventDefault();
    const input = $("input", box);
    try {
      await api(`/orders/${orderId}/chat`, "POST", { text: input.value });
      input.value = "";
      pull();
    } catch (x) {
      toast(x.message);
    }
  };
  pull();
  const timer = setInterval(() => (box.isConnected ? pull() : clearInterval(timer)), 4000);
}
