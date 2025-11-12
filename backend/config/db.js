import mongoose from "mongoose";

const ensureBoxCodeIndex = async (connection) => {
  try {
    const collection = connection.db.collection("boxes");
    const indexes = await collection.indexes();
    const codeIndex = indexes.find((idx) => idx.name === "code_1");
    if (codeIndex?.unique) {
      await collection.dropIndex("code_1");
      await collection.createIndex({ code: 1 });
      console.log("Dropped unique index on boxes.code and recreated as non-unique.");
    } else if (!codeIndex) {
      await collection.createIndex({ code: 1 });
      console.log("Created index on boxes.code.");
    }
  } catch (err) {
    if (err.codeName !== "IndexNotFound") {
      console.warn("Warning ensuring boxes.code index:", err.message || err);
    }
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await ensureBoxCodeIndex(conn.connection);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
