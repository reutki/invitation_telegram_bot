const express = require("express");
const router = express.Router();
const registrationController = require("../controllers/registrationController");
const { connectDB } = require("../config/db");
const User = require("../models/userModel");
const AvailableDate = require("../models/availableDateModel");

const addressRegex = /^[a-zA-Z0-9\s\.,]{5,}$/;

async function checkExistingRegistration(chatId) {
    try {
        const existingUser = await User.findOne({ chatId });
        if (existingUser) {
            return {
                exists: true,
                date: existingUser.selectedDate,
                language: existingUser.language
            };
        }
        return { exists: false };
    } catch (error) {
        console.error("Error checking registration:", error);
        return { exists: false, error: true };
    }
}
let availableDates = [];
async function getAvailableDates() {
    try {
        const dates = await AvailableDate.find().lean();
        console.log("Raw dates from DB:", dates);

        if (!dates || dates.length === 0) {
            console.log("No dates found in database");
            return [];
        }

        const dateStats = await User.aggregate([
            {
                $group: {
                    _id: "$selectedDate",
                    count: { $sum: 1 }
                }
            }
        ]);

        console.log("dateStats available:", dateStats);

        const dateCounts = dateStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {});

        console.log("dateCounts available:", dateCounts);

        const validDates = dates
            .filter(date => {
                const dateString = `${date.date} ${date.time}`;
                const currentCount = dateCounts[date.date] || 0;
                return currentCount < date.limit;
            })
            .map(date => ({
                text: `${date.date} ${date.time}`,
                callback_data: `date_${date.date}_${date.time.replace(":", "")}`
            }));

        console.log("Formatted dates:", validDates);
        return validDates;
    } catch (error) {
        console.error("Error fetching dates:", error);
        return [];
    }
}

async function updateDateCount(dateStr, timeStr) {
    try {
        const dateDoc = await AvailableDate.findOne({
            date: dateStr,
            time: timeStr
        });

        if (!dateDoc) return false;

        const currentCount = await User.countDocuments({
            selectedDate: `${dateStr} ${timeStr}`
        });

        return currentCount < dateDoc.limit;
    } catch (error) {
        console.error("Error checking date capacity:", error);
        return false;
    }
}
// Track user states
const userStates = {};
// Phone number validation regex
const phoneRegex = /^(\+?373|0)[0-9]{8}$/;

