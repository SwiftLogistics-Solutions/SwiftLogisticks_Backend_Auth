import express from "express"
import {createUser, loginUser, logoutUser, getDistricts} from "../controllers/userController.js"
const userRouter = express.Router();

userRouter.post("/signup", createUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", logoutUser);
userRouter.get("/districts", getDistricts);

export default userRouter;
