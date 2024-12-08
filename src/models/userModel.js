const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    chatId: { type: Number, required: true, unique: true },
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    children: [
        {
            name: String,
            surname: String
        }
    ],
    language: { type: String, required: true, enum: ["ru", "ro"] },
    selectedDate: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Export model with explicit database and collection names
module.exports = mongoose.model("User", userSchema, "Craciun_Inregistrari");
