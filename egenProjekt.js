// --- DATAN (Hämtas från minnet eller startar tom) ---
let händelser = JSON.parse(localStorage.getItem('händelser')) || [];
let familjeMedlemmar = JSON.parse(localStorage.getItem('familjeMedlemmar')) || ["Mamma", "Pappa", "Barnen", "Gemensamt"];
let nuvarandeTema = localStorage.getItem('tema') || 'default';
let usdRate = 0; // Växelkurs för USD

// --- ELEMENT FRÅN HTML ---
const lista = document.getElementById('transaktions-lista');
const form = document.getElementById('transaktions-formulär');
const kommentarRuta = document.getElementById('kommentar-fält');
const medlemSelect = document.getElementById('medlem');
const balansUsdEl = document.getElementById('balans-usd');

// Inställningar-element
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const saveSettings = document.getElementById('save-settings');
const familyInput = document.getElementById('family-members-input');
const resetBtn = document.getElementById('reset-data-btn');
const themeSelect = document.getElementById('theme-select');

// --- EMOJIS ---
const emojis = { 
    pizza: '🍕', mat: '🍔', lön: '💰', bil: '🚗', hyra: '🏠', 
    godis: '🍬', träning: '💪', present: '🎁', glass: '🍦', 
    kaffe: '☕', bio: '🎬', spel: '🎮', kläder: '👕', hund: '🐶' 
};

// --- FUNKTIONER ---

/**
 * VALUTA-API: Hämtar aktuell växelkurs för SEK till USD.
 * Detta används för att visa den totala balansen i dollar.
 */
async function uppdateraValuta() {
    try {
        const svar = await fetch('https://open.er-api.com/v6/latest/SEK');
        const data = await svar.json();
        usdRate = data.rates.USD; // Sparar kursen för USD
        uppdatera(); // Uppdaterar UI så att dollar-beloppet syns
    } catch (fel) {
        console.log("Kunde inte hämta växelkurs:", fel);
    }
}

/**
 * ELPRIS-API: Hämtar dagens elpris för aktuell timme i SE3 (Stockholm/Borås).
 * Vi skapar en dynamisk URL med dagens datum.
 */
async function uppdateraElpris() {
    try {
        const idag = new Date();
        const ar = idag.getFullYear();
        const manad = String(idag.getMonth() + 1).padStart(2, '0');
        const dag = String(idag.getDate()).padStart(2, '0');
        const timme = idag.getHours();
        
        // Dynamisk URL baserad på dagens datum
        const url = `https://www.elprisetjustnu.se/api/v1/prices/${ar}/${manad}-${dag}_SE3.json`;
        
        const svar = await fetch(url);
        const data = await svar.json();
        
        // Hittar priset för just denna timme i listan (0-23)
        const aktuelltPris = data[timme].SEK_per_kWh;
        document.getElementById('elpris').innerText = aktuelltPris.toFixed(2) + " kr/kWh";
    } catch (fel) {
        console.log("Kunde inte hämta elpris:", fel);
        document.getElementById('elpris').innerText = "Ej tillgängligt";
    }
}

/**
 * VÄDER-API (VATTENSTATUS): Hämtar väderdata för att förutse vattenförbrukning.
 * Om det är soligt/varmt varnar vi för hög förbrukning (t.ex. bevattning).
 */
async function uppdateraVattenstatus() {
    try {
        // Vi hämtar väder för Borås-området (lat 57.7, lon 12.9) via Open-Meteo
        const svar = await fetch('https://api.open-meteo.com/v1/forecast?latitude=57.72&longitude=12.94&current=temperature_2m,precipitation,weather_code');
        const data = await svar.json();
        
        const temp = data.current.temperature_2m;
        const regn = data.current.precipitation;
        const statusEl = document.getElementById('vatten-status');
        const ikonEl = document.getElementById('vatten-ikon');

        if (regn > 0) {
            statusEl.innerText = "Låg förbrukning";
            ikonEl.innerText = "🌧️";
        } else if (temp > 20) {
            statusEl.innerText = "Hög (Bevattning)";
            ikonEl.innerText = "☀️";
        } else {
            statusEl.innerText = "Normal förbrukning";
            ikonEl.innerText = "💧";
        }
    } catch (fel) {
        console.log("Kunde inte hämta väderdata:", fel);
        document.getElementById('vatten-status').innerText = "Ej tillgängligt";
    }
}

/**
 * ADVICE-API: Hämtar ett slumpmässigt engelskt råd.
 * Körs varje gång en ny händelse läggs till.
 */
async function hamtaTips() {
    try {
        const svar = await fetch('https://api.adviceslip.com/advice');
        const data = await svar.json();
        kommentarRuta.innerText = data.slip.advice; // Visar rådet i den gula rutan
        kommentarRuta.style.display = 'flex';
        setTimeout(() => kommentarRuta.style.display = 'none', 5000);
    } catch (fel) {
        kommentarRuta.innerText = "Spara pengar är bra! 💰";
    }
}

