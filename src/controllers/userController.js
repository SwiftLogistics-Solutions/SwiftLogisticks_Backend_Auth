import admin from "../config/firebase.js";

export const createUser = async (req, res) => {
  const { name, email, password, confirmPassword, address, role } = req.body;

  try {
    const userResponse = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name, // Firebase uses displayName, not name
    });

    // Set custom claims for additional user data
    await admin.auth().setCustomUserClaims(userResponse.uid, {
      address: address,
      role: role,
    });

    res.status(201).json({ 
      message: "User created successfully", 
      user: userResponse 
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(400).json({ 
      message: "Error creating user", 
      error: error.message 
    });
  }
}

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Use Firebase Auth REST API to verify email and password
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Firebase Auth failed - invalid credentials
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Get user details from Firebase Admin SDK
    const userRecord = await admin.auth().getUserByEmail(email);
    
    res.status(200).json({ 
      message: "Login successful", 
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        customClaims: userRecord.customClaims,
      },
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
