// MongoDB connection setup
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGO_URI;

const connectDB = async () => {
	await mongoose.connect(mongoURI)
	.then(() => {
		console.log('MongoDB connected');
	})
	.catch((error) => {
		console.error('MongoDB connection error:', error);
		process.exit(1);
	});
};

export default connectDB;
