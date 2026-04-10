let pamatky = [];
let mapa = null;
let vrstvaMarkeru = null;
let aktivniId = null;

const seznam = document.getElementById("seznam-pamatek");
const detail = document.getElementById("detail-pamatky");
const vyhledavani = document.getElementById("vyhledavani");
const filtrKraj = document.getElementById("filtr-kraj");

const VYCHOZI_STRED = [49.8, 15.5];
const VYCHOZI_ZOOM = 7;
const DETAIL_ZOOM = 11;
const MAX_AUTO_ZOOM = 8;

function vytvorSlug(text) {
  return (text || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function vytvorIdPamatky(pamatka) {
  const cast1 = vytvorSlug(pamatka.nazev);
  const cast2 = vytvorSlug(pamatka.mesto);
  return `${cast1}-${cast2}`.replace(/^-+|-+$/g, "");
}

function ziskejIdZUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function nastavUrlProPamatku(pamatka) {
  if (!pamatka || !pamatka.id) return;

  const url = new URL(window.location.href);
  url.searchParams.set("id", pamatka.id);
  window.history.replaceState({}, "", url.toString());
}

function jePlatneCislo(hodnota) {
  return typeof hodnota === "number" && Number.isFinite(hodnota);
}

function maPlatneSouradnice(pamatka) {
  return jePlatneCislo(pamatka.lat) && jePlatneCislo(pamatka.lng);
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jePrimyOdkazNaObrazek(url) {
  if (!url || typeof url !== "string") return false;
  return /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(url);
}

function normalizujPamatku(pamatka) {
  const lat = jePlatneCislo(pamatka.lat)
    ? pamatka.lat
    : (typeof pamatka.lat === "string" && pamatka.lat.trim() !== "" ? Number(pamatka.lat) : null);

  const lngZdroj = pamatka.lng ?? pamatka.lon ?? null;
  const lng = jePlatneCislo(lngZdroj)
    ? lngZdroj
    : (typeof lngZdroj === "string" && lngZdroj.trim() !== "" ? Number(lngZdroj) : null);

  return {
    id: pamatka.id || vytvorIdPamatky(pamatka),
    nazev: pamatka.nazev || "Bez názvu",
    typ: pamatka.typ || "",
    mesto: pamatka.mesto || "",
    kraj: pamatka.kraj || "",
    lokalita: pamatka.lokalita || "",
    rok: pamatka.rok || "",
    epidemie: pamatka.epidemie || "",
    duvod: pamatka.duvod || "",
    ikonografie: pamatka.ikonografie || "",
    patroni: pamatka.patroni || "",
    foto: pamatka.foto || "",
    zdroj: pamatka.zdroj || "",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

function vytvorPrezentacniText(p) {
  const casti = [];

  if (p.nazev && p.mesto) {
    casti.push(`${p.nazev} se nachází v lokalitě ${p.mesto}${p.lokalita ? `, ${p.lokalita}` : ""}.`);
  } else if (p.nazev) {
    casti.push(`${p.nazev} představuje jednu z evidovaných morových památek.`);
  }

  if (p.rok) {
    casti.push(`Památka vznikla v období ${p.rok}.`);
  }

  if (p.epidemie) {
    casti.push(`Souvisí s kontextem ${p.epidemie}.`);
  }

  if (p.duvod) {
    const duvodText = p.duvod.charAt(0).toLowerCase() + p.duvod.slice(1);
    casti.push(`Jejím smyslem bylo ${duvodText}.`);
  }

  if (p.ikonografie) {
    casti.push(`V ikonografii se uplatňuje zejména ${p.ikonografie}.`);
  }

  return casti.join(" ");
}

function zobrazSeznam(filtrovanePamatky = pamatky) {
  seznam.innerHTML = "";

  if (!filtrovanePamatky.length) {
    const prazdnaPolozka = document.createElement("li");
    prazdnaPolozka.textContent = "Nebyla nalezena žádná památka.";
    seznam.appendChild(prazdnaPolozka);
    return;
  }

  filtrovanePamatky.forEach((pamatka) => {
    const polozka = document.createElement("li");
    polozka.textContent = `${pamatka.nazev} – ${pamatka.mesto}`;
    polozka.dataset.id = pamatka.id;

    if (aktivniId === pamatka.id) {
      polozka.classList.add("aktivni-pamatka");
    }

    polozka.addEventListener("click", () => {
      zobrazDetailPodleId(pamatka.id);
      nastavUrlProPamatku(pamatka);

      if (maPlatneSouradnice(pamatka) && mapa) {
        mapa.setView([pamatka.lat, pamatka.lng], DETAIL_ZOOM);
      }
    });

    seznam.appendChild(polozka);
  });
}

function vzdalenostKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function najdiSouvisejiciPamatky(aktualniPamatka, pocet = 3) {
  if (!maPlatneSouradnice(aktualniPamatka)) {
    return [];
  }

  return pamatky
    .filter((p) => p.id !== aktualniPamatka.id && maPlatneSouradnice(p))
    .map((p) => ({
      ...p,
      vzdalenost: vzdalenostKm(
        aktualniPamatka.lat,
        aktualniPamatka.lng,
        p.lat,
        p.lng
      )
    }))
    .sort((a, b) => a.vzdalenost - b.vzdalenost)
    .slice(0, pocet);
}

function vytvorHtmlSouvisejicichPamatek(aktualniPamatka) {
  const souvisejici = najdiSouvisejiciPamatky(aktualniPamatka);

  if (souvisejici.length === 0) {
    return `
      <div class="souvisejici-blok">
        <h4>Další památky v okolí</h4>
        <p><em>Další památky v okolí nejsou k dispozici.</em></p>
      </div>
    `;
  }

  const polozky = souvisejici
    .map((p) => {
      return `
        <li>
          <a href="?id=${encodeURIComponent(p.id)}" class="souvisejici-link" data-id="${escapeHtml(p.id)}">
            ${escapeHtml(p.nazev)} – ${escapeHtml(p.mesto)}
          </a>
          <span>(${p.vzdalenost.toFixed(1)} km)</span>
        </li>
      `;
    })
    .join("");

  return `
    <div class="souvisejici-blok">
      <h4>Další památky v okolí</h4>
      <ul class="souvisejici-seznam">
        ${polozky}
      </ul>
    </div>
  `;
}

function vytvorBlokFotografie(p) {
  if (!p.foto) {
    return `<p><em>Obrázek není k dispozici.</em></p>`;
  }

  if (jePrimyOdkazNaObrazek(p.foto)) {
    return `<img src="${escapeHtml(p.foto)}" alt="${escapeHtml(p.nazev)}" onerror="this.outerHTML='&lt;p&gt;&lt;em&gt;Obrázek není k dispozici.&lt;/em&gt;&lt;/p&gt;'">`;
  }

  return `
    <p><em>Přímý obrázek není k dispozici.</em></p>
    <p>
      <a href="${escapeHtml(p.foto)}" target="_blank" rel="noopener noreferrer">
        Otevřít zdrojovou stránku / fotografii
      </a>
    </p>
  `;
}

function vytvorBlokZdroje(p) {
  const casti = [];

  if (p.zdroj) {
    casti.push(`<p><strong>Zdroj:</strong> ${escapeHtml(p.zdroj)}</p>`);
  } else {
    casti.push(`<p><strong>Zdroj:</strong> Neuvedeno</p>`);
  }

  if (p.foto && !jePrimyOdkazNaObrazek(p.foto)) {
    casti.push(`
      <p>
        <strong>Odkaz:</strong>
        <a href="${escapeHtml(p.foto)}" target="_blank" rel="noopener noreferrer">
          Otevřít externí stránku
        </a>
      </p>
    `);
  }

  return casti.join("");
}

function vytvorBlokNavigace(p) {
  if (!maPlatneSouradnice(p)) {
    return `<p><em>Navigace není k dispozici.</em></p>`;
  }

  return `
    <p>
      <a href="https://www.google.com/maps?q=${encodeURIComponent(`${p.lat},${p.lng}`)}" target="_blank" rel="noopener noreferrer">
        Navigovat k památce
      </a>
    </p>
  `;
}

function zobrazDetailPodleId(id) {
  const pamatka = pamatky.find((p) => p.id === id);

  if (!pamatka) {
    detail.innerHTML = `<p><em>Požadovaná památka nebyla nalezena.</em></p>`;
    aktivniId = null;
    zobrazSeznam(aktualneFiltrovanePamatky());
    return;
  }

  aktivniId = pamatka.id;

  const prezentacniText = vytvorPrezentacniText(pamatka);

  detail.innerHTML = `
    <h3>${escapeHtml(pamatka.nazev)}</h3>
    <p class="prezentacni-text">${escapeHtml(prezentacniText || "K této památce zatím není připraven stručný prezentační text.")}</p>
    <p><strong>Typ památky:</strong> ${escapeHtml(pamatka.typ || "Neuvedeno")}</p>
    <p><strong>Město:</strong> ${escapeHtml(pamatka.mesto || "Neuvedeno")}</p>
    <p><strong>Lokalita:</strong> ${escapeHtml(pamatka.lokalita || "Neuvedeno")}</p>
    <p><strong>Kraj:</strong> ${escapeHtml(pamatka.kraj || "Neuvedeno")}</p>
    <p><strong>Rok / období vzniku:</strong> ${escapeHtml(pamatka.rok || "Neuvedeno")}</p>
    <p><strong>Epidemie:</strong> ${escapeHtml(pamatka.epidemie || "Neuvedeno")}</p>
    <p><strong>Důvod vzniku:</strong> ${escapeHtml(pamatka.duvod || "Neuvedeno")}</p>
    <p><strong>Hlavní ikonografie:</strong> ${escapeHtml(pamatka.ikonografie || "Neuvedeno")}</p>
    <p><strong>Patroni:</strong> ${escapeHtml(pamatka.patroni || "Neuvedeno")}</p>
    ${vytvorBlokZdroje(pamatka)}
    ${vytvorBlokNavigace(pamatka)}
    ${vytvorBlokFotografie(pamatka)}
    ${vytvorHtmlSouvisejicichPamatek(pamatka)}
  `;

  zobrazSeznam(aktualneFiltrovanePamatky());

  const odkazy = detail.querySelectorAll(".souvisejici-link");
  odkazy.forEach((odkaz) => {
    odkaz.addEventListener("click", (event) => {
      event.preventDefault();
      const idPam = odkaz.dataset.id;
      zobrazDetailPodleId(idPam);

      const p = pamatky.find((item) => item.id === idPam);
      if (p) {
        nastavUrlProPamatku(p);
        if (maPlatneSouradnice(p) && mapa) {
          mapa.setView([p.lat, p.lng], DETAIL_ZOOM);
        }
      }
    });
  });
}

function naplnFiltrKraju() {
  filtrKraj.innerHTML = '<option value="">Všechny kraje</option>';

  const kraje = [...new Set(pamatky.map((p) => p.kraj).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "cs")
  );

  kraje.forEach((kraj) => {
    const moznost = document.createElement("option");
    moznost.value = kraj;
    moznost.textContent = kraj;
    filtrKraj.appendChild(moznost);
  });
}

function inicializujMapu() {
  mapa = L.map("map").setView(VYCHOZI_STRED, VYCHOZI_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapa);

  vrstvaMarkeru = L.layerGroup().addTo(mapa);
  aktualizujMapu(pamatky, false);
}

function aktualizujMapu(filtrovanePamatky, prizpusobitVyrez = true) {
  if (!vrstvaMarkeru || !mapa) return;

  vrstvaMarkeru.clearLayers();

  const body = [];

  filtrovanePamatky.forEach((pamatka) => {
    if (!maPlatneSouradnice(pamatka)) {
      return;
    }

    body.push([pamatka.lat, pamatka.lng]);

    const marker = L.marker([pamatka.lat, pamatka.lng]).addTo(vrstvaMarkeru);

    marker.bindPopup(`<strong>${escapeHtml(pamatka.nazev)}</strong><br>${escapeHtml(pamatka.mesto)}`);

    marker.on("click", () => {
      zobrazDetailPodleId(pamatka.id);
      nastavUrlProPamatku(pamatka);
      mapa.setView([pamatka.lat, pamatka.lng], DETAIL_ZOOM);
    });
  });

  if (!prizpusobitVyrez) {
    return;
  }

  if (body.length === 0) {
    mapa.setView(VYCHOZI_STRED, VYCHOZI_ZOOM);
    return;
  }

  if (body.length === 1) {
    mapa.setView(body[0], DETAIL_ZOOM);
    return;
  }

  const bounds = L.latLngBounds(body);
  mapa.fitBounds(bounds, { padding: [30, 30] });

  if (mapa.getZoom() > MAX_AUTO_ZOOM) {
    mapa.setZoom(MAX_AUTO_ZOOM);
  }
}

function aktualneFiltrovanePamatky() {
  const hledanyText = (vyhledavani.value || "").toLowerCase().trim();
  const vybranyKraj = filtrKraj.value;

  return pamatky.filter((pamatka) => {
    const textProHledani = `${pamatka.nazev} ${pamatka.mesto} ${pamatka.lokalita} ${pamatka.typ}`.toLowerCase();
    const odpovidaTextu = textProHledani.includes(hledanyText);
    const odpovidaKraji = vybranyKraj === "" || pamatka.kraj === vybranyKraj;
    return odpovidaTextu && odpovidaKraji;
  });
}

function aplikujFiltry() {
  const filtrovane = aktualneFiltrovanePamatky();
  zobrazSeznam(filtrovane);
  aktualizujMapu(filtrovane, true);

  if (aktivniId) {
    const aktivniJeViditelna = filtrovane.some((p) => p.id === aktivniId);
    if (!aktivniJeViditelna) {
      detail.innerHTML = `<p><em>Aktuálně vybraná památka neodpovídá nastavenému filtru.</em></p>`;
    }
  }
}

function otevriPamatkuZUrl() {
  const idZUrl = ziskejIdZUrl();
  if (!idZUrl) return;

  const pamatka = pamatky.find((p) => p.id === idZUrl);
  if (!pamatka) {
    detail.innerHTML = `<p><em>Požadovaná památka nebyla nalezena.</em></p>`;
    return;
  }

  zobrazDetailPodleId(idZUrl);

  if (maPlatneSouradnice(pamatka) && mapa) {
    mapa.setView([pamatka.lat, pamatka.lng], DETAIL_ZOOM);
  }
}

fetch("data.json")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Nepodařilo se načíst data.json (HTTP ${response.status})`);
    }
    return response.json();
  })
  .then((data) => {
    pamatky = data.map(normalizujPamatku);

    zobrazSeznam();
    naplnFiltrKraju();
    inicializujMapu();
    otevriPamatkuZUrl();
  })
  .catch((error) => {
    console.error("Chyba při načítání dat:", error);
    detail.innerHTML = `<p><em>Data se nepodařilo načíst.</em></p>`;
  });

vyhledavani.addEventListener("input", aplikujFiltry);
filtrKraj.addEventListener("change", aplikujFiltry);