let pamatky = [];
let mapa;
let vrstvaMarkeru;

const seznam = document.getElementById("seznam-pamatek");
const detail = document.getElementById("detail-pamatky");
const vyhledavani = document.getElementById("vyhledavani");
const filtrKraj = document.getElementById("filtr-kraj");

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
  return `${cast1}-${cast2}`;
}

function ziskejIdZUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function nastavUrlProPamatku(pamatka) {
  const id = pamatka._id;
  const novaUrl = `${window.location.pathname}?id=${encodeURIComponent(id)}`;
  window.history.replaceState({}, "", novaUrl);
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
    casti.push(`Jejím smyslem bylo ${p.duvod.charAt(0).toLowerCase()}${p.duvod.slice(1)}.`);
  }

  if (p.ikonografie) {
    casti.push(`V ikonografii se uplatňuje zejména ${p.ikonografie}.`);
  }

  return casti.join(" ");
}

function zobrazSeznam(filtrovanePamatky = pamatky) {
  seznam.innerHTML = "";

  filtrovanePamatky.forEach((pamatka) => {
    const puvodniIndex = pamatky.indexOf(pamatka);

    const polozka = document.createElement("li");
    polozka.textContent = `${pamatka.nazev} – ${pamatka.mesto}`;
    polozka.style.cursor = "pointer";

    polozka.addEventListener("click", () => {
      zobrazDetail(puvodniIndex);
      nastavUrlProPamatku(pamatka);
    });

    seznam.appendChild(polozka);
  });
}

function vzdalenostKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function najdiSouvisejiciPamatky(aktualniPamatka, pocet = 3) {
  if (!aktualniPamatka.lat || !aktualniPamatka.lon) {
    return [];
  }

  return pamatky
    .filter((p) => p._id !== aktualniPamatka._id && p.lat && p.lon)
    .map((p) => ({
      ...p,
      vzdalenost: vzdalenostKm(
        aktualniPamatka.lat,
        aktualniPamatka.lon,
        p.lat,
        p.lon
      )
    }))
    .sort((a, b) => a.vzdalenost - b.vzdalenost)
    .slice(0, pocet);
}

function vytvorHtmlSouvisejicichPamatok(aktualniPamatka) {
  const souvisejici = najdiSouvisejiciPamatky(aktualniPamatka);

  if (souvisejici.length === 0) {
    return `<p><em>Další památky v okolí nejsou k dispozici.</em></p>`;
  }

  const polozky = souvisejici.map((p) => {
    return `
      <li>
        <a href="?id=${encodeURIComponent(p._id)}" class="souvisejici-link" data-id="${p._id}">
          ${p.nazev} – ${p.mesto}
        </a>
        <span>(${p.vzdalenost.toFixed(1)} km)</span>
      </li>
    `;
  }).join("");

  return `
    <div class="souvisejici-blok">
      <h4>Další památky v okolí</h4>
      <ul class="souvisejici-seznam">
        ${polozky}
      </ul>
    </div>
  `;
}

