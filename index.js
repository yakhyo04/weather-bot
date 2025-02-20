require("dotenv").config();
const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const ADMIN_ID = process.env.ADMIN_ID;
const USERS_FILE = "users.json";

const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
const saveUsers = () => fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

bot.use((ctx, next) => {
    if (!users.includes(ctx.from.id)) {
        users.push(ctx.from.id);
        saveUsers();
    }
    return next();
});

const languages = {
    en: { name: "English 🇬🇧", weather: "Weather", aqi: "Air Quality" },
    uz: { name: "O'zbek 🇺🇿", weather: "Ob-havo", aqi: "Havo sifati" },
    ru: { name: "Русский 🇷🇺", weather: "Погода", aqi: "Качество воздуха" },
};
const userLanguages = {};

async function getWeather(city, lang = "en") {
    try {
        const geoRes = await axios.get(
            `http://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${WEATHER_API_KEY}`
        );
        if (geoRes.data.length === 0) return `❌ City not found: ${city}`;

        const { lat, lon, name, country } = geoRes.data[0];

        const weatherRes = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric&lang=${lang}`
        );
        const { main, weather } = weatherRes.data;

        const airRes = await axios.get(
            `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}`
        );
        const aqi = airRes.data.list[0].main.aqi;

        const aqiDescriptions = {
            en: ["Good 😊", "Fair 🙂", "Moderate 😐", "Poor 😷", "Very Poor 🤢"],
            uz: ["Yaxshi 😊", "Qoniqarli 🙂", "O'rtacha 😐", "Yomon 😷", "Juda yomon 🤢"],
            ru: ["Хороший 😊", "Удовлетворительный 🙂", "Умеренный 😐", "Плохой 😷", "Очень плохой 🤢"],
        };

        return `🌍 *${name}, ${country}*  
🌡 ${languages[lang].weather}: *${main.temp}°C*  
☁ ${weather[0].description}  
💨 ${languages[lang].aqi}: *${aqiDescriptions[lang][aqi - 1]}* (AQI: ${aqi})`;
    } catch (error) {
        console.error("Error fetching data:", error.response?.data || error.message);
        return "❌ Error fetching weather data. Try again later!";
    }
}

bot.start((ctx) => {
    ctx.reply("🌍 Select a language / Tilni tanlang / Выберите язык:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "English 🇬🇧", callback_data: "lang_en" }],
                [{ text: "O'zbek 🇺🇿", callback_data: "lang_uz" }],
                [{ text: "Русский 🇷🇺", callback_data: "lang_ru" }],
            ],
        },
    });
});

bot.action(/^lang_(.+)$/, (ctx) => {
    const lang = ctx.match[1];
    userLanguages[ctx.from.id] = lang;
    ctx.reply(`✅ Language set to: ${languages[lang].name}\n🌤 Type /weather <city> to get the weather.`);
});

bot.command("weather", async (ctx) => {
    const lang = userLanguages[ctx.from.id] || "en";
    const city = ctx.message.text.split(" ").slice(1).join(" ");
    if (!city) return ctx.reply(`📍 Please provide a city name. Example: /weather Tashkent`);

    ctx.reply("⏳ Fetching weather...");
    ctx.reply(await getWeather(city, lang), { parse_mode: "Markdown" });
});

bot.command("broadcast", async (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply("❌ You are not authorized to send broadcasts.");

    const message = ctx.message.text.split(" ").slice(1).join(" ");
    if (!message) return ctx.reply("📢 Provide a message. Example: `/broadcast Hello everyone!`");

    users.forEach((userId) => bot.telegram.sendMessage(userId, message));
    ctx.reply(`✅ Message sent to ${users.length} users.`);
});

bot.command("usercount", (ctx) => {
    if (ctx.from.id.toString() !== ADMIN_ID) return ctx.reply("❌ You are not authorized to check user count.");
    ctx.reply(`📊 Total users: ${users.length}`);
});

bot.command("myid", (ctx) => ctx.reply(`🆔 Your Telegram ID: ${ctx.from.id}`));

bot.launch();
console.log("🚀 Bot is running...");