// Add reset function
function resetUserState(chatId) {
    userStates[chatId] = {
        step: "language",
        language: null,
        name: [],
        phoneNumber: null,
        address: null,
        childrenCount: null,
        children: [],
        currentChild: 0,
        selectedDate: null,
        chatId: chatId
    };
}
async function connectWithRetry(maxAttempts = 5, attempt = 1) {
    try {
        await connectDB();
        console.log("Successfully connected to database");
        return true;
    } catch (error) {
        console.error(`Connection attempt ${attempt} failed:`, error);

        if (attempt < maxAttempts) {
            console.log(`Retrying in 20 seconds... (Attempt ${attempt} of ${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 20000));
            return connectWithRetry(maxAttempts, attempt + 1);
        } else {
            console.error("Max connection attempts reached. Giving up.");
            throw error;
        }
    }
}
async function setRoutes(bot) {
    await connectWithRetry().then(async () => {
        availableDates = await getAvailableDates();
    });
    bot.onText(/\/start/, async msg => {
        const chatId = msg.chat.id;

        // Check if user already registered
        const registration = await checkExistingRegistration(chatId);

        if (registration.exists) {
            const message =
                registration.language === "ru"
                    ? `Вы уже зарегистрированы на ${registration.date}. Повторная регистрация невозможна.`
                    : `Sunteți deja înregistrat pentru ${registration.date}. Nu puteți să vă înregistrați din nou.`;
            bot.sendMessage(chatId, message);
            return;
        }

        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🇲🇩 Română", callback_data: "ro" },
                        { text: "🇷🇺 Русский", callback_data: "ru" }
                    ]
                ]
            },
            parse_mode: "HTML"
        };

        // Initialize user state
        userStates[chatId] = {
            step: "language",
            language: null,
            name: [],
            phoneNumber: null,
            address: null,
            childrenCount: null,
            children: [],
            currentChild: 0,
            selectedDate: null,
            chatId: chatId
        };

        bot.sendMessage(chatId, "Bine ati venit! Alege limba:\nДобро пожаловать! Выберите язык:", opts);
    });

    // Handle callback queries from inline keyboard
    bot.on("callback_query", async query => {
        const chatId = query.message.chat.id;

        // Check if user already registered
        const registration = await checkExistingRegistration(chatId);
        if (registration.exists) {
            await bot.answerCallbackQuery(query.id);
            return;
        }
        if (query.data === "ru") {
            userStates[chatId].step = "name";
            userStates[chatId].language = "ru";
            bot.sendMessage(chatId, "Вы выбрали русский. Пожалуйста, введите ваше имя как сообщение.");
        } else if (query.data === "ro") {
            userStates[chatId].step = "name";
            userStates[chatId].language = "ro";
            bot.sendMessage(chatId, "Ați ales română. Vă rugăm să introduceți numele dumneavoastră ca mesaj.");
        }

        // Answer the callback query to remove the loading state
        bot.answerCallbackQuery(query.id);
    });
    // Handle text messages for name and phone input
    bot.on("text", async msg => {
        const chatId = msg.chat.id;

        // Check if user already registered
        const registration = await checkExistingRegistration(chatId);
        if (registration.exists) {
            return;
        }
        const text = msg.text;

        // Skip if no state or is a command
        if (!userStates[chatId] || text.startsWith("/")) {
            return;
        }

        // Handle name input
        if (userStates[chatId].step === "name") {
            userStates[chatId].name.push(text);

            if (userStates[chatId].name.length === 2 || text.includes(" ")) {
                const fullName = userStates[chatId].name.join(" ");
                userStates[chatId].step = "phone";
                userStates[chatId].fullName = fullName;

                const message =
                    userStates[chatId].language === "ru"
                        ? `Спасибо, ${fullName}! Теперь, пожалуйста, введите ваш номер телефона (например: 0XXXXXXXX или +373XXXXXXXX)`
                        : `Mulțumesc, ${fullName}! Acum, vă rugăm să introduceți numărul dvs. de telefon (exemplu: 0XXXXXXXX sau +373XXXXXXXX)`;

                bot.sendMessage(chatId, message);
            } else if (userStates[chatId].name.length === 1) {
                const message = userStates[chatId].language === "ru" ? "Теперь введите вашу фамилию." : "Acum introduceți numele de familie.";

                bot.sendMessage(chatId, message);
            }
        }
        // Handle phone input

        // Handle phone -> address -> children flow
        else if (userStates[chatId].step === "phone") {
            if (phoneRegex.test(text)) {
                userStates[chatId].phone = text;
                userStates[chatId].step = "address";
                const message =
                    userStates[chatId].language === "ru"
                        ? "Пожалуйста, введите ваш адрес (например: Кишинев, ул. Виктора Крэсеску 100)"
                        : "Vă rugăm să introduceți adresa dvs. (exemplu: Chișinău, str. Victor Crăsescu 100)";
                bot.sendMessage(chatId, message);
            } else {
                const errorMessage =
                    userStates[chatId].language === "ru"
                        ? "Неверный формат номера. Пожалуйста, введите номер в формате 0XXXXXXXX или +373XXXXXXXX"
                        : "Format greșit. Vă rugăm să introduceți numărul în format 0XXXXXXXX sau +373XXXXXXXX";
                bot.sendMessage(chatId, errorMessage);
            }
        } else if (userStates[chatId].step === "address") {
            if (addressRegex.test(text)) {
                userStates[chatId].address = text;
                userStates[chatId].step = "childrenCount";

                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: "1", callback_data: "children_1" },
                                { text: "2", callback_data: "children_2" },
                                { text: "3", callback_data: "children_3" },
                                { text: "4", callback_data: "children_4" }
                            ]
                        ]
                    }
                };

                const message = userStates[chatId].language === "ru" ? "Сколько детей вы хотите зарегистрировать?" : "Câți copii doriți să înregistrați?";

                bot.sendMessage(chatId, message, opts);
            } else {
                const errorMessage =
                    userStates[chatId].language === "ru"
                        ? "Неверный формат адреса. Минимум 5 символов, буквы и цифры."
                        : "Format greșit. Minim 5 caractere, litere și cifre.";
                bot.sendMessage(chatId, errorMessage);
            }
        } else if (userStates[chatId].step === "childName") {
            handleChildNameInput(userStates[chatId].chatId, text);
        }
    });

    bot.on("callback_query", async query => {
        const chatId = query.message.chat.id;

        if (query.data.startsWith("date_")) {
            const selectedDate = query.data.split("_")[1];
            // Fix invalid assignment and add safety check
            if (!userStates[chatId]) {
                resetUserState(chatId);
            }

            userStates[chatId].selectedDate = selectedDate || null;
            userStates[chatId].chatId = chatId;

            // Show loading message
            const loadingMessage =
                userStates[chatId].language === "ru" ? "Подождите, регистрация обрабатывается..." : "Vă rugăm să așteptați, înregistrarea se procesează...";

            const loadingMsg = await bot.sendMessage(chatId, loadingMessage);

            await saveToDatabase(userStates[chatId]).then(async resp => {
                console.log("Saved:", resp.result);
                console.log("Status code:", resp.code);

                // Delete loading message
                await bot.deleteMessage(chatId, loadingMsg.message_id);

                const message =
                    userStates[chatId].language === "ru"
                        ? resp.result
                            ? `✅ Отлично! Вы зарегистрированы на ${selectedDate}`
                            : resp.code === 2
                            ? "⚠️ Вы уже зарегистрированы на это мероприятие. Повторная регистрация невозможна."
                            : "❌ Произошла ошибка при регистрации. Пожалуйста, попробуйте позже."
                        : resp.result
                        ? `✅ Perfect! Sunteți înregistrat pentru ${selectedDate}`
                        : resp.code === 2
                        ? "⚠️ Sunteți deja înregistrat pentru acest eveniment. Nu puteți să vă înregistrați din nou."
                        : "❌ A apărut o eroare la înregistrare. Vă rugăm să încercați mai târziu.";

                await bot.sendMessage(chatId, message);
            });

            await bot.answerCallbackQuery(query.id);
        }
        if (query.data.startsWith("children_")) {
            const count = parseInt(query.data.split("_")[1]);
            userStates[chatId].childrenCount = count;
            userStates[chatId].step = "childName";
            userStates[chatId].currentChild = 0;

            const message =
                userStates[chatId].language === "ru"
                    ? `ведите имя и фамилию ${userStates[chatId].currentChild + 1}-го ребенка:`
                    : `Introduceți numele și prenumele ${userStates[chatId].currentChild + 1} copil:`;

            bot.sendMessage(chatId, message);
            await bot.answerCallbackQuery(query.id);
        }
    });
    async function showAvailableDates(chatId) {
        const dates = await getAvailableDates();
        if (dates.length === 0) {
            const message = userStates[chatId].language === "ru" ? "К сожалению, нет доступных дат" : "Ne pare rău, nu sunt date disponibile";
            bot.sendMessage(chatId, message);
            return;
        }

        const keyboard = {
            reply_markup: {
                inline_keyboard: dates.map(date => [
                    {
                        text: date.text,
                        callback_data: date.callback_data
                    }
                ])
            }
        };

        const message = userStates[chatId].language === "ru" ? "Выберите дату:" : "Selectați data:";

        bot.sendMessage(chatId, message, keyboard);
    }

    async function handleChildNameInput(chatId, text) {
        const state = userStates[chatId];
        const [name, surname] = text.split(" ");

        if (!surname) {
            const errorMessage =
                state.language === "ru" ? "Пожалуйста, введите имя И фамилию ребенка" : "Vă rugăm să introduceți numele ȘI prenumele copilului";
            bot.sendMessage(chatId, errorMessage);
            return;
        }

        state.children.push({ name, surname });
        state.currentChild++;

        if (state.currentChild < state.childrenCount) {
            const message =
                state.language === "ru"
                    ? `Введите имя и фамилию ${state.currentChild + 1}-го ребенка:`
                    : `Introduceți numele și prenumele copilului ${state.currentChild + 1}:`;
            bot.sendMessage(chatId, message);
        } else {
            state.step = "date";
            await showAvailableDates(chatId);
        }
    }
    async function saveToDatabase(userData) {
        try {
            await connectDB();
            const user = new User({
                chatId: userData.chatId ?? null,
                fullName: userData.fullName ?? null,
                phoneNumber: userData.phone ?? null,
                address: userData.address ?? null,
                children: userData.children ?? [],
                language: userData.language ?? null,
                selectedDate: userData.selectedDate ?? null
            });

            await user.save();
            console.log("User saved successfully:", user);
            return { result: true, code: 0 };
        } catch (error) {
            console.error("Error saving to database:", error);
            console.log("Errorcode:", error.code);
            console.log("Errormsg:", error.errmsg);
            if (error.code == 11000 || error.errmsg.includes("duplicate key")) {
                return { result: false, code: 2 };
            }
            return { result: false, code: 1 };
        }
    }
}

module.exports = { setRoutes };
