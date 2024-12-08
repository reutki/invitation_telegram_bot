// src/config/db.js
const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000,
            maxPoolSize: 10
        });
        console.log("Connected to Eklesia database");
        return true;
    } catch (error) {
        console.error("Database Connection Error:", error);
        return false;
    }
};

module.exports = { connectDB };
