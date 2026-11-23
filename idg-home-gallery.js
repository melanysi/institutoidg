(() => {
  "use strict";

  const grid = document.getElementById("home-gallery-grid");
  const more = document.getElementById("home-gallery-more");
  const status = document.getElementById("home-gallery-status");
  const config = window.IDG_SUPABASE_CONFIG;
  if (!grid || !more || !status || !window.supabase || !config?.url || !config?.publishableKey) return;

  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { storageKey: "idg-home-gallery", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) }
  });
  const bucket = client.storage.from("idg-media");
  const pageSize = 8;
  const firstStaticPhoto = grid.firstElementChild;
  const paths = new WeakMap();
  const imageUrls = new Set();
  let cursor;

  async function showImage(figure) {
    try {
      const { data, error } = await bucket.download(paths.get(figure));
      if (error || !data) throw error || new Error("Fotografia indisponível.");
      const url = URL.createObjectURL(data);
      imageUrls.add(url);
      const image = figure.querySelector("img");
      image.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        imageUrls.delete(url);
        figure.remove();
      }, { once: true });
      image.src = url;
    } catch {
      figure.remove();
    }
  }

  const photosInView = typeof IntersectionObserver !== "undefined"
    ? new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        void showImage(entry.target);
      }
    }, { rootMargin: "200px" })
    : null;

  function addPhoto(photo) {
    const figure = document.createElement("figure");
    figure.className = "gallery-item";
    const image = document.createElement("img");
    image.alt = photo.alt_text;
    image.decoding = "async";
    figure.append(image);
    if (photo.caption) {
      const caption = document.createElement("figcaption");
      caption.textContent = photo.caption;
      figure.append(caption);
    }
    grid.insertBefore(figure, firstStaticPhoto);
    paths.set(figure, photo.storage_path);
    if (photosInView) photosInView.observe(figure);
    else void showImage(figure);
  }

  async function loadPhotos() {
    more.disabled = true;
    status.hidden = true;
    try {
      let query = client.from("idg_home_gallery_photos")
        .select("id,storage_path,alt_text,caption,created_at")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(pageSize + 1);
      if (cursor) {
        const { id, created_at: date } = cursor;
        query = query.or(`created_at.lt.${date},and(created_at.eq.${date},id.lt.${id})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const page = data.slice(0, pageSize);
      for (const photo of page) addPhoto(photo);
      if (page.length) cursor = page.at(-1);
      more.hidden = data.length <= pageSize;
      more.textContent = "Ver mais fotos";
    } catch {
      status.textContent = "Não foi possível carregar as fotos mais recentes.";
      status.hidden = false;
      more.textContent = "Tentar novamente";
      more.hidden = false;
    } finally {
      more.disabled = false;
    }
  }

  more.addEventListener("click", loadPhotos);
  window.addEventListener("pagehide", event => {
    if (event.persisted) return;
    for (const url of imageUrls) URL.revokeObjectURL(url);
    imageUrls.clear();
  });

  if (typeof IntersectionObserver === "undefined") {
    void loadPhotos();
    return;
  }
  const galleryInView = new IntersectionObserver((entries, observer) => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    void loadPhotos();
  }, { rootMargin: "300px" });
  galleryInView.observe(grid);
})();