function zobrazDetail(index) {
  const p = pamatky[index];
  const prezentacniText = vytvorPrezentacniText(p);

  const navigaceOdkaz =
    p.lat && p.lon
      ? `<p><a href="https://www.google.com/maps?q=${p.lat},${p.lon}" target="_blank" rel="noopener noreferrer">Navigovat k památce</a></p>`
      : `<p><em>Navigace není k dispozici.</em></p>`;

  const odkazNaZdroj = p.zdroj
    ? `<p><strong>Zdroj:</strong> <a href="${p.zdroj}" target="_blank" rel="noopener noreferrer">${p.zdroj}</a></p>`
    : `<p><strong>Zdroj:</strong> Neuvedeno</p>`;

  detail.innerHTML = `
    <h3>${p.nazev}</h3>
    <p class="prezentacni-text">${prezentacniText}</p>
    <p><strong>Typ památky:</strong> ${p.typ || "Neuvedeno"}</p>
    <p><strong>Město:</strong> ${p.mesto || "Neuvedeno"}</p>
    <p><strong>Lokalita:</strong> ${p.lokalita || "Neuvedeno"}</p>
    <p><strong>Kraj:</strong> ${p.kraj || "Neuvedeno"}</p>
    <p><strong>Rok / období vzniku:</strong> ${p.rok || "Neuvedeno"}</p>
    <p><strong>Epidemie:</strong> ${p.epidemie || "Neuvedeno"}</p>
    <p><strong>Důvod vzniku:</strong> ${p.duvod || "Neuvedeno"}</p>
    <p><strong>Hlavní ikonografie:</strong> ${p.ikonografie || "Neuvedeno"}</p>
    ${odkazNaZdroj}
    ${navigaceOdkaz}
    ${
      p.foto
        ? `<img src="${p.foto}" alt="${p.nazev}" onerror="this.outerHTML='<p><em>Obrázek není k dispozici.</em></p>'">`
        : `<p><em>Obrázek není k dispozici.</em></p>`
    }
    ${vytvorHtmlSouvisejicichPamatok(p)}
  `;

  const odkazy = detail.querySelectorAll(".souvisejici-link");
  odkazy.forEach((odkaz) => {
    odkaz.addEventListener("click", (event) => {
      event.preventDefault();
      const id = odkaz.dataset.id;
      const novyIndex = pamatky.findIndex((pamatka) => pamatka._id === id);
      if (novyIndex !== -1) {
        zobrazDetail(novyIndex);
        nastavUrlProPamatku(pamatky[novyIndex]);
      }
    });
  });
}

function naplnFiltrKraju() {
  filtrKraj.innerHTML = '<option value="">Všechny kraje</option>';

  const kraje = [...new Set(pamatky.map((p) => p.kraj).filter(Boolean))].sort();

  kraje.forEach((kraj) => {
    const moznost = document.createElement("option");
    moznost.value = kraj;
    moznost.textContent = kraj;
    filtrKraj.appendChild(moznost);
  });
}

function inicializujMapu() {
  mapa = L.map("map").setView([49.8, 15.5], 7);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(mapa);

  vrstvaMarkeru = L.layerGroup().addTo(mapa);
  aktualizujMapu(pamatky);
}

function aktualizujMapu(filtrovanePamatky) {
  vrstvaMarkeru.clearLayers();

  filtrovanePamatky.forEach((pamatka) => {
    if (pamatka.lat && pamatka.lon) {
      const puvodniIndex = pamatky.indexOf(pamatka);

      const marker = L.marker([pamatka.lat, pamatka.lon]).addTo(vrstvaMarkeru);

      marker.bindPopup(`<strong>${pamatka.nazev}</strong><br>${pamatka.mesto}`);

      marker.on("click", () => {
        zobrazDetail(puvodniIndex);
        nastavUrlProPamatku(pamatka);
      });
    }
  });
}

function aplikujFiltry() {
  const hledanyText = vyhledavani.value.toLowerCase();
  const vybranyKraj = filtrKraj.value;

  const filtrovane = pamatky.filter((pamatka) => {
    const odpovidaTextu =
      pamatka.nazev.toLowerCase().includes(hledanyText) ||
      pamatka.mesto.toLowerCase().includes(hledanyText);

    const odpovidaKraji =
      vybranyKraj === "" || pamatka.kraj === vybranyKraj;

    return odpovidaTextu && odpovidaKraji;
  });

  zobrazSeznam(filtrovane);
  aktualizujMapu(filtrovane);
}

function otevriPamatkuZUrl() {
  const idZUrl = ziskejIdZUrl();
  if (!idZUrl) return;

  const index = pamatky.findIndex((p) => p._id === idZUrl);
  if (index !== -1) {
    zobrazDetail(index);
  }
}

fetch("data.json")
  .then((response) => response.json())
  .then((data) => {
    pamatky = data.map((pamatka) => ({
      ...pamatka,
      _id: vytvorIdPamatky(pamatka)
    }));

    zobrazSeznam();
    naplnFiltrKraju();
    inicializujMapu();
    otevriPamatkuZUrl();
  })
  .catch((error) => {
    console.error("Chyba při načítání dat:", error);
  });

vyhledavani.addEventListener("input", aplikujFiltry);
filtrKraj.addEventListener("change", aplikujFiltry);