// Hittar rätt emoji eller ger en standard-penna
const fixaEmoji = (titel) => {
    const titelLåg = titel.toLowerCase();
    const hittad = Object.keys(emojis).find(nyckel => titelLåg.includes(nyckel));
    return hittad ? emojis[hittad] : '📝';
};

// Uppdaterar allt på skärmen
function uppdatera() {
    // Uppdatera familje-dropdown
    medlemSelect.innerHTML = '';
    familjeMedlemmar.forEach(medlem => {
        const option = document.createElement('option');
        option.value = medlem;
        option.textContent = medlem;
        medlemSelect.appendChild(option);
    });

    lista.innerHTML = '';
    let inkomst = 0, utgift = 0;

    händelser.forEach((h, i) => {
        h.typ === 'inkomst' ? inkomst += Number(h.belopp) : utgift += Number(h.belopp);

        lista.innerHTML += `
            <li class="${h.typ === 'inkomst' ? 'income' : 'expense'}">
                <div class="vänster-del">
                    <div class="emoji-ikon">${fixaEmoji(h.titel)}</div>
                    <div class="transaction-info">
                        <span class="transaction-title">${h.titel}</span>
                        <small style="color: var(--text-muted); font-size: 0.75rem;">${h.datum || 'Inget datum'}</small>
                        <span class="familje-tagg">${h.medlem}</span>
                    </div>
                </div>
                <div class="höger-del" style="display:flex; align-items:center; gap:15px;">
                    <span class="transaction-amount">${h.typ === 'inkomst' ? '+' : '-'}${h.belopp} kr</span>
                    <button class="delete-btn" onclick="radera(${i})">✕</button>
                </div>
            </li>`;
    });

    // Uppdatera summorna i toppen
    const balanceEl = document.getElementById('balans');
    const oldBalance = balanceEl.innerText;
    const totalBalans = inkomst - utgift;
    const newBalance = totalBalans + ' kr';
    
    document.getElementById('total-inkomst').innerText = inkomst + ' kr';
    document.getElementById('total-utgift').innerText = utgift + ' kr';
    balanceEl.innerText = newBalance;

    // Visa balans i USD om vi har en kurs
    if (usdRate > 0) {
        const balansUsd = (totalBalans * usdRate).toFixed(2);
        balansUsdEl.innerText = `($${balansUsd} USD)`;
    }

    // Lägg till en liten animation om balansen ändrats
    if (oldBalance !== newBalance) {
        balanceEl.parentElement.parentElement.classList.add('pulse');
        setTimeout(() => balanceEl.parentElement.parentElement.classList.remove('pulse'), 500);
    }

    localStorage.setItem('händelser', JSON.stringify(händelser));
}

// Tar bort en händelse
const radera = (i) => {
    händelser.splice(i, 1);
    uppdatera();
};

// --- HÄNDELSER ---

form.addEventListener('submit', (h) => {
    h.preventDefault();
    
    // Skapa händelsen och gör beloppet positivt
    const ny = {
        titel: document.getElementById('titel').value,
        belopp: Math.abs(document.getElementById('belopp').value),
        typ: document.getElementById('typ').value,
        medlem: document.getElementById('medlem').value,
        datum: new Date().toISOString().split('T')[0] // Spara dagens datum
    };
    
    händelser.push(ny);
    
    // Hämta ett tips från API istället för lokala skämt
    hamtaTips();

    uppdatera();
    form.reset();
});

// --- INSTÄLLNINGAR LOGIK ---

// Applicera tema
function appliceraTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('tema', tema);
}

// Öppna modal
settingsBtn.addEventListener('click', () => {
    familyInput.value = familjeMedlemmar.join(', ');
    themeSelect.value = nuvarandeTema;
    settingsModal.style.display = 'flex';
});

// Stäng modal
closeSettings.addEventListener('click', () => {
    settingsModal.style.display = 'none';
});

// Spara inställningar
saveSettings.addEventListener('click', () => {
    // Spara tema
    nuvarandeTema = themeSelect.value;
    appliceraTema(nuvarandeTema);

    const nyaMedlemmar = familyInput.value.split(',').map(m => m.trim()).filter(m => m !== '');
    if (nyaMedlemmar.length > 0) {
        familjeMedlemmar = nyaMedlemmar;
        localStorage.setItem('familjeMedlemmar', JSON.stringify(familjeMedlemmar));
        uppdatera();
        settingsModal.style.display = 'none';
    } else {
        alert("Du måste ha minst en familjemedlem!");
    }
});

// Nollställ data
resetBtn.addEventListener('click', () => {
    if (confirm("Är du säker på att du vill nollställa all data? Detta går inte att ångra.")) {
        händelser = [];
        localStorage.removeItem('händelser');
        uppdatera();
        settingsModal.style.display = 'none';
    }
});

// Stäng modal om man klickar utanför
window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.style.display = 'none';
    }
});

// Kör igång appen
appliceraTema(nuvarandeTema); // Applicera sparat tema vid start
uppdateraValuta(); // Starta valuta-API
uppdateraElpris(); // Starta elpris-API
uppdateraVattenstatus(); // Starta väder-API för vattenstatus
uppdatera(); // Rendera listan och summorna
