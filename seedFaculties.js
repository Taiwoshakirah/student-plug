const mongoose = require("mongoose");
const Faculty = require("./models/faculties"); // Adjust the path to your Faculty model
const School = require("./models/schoolInfo"); // Adjust the path to your School model
require("dotenv").config();

const seedFaculties = async () => {
    // Connect to MongoDB without deprecated options
    await mongoose.connect(process.env.MONGO_URI);
  
    // Get the schoolId from your School model
    const school = await School.findOne({ university: "yabatech" }); // Adjust the query to match your school
    if (!school) {
        console.error("School not found! Please ensure the school exists in the database.");
        return;
    }

    const faculties = [
        { facultyName: "Engineering", schoolId: school._id },
        { facultyName: "Arts", schoolId: school._id },
        { facultyName: "Sciences", schoolId: school._id },
        // Add more faculties if needed
    ];

    await Faculty.insertMany(faculties);
    console.log("Faculties seeded!");
    mongoose.connection.close();
};

seedFaculties();
