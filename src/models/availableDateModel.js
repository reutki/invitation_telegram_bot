const mongoose = require("mongoose");
const ObjectId = require("mongoose").Types.ObjectId;
const availableDateSchema = new mongoose.Schema(
    {
        _id: { type: ObjectId, required: false },
        date: { type: String, required: true },
        time: { type: String, required: true },
        limit: { type: Number, required: true }
    },
    {
        collection: "Dati_Valabile"
    }
);

module.exports = mongoose.model("AvailableDate", availableDateSchema, "Dati_Valabile");
