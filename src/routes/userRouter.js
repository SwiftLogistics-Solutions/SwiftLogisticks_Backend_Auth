import express from "express"
import {createUser, loginUser, logoutUser, deleteUser} from "../controllers/userController.js"
const userRouter = express.Router();

userRouter.post("/signup", createUser);
userRouter.post("/login", loginUser);
userRouter.post("/logout", logoutUser);
userRouter.delete("/delete", deleteUser);

export default userRouter;
