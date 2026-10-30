import { Router } from "express";
import {
  login,
  loginWithGoogle,
  saveDefaultAddress,
  sendPasswordReset,
  sendSignupVerification,
  verifyPasswordReset,
  verifySignupEmail
} from "../controllers/authEmailController.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    name: "Poster Town Auth API",
    endpoints: {
      login: "POST /api/auth/login",
      google: "POST /api/auth/google",
      signupStart: "POST /api/auth/signup/start",
      signupVerify: "POST /api/auth/signup/verify",
      passwordForgot: "POST /api/auth/password/forgot",
      passwordReset: "POST /api/auth/password/reset",
      address: "PUT /api/auth/address"
    }
  });
});

router.post("/login", login);
router.post("/google", loginWithGoogle);
router.put("/address", saveDefaultAddress);
router.post("/signup/start", sendSignupVerification);
router.post("/signup/send-verification", sendSignupVerification);
router.post("/signup/verify", verifySignupEmail);
router.post("/password/forgot", sendPasswordReset);
router.post("/password/reset", verifyPasswordReset);
router.post("/password-reset/send", sendPasswordReset);
router.post("/password-reset/verify", verifyPasswordReset);

export default router;
