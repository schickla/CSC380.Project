
const apiKey = "de490bb159fd6bb5ea0f7beb22dc8eab"; 

let hourlyChart = null;

document.getElementById("searchBtn").addEventListener("click", () => {
    const city = document.getElementById("cityInput").value.trim();
    if (!city) return;
    runWithCity(city);
});

document.getElementById("geoBtn").addEventListener("click", () => {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported in this browser.");
        return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const { latitude, longitude } = pos.coords;
            // Use "Your Location" as the label
            await runWithCoords(latitude, longitude, "Your Location");
            setLoading(false);
        },
        (err) => {
            console.error(err);
            alert("Unable to get your location.");
            setLoading(false);
        }
    );
});

document.getElementById("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
});

/* ---------- Helpers ---------- */

function setLoading(isLoading) {
    const loadingEl = document.getElementById("loading");
    if (isLoading) loadingEl.classList.remove("hidden");
    else loadingEl.classList.add("hidden");
}

/* ---------- Core flows ---------- */

async function runWithCity(city) {
    try {
        setLoading(true);
        const current = await getCurrentWeatherByCity(city);
        const { lat, lon } = current.coord;
        const forecast = await getDailyAndHourly(lat, lon);

        renderCurrent(current, city);
        renderForecast(forecast);
        renderHourlyChart(forecast);
        updateBackground(current);
    } catch (err) {
        console.error(err);
        alert("Problem fetching weather data. Check the city name or try again.");
    } finally {
        setLoading(false);
    }
}

async function runWithCoords(lat, lon, label) {
    try {
        setLoading(true);
        const current = await getCurrentWeatherByCoords(lat, lon);
        const forecast = await getDailyAndHourly(lat, lon);

        renderCurrent(current, label);
        renderForecast(forecast);
        renderHourlyChart(forecast);
        updateBackground(current);
    } catch (err) {
        console.error(err);
        alert("Problem fetching weather data for your location.");
    } finally {
        setLoading(false);
    }
}

/* ---------- API calls ---------- */

async function getCurrentWeatherByCity(city) {
    const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
            city
        )}&units=imperial&appid=${apiKey}`
    );
    if (!res.ok) {
        throw new Error("Current weather (city) request failed");
    }
    return await res.json();
}

async function getCurrentWeatherByCoords(lat, lon) {
    const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
    );
    if (!res.ok) {
        throw new Error("Current weather (coords) request failed");
    }
    return await res.json();
}

async function getDailyAndHourly(lat, lon) {
    // Open-Meteo daily + hourly, Fahrenheit
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error("Forecast request failed");
    }
    return await res.json();
}

/* ---------- Render current weather ---------- */

function renderCurrent(data, label) {
    document.getElementById("location").innerText = label.toUpperCase();

    const html = `
        <h3>Current Weather</h3>
        <p>Temperature: ${data.main.temp.toFixed(1)}°F</p>
        <p>Conditions: ${data.weather[0].description}</p>
        <p>Humidity: ${data.main.humidity}%</p>
        <p>Wind: ${data.wind.speed} mph</p>
    `;

    document.getElementById("currentWeather").innerHTML = html;
}

/* ---------- Forecast icons (emoji) ---------- */

function weatherCodeToIcon(code) {
    // Open-Meteo weathercode mapping (simplified)
    // https://open-meteo.com/en/docs
    if (code === 0) return { icon: "☀️", label: "Clear sky" };
    if ([1, 2].includes(code)) return { icon: "🌤️", label: "Mostly clear" };
    if (code === 3) return { icon: "☁️", label: "Cloudy" };
    if ([45, 48].includes(code)) return { icon: "🌫️", label: "Fog" };
    if ([51, 53, 55, 56, 57].includes(code)) return { icon: "🌦️", label: "Drizzle" };
    if ([61, 63, 65, 80, 81, 82].includes(code))
        return { icon: "🌧️", label: "Rain" };
    if ([71, 73, 75, 77, 85, 86].includes(code))
        return { icon: "❄️", label: "Snow" };
    if ([95, 96, 99].includes(code))
        return { icon: "⛈️", label: "Thunderstorm" };
    return { icon: "🌡️", label: "Weather" };
}

/* ---------- Render daily forecast ---------- */

function renderForecast(data) {
    const container = document.getElementById("forecast");
    container.innerHTML = "<h3>7-Day Forecast</h3>";

    const days = data.daily.time;

    for (let i = 0; i < days.length; i++) {
        const card = document.createElement("div");
        card.className = "forecast-card";

        const date = new Date(days[i]).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
        });

        const code = data.daily.weathercode[i];
        const { icon, label } = weatherCodeToIcon(code);

        card.innerHTML = `
            <div class="icon" title="${label}">${icon}</div>
            <h4>${date}</h4>
            <p>High: ${data.daily.temperature_2m_max[i].toFixed(1)}°F</p>
            <p>Low: ${data.daily.temperature_2m_min[i].toFixed(1)}°F</p>
        `;

        container.appendChild(card);
    }
}

/* ---------- Render hourly chart ---------- */

function renderHourlyChart(data) {
    const ctx = document.getElementById("hourlyChart").getContext("2d");
    const times = data.hourly.time.slice(0, 24);
    const temps = data.hourly.temperature_2m.slice(0, 24);

    const labels = times.map((t) => {
        const d = new Date(t);
        return d.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
        });
    });

    if (hourlyChart) {
        hourlyChart.destroy();
    }

    hourlyChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Temp (°F)",
                    data: temps,
                    tension: 0.25,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: "°F",
                    },
                },
            },
        },
    });
}

/* ---------- Background based on current conditions ---------- */

function updateBackground(current) {
    const main = current.weather[0].main.toLowerCase();

    // clear old bg classes
    document.body.classList.remove(
        "bg-clear",
        "bg-clouds",
        "bg-rain",
        "bg-snow",
        "bg-thunder"
    );

    if (main.includes("clear")) {
        document.body.classList.add("bg-clear");
    } else if (main.includes("cloud")) {
        document.body.classList.add("bg-clouds");
    } else if (main.includes("rain") || main.includes("drizzle")) {
        document.body.classList.add("bg-rain");
    } else if (main.includes("snow")) {
        document.body.classList.add("bg-snow");
    } else if (main.includes("thunder")) {
        document.body.classList.add("bg-thunder");
    }
}

async function searchCities(query) {
    if (!query) return [];

    const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`
    );
    return await res.json();
}

function showAutocomplete(results) {
    const box = document.getElementById("autocomplete");

    if (results.length === 0) {
        box.classList.add("hidden");
        return;
    }

    box.innerHTML = "";

    results.forEach(city => {
        const item = document.createElement("div");
        item.classList.add("autocomplete-item");

        const state = city.state ? `, ${city.state}` : "";
        const country = city.country ? `, ${city.country}` : "";

        item.textContent = `${city.name}${state}${country}`;

        item.addEventListener("click", () => {
            // hide the box
            box.classList.add("hidden");
            document.getElementById("cityInput").value = item.textContent;

            // run weather with exact coordinates
            runWithCoords(city.lat, city.lon, item.textContent);
        });

        box.appendChild(item);
    });

    box.classList.remove("hidden");
}

let autocompleteTimer;

document.getElementById("cityInput").addEventListener("input", (e) => {
    const query = e.target.value.trim();

    clearTimeout(autocompleteTimer);

    // debounce 300ms
    autocompleteTimer = setTimeout(async () => {
        const results = await searchCities(query);
        showAutocomplete(results);
    }, 300);
});
