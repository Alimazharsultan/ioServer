const mongoose = require('mongoose')

const EntrySchema = new mongoose.Schema({
    readingtime: {
        type: String,
        required: false,
    },
    temperature: {
        type: Number,
        required: false,
    },
    humidity: {
        type: Number,
        required: false,
    },
    pressure: {
        type: Number,
        required: false,
    },

    altitude: {
        type: Number,
        required: false,
    },
    temperature_status:{
        type: String,
        required: false,
    },
    humidity_status:{
        type: String,
        required: false,
    },
    pressure_status:{
        type: String,
        required: false,
    },
    
});
const EntryModel = mongoose.model("testdata3", EntrySchema)   
module.exports = EntryModel;