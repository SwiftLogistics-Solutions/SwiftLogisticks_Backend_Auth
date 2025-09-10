import admin from "../config/firebase.js";

export const createUser = async (req, res) => {
  const { name, email, password, confirmPassword, address, role } = req.body;

  try {
    // Validate input
    if (!name || !email || !password || !confirmPassword || !address || !role) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    if (!["customer", "driver"].includes(role)) {
      return res.status(400).json({ message: "Role must be either 'customer' or 'driver'" });
    }

    // Create user in Firebase
    const userResponse = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    // Set custom claims for additional user data
    await admin.auth().setCustomUserClaims(userResponse.uid, {
      address: address,
      role: role,
    });

    res.status(201).json({ 
      message: "User created successfully", 
      user: {
        uid: userResponse.uid,
        email: userResponse.email,
        displayName: userResponse.displayName,
        customClaims: {
          address: address,
          role: role
        }
      }
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

export const logoutUser = async (req, res) => {
  try {
    const { uid, idToken } = req.body;

    if (uid) {
      // Step 1: Revoke all refresh tokens for the user
      // This prevents the user from getting new ID tokens
      await admin.auth().revokeRefreshTokens(uid);
      
      // Step 2: Verify the current ID token and get user info
      let userEmail = "Unknown";
      let tokenValid = false;
      
      if (idToken) {
        try {
          // Verify the token with checkRevoked: true to ensure it's not from a revoked session
          const decodedToken = await admin.auth().verifyIdToken(idToken, true);
          userEmail = decodedToken.email;
          tokenValid = true;
          console.log(`User ${userEmail} logged out successfully`);
        } catch (tokenError) {
          console.log("Token verification failed during logout:", tokenError.message);
          // Token might be expired or revoked, which is expected after revokeRefreshTokens
        }
      }

      res.status(200).json({ 
        message: "Logout successful", 
        details: {
          serverSideLogout: "✅ Refresh tokens revoked",
          tokenStatus: tokenValid ? "Valid at logout time" : "Invalid/Expired"
        },
        timestamp: new Date().toISOString()
      });
    } else {
      // If no UID provided, guide client on what to do
      res.status(200).json({ 
        message: "Client-side logout guidance",
        warning: "⚠️ Server-side token revocation not performed (no UID provided)",
        instructions: [
          "Clear all tokens from client storage",
          "Call firebase.auth().signOut() on client",
          "Clear any cached user data",
          "Redirect to login page"
        ],
        note: "For complete security, provide UID for server-side token revocation",
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ 
      message: "Error during logout", 
      error: error.message 
    });
  }
}

export const deleteUser = async (req, res) => {
  try {
    const { uid } = req.body;

    // Validate input - uid is required
    if (!uid) {
      return res.status(400).json({ 
        message: "UID is required to delete user" 
      });
    }

    // Get user details before deletion for response
    let userToDelete;
    try {
      userToDelete = await admin.auth().getUser(uid);
    } catch (error) {
      return res.status(404).json({ 
        message: "User not found with provided uid" 
      });
    }

    // Delete the user from Firebase Auth
    await admin.auth().deleteUser(uid);

    res.status(200).json({
      message: "User deleted successfully",
      deletedUser: {
        uid: userToDelete.uid,
        email: userToDelete.email,
        displayName: userToDelete.displayName
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      message: "Error deleting user",
      error: error.message
    });
  }
